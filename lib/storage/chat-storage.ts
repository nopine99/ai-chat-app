import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  ChatImageAttachment,
  ChatMessage,
  ChatSession,
  ChatToolCall,
} from "@/lib/types/chat";

/** DB 용량·목록 UX를 위해 오래된 대화를 버린다. */
const MAX_SESSIONS = 30;
const ACTIVE_CHAT_KEY = "activeChatId";

export interface ChatSnapshot {
  sessions: ChatSession[];
  activeChatId: string | null;
}

interface ChatSessionRow {
  id: string;
  title: string;
  updated_at: string;
  messages: unknown;
}

export const EMPTY_CHAT_SNAPSHOT: ChatSnapshot = {
  sessions: [],
  activeChatId: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isToolCall(value: unknown): value is ChatToolCall {
  if (!isRecord(value)) return false;
  if (typeof value.callId !== "string") return false;
  if (typeof value.serverId !== "string") return false;
  if (typeof value.serverName !== "string") return false;
  if (typeof value.name !== "string") return false;
  if (!isRecord(value.args)) return false;
  if (value.ok !== undefined && typeof value.ok !== "boolean") return false;
  return true;
}

function isAttachment(value: unknown): value is ChatImageAttachment {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.mimeType === "string" &&
    typeof value.data === "string"
  );
}

function isMessage(value: unknown): value is ChatMessage {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    (value.role !== "user" && value.role !== "assistant") ||
    typeof value.content !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    return false;
  }

  if (
    value.toolCalls !== undefined &&
    !(Array.isArray(value.toolCalls) && value.toolCalls.every(isToolCall))
  ) {
    return false;
  }

  if (
    value.attachments !== undefined &&
    !(Array.isArray(value.attachments) && value.attachments.every(isAttachment))
  ) {
    return false;
  }

  return true;
}

function parseMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isMessage);
}

function rowToSession(row: ChatSessionRow): ChatSession {
  return {
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
    messages: parseMessages(row.messages),
  };
}

/** 최신 세션 MAX_SESSIONS개만 남기되, 사이드바 순서가 바뀌지 않도록 원래 배열 순서는 유지한다. */
function trimSessions(sessions: ChatSession[]): ChatSession[] {
  if (sessions.length <= MAX_SESSIONS) return sessions;

  const kept = new Set(
    [...sessions]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_SESSIONS)
      .map((session) => session.id)
  );

  return sessions.filter((session) => kept.has(session.id));
}

function resolveActiveChatId(
  sessions: ChatSession[],
  activeChatId: unknown
): string | null {
  if (typeof activeChatId !== "string") return null;
  return sessions.some((session) => session.id === activeChatId)
    ? activeChatId
    : null;
}

/** 조회·파싱 실패 시 예외 대신 빈 스냅샷을 돌려준다. */
export async function fetchChatSnapshot(): Promise<ChatSnapshot> {
  try {
    const supabase = getSupabaseBrowserClient();
    const [sessionsResult, activeResult] = await Promise.all([
      supabase
        .from("chat_sessions")
        .select("id, title, updated_at, messages")
        .order("updated_at", { ascending: false }),
      supabase
        .from("app_settings")
        .select("value")
        .eq("key", ACTIVE_CHAT_KEY)
        .maybeSingle(),
    ]);

    if (sessionsResult.error) return EMPTY_CHAT_SNAPSHOT;

    const sessions = trimSessions(
      (sessionsResult.data ?? []).map((row) =>
        rowToSession(row as ChatSessionRow)
      )
    );
    const activeValue = activeResult.data?.value;

    return {
      sessions,
      activeChatId: resolveActiveChatId(sessions, activeValue),
    };
  } catch {
    return EMPTY_CHAT_SNAPSHOT;
  }
}

export async function saveChatSnapshot({
  sessions,
  activeChatId,
}: ChatSnapshot): Promise<void> {
  try {
    const supabase = getSupabaseBrowserClient();
    const kept = trimSessions(sessions);
    const nextActive = resolveActiveChatId(kept, activeChatId);
    const keptIds = kept.map((session) => session.id);

    const rows = kept.map((session) => ({
      id: session.id,
      title: session.title,
      updated_at: session.updatedAt,
      messages: session.messages,
    }));

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("chat_sessions")
        .upsert(rows, { onConflict: "id" });
      if (upsertError) return;
    }

    const { data: existing, error: listError } = await supabase
      .from("chat_sessions")
      .select("id");
    if (listError) return;

    const staleIds = (existing ?? [])
      .map((row) => row.id as string)
      .filter((id) => !keptIds.includes(id));

    if (staleIds.length > 0) {
      await supabase.from("chat_sessions").delete().in("id", staleIds);
    }

    await supabase.from("app_settings").upsert(
      {
        key: ACTIVE_CHAT_KEY,
        value: nextActive,
      },
      { onConflict: "key" }
    );
  } catch {
    // 네트워크 실패는 대화 진행을 막지 않는다.
  }
}
