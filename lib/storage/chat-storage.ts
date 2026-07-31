import type {
  ChatImageAttachment,
  ChatMessage,
  ChatSession,
  ChatToolCall,
} from "@/lib/types/chat";

const STORAGE_KEY = "ai-memo-app.chat";
const SCHEMA_VERSION = 1;

/** localStorage 용량 한도(약 5MB)에 닿기 전에 오래된 대화를 버린다. */
const MAX_SESSIONS = 30;

export interface ChatSnapshot {
  sessions: ChatSession[];
  activeChatId: string | null;
}

interface StoredSnapshot extends ChatSnapshot {
  version: number;
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

function isSession(value: unknown): value is ChatSession {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.updatedAt === "string" &&
    Array.isArray(value.messages) &&
    value.messages.every(isMessage)
  );
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

/** 저장값이 없거나 손상됐으면 예외 대신 빈 스냅샷을 돌려준다. */
function loadChatSnapshot(): ChatSnapshot {
  if (typeof window === "undefined") return EMPTY_CHAT_SNAPSHOT;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_CHAT_SNAPSHOT;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== SCHEMA_VERSION) {
      return EMPTY_CHAT_SNAPSHOT;
    }
    if (!Array.isArray(parsed.sessions)) return EMPTY_CHAT_SNAPSHOT;

    const sessions = trimSessions(parsed.sessions.filter(isSession));

    return {
      sessions,
      activeChatId: resolveActiveChatId(sessions, parsed.activeChatId),
    };
  } catch {
    return EMPTY_CHAT_SNAPSHOT;
  }
}

let cached: ChatSnapshot | null = null;

/**
 * `useSyncExternalStore`가 렌더 중에 호출하므로 항상 같은 참조를 돌려줘야 한다.
 * 그래서 첫 호출 결과를 캐시하고, 쓰기가 일어날 때만 갱신한다.
 */
export function getStoredChatSnapshot(): ChatSnapshot {
  cached ??= loadChatSnapshot();
  return cached;
}

export function saveChatSnapshot({
  sessions,
  activeChatId,
}: ChatSnapshot): void {
  if (typeof window === "undefined") return;

  const kept = trimSessions(sessions);
  const payload: StoredSnapshot = {
    version: SCHEMA_VERSION,
    sessions: kept,
    activeChatId: resolveActiveChatId(kept, activeChatId),
  };
  cached = { sessions: payload.sessions, activeChatId: payload.activeChatId };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 용량 초과나 프라이빗 모드에서의 쓰기 실패는 대화 진행을 막지 않는다.
    // 에러 객체에 저장하려던 대화 내용이 실려 있을 수 있어 로그로도 남기지 않는다.
  }
}
