import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { McpServerConfig } from "@/lib/types/mcp";

const SCHEMA_VERSION = 1;

export interface McpServerSnapshot {
  servers: McpServerConfig[];
}

interface StoredSnapshot extends McpServerSnapshot {
  version: number;
}

interface McpServerRow {
  id: string;
  name: string;
  transport: string;
  stdio: unknown;
  http: unknown;
  created_at: string;
  updated_at: string;
}

export const EMPTY_MCP_SNAPSHOT: McpServerSnapshot = { servers: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) && Object.values(value).every((v) => typeof v === "string")
  );
}

function isServerConfig(value: unknown): value is McpServerConfig {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || typeof value.name !== "string")
    return false;
  if (typeof value.createdAt !== "string" || typeof value.updatedAt !== "string")
    return false;

  if (value.transport === "stdio") {
    const stdio = value.stdio;
    if (!isRecord(stdio) || typeof stdio.command !== "string") return false;
    if (stdio.args !== undefined) {
      if (
        !Array.isArray(stdio.args) ||
        !stdio.args.every((a) => typeof a === "string")
      )
        return false;
    }
    if (stdio.env !== undefined && !isStringRecord(stdio.env)) return false;
    if (stdio.cwd !== undefined && typeof stdio.cwd !== "string") return false;
    return true;
  }

  if (value.transport === "http") {
    const http = value.http;
    if (!isRecord(http) || typeof http.url !== "string") return false;
    if (http.headers !== undefined && !isStringRecord(http.headers))
      return false;
    return true;
  }

  return false;
}

function rowToServer(row: McpServerRow): McpServerConfig | null {
  const candidate: Record<string, unknown> = {
    id: row.id,
    name: row.name,
    transport: row.transport,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.stdio !== null && row.stdio !== undefined) {
    candidate.stdio = row.stdio;
  }
  if (row.http !== null && row.http !== undefined) {
    candidate.http = row.http;
  }
  return isServerConfig(candidate) ? candidate : null;
}

/** 조회·파싱 실패 시 예외 대신 빈 스냅샷을 돌려준다. */
export async function fetchMcpSnapshot(): Promise<McpServerSnapshot> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("mcp_servers")
      .select("id, name, transport, stdio, http, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (error) return EMPTY_MCP_SNAPSHOT;

    const servers = (data ?? [])
      .map((row) => rowToServer(row as McpServerRow))
      .filter((server): server is McpServerConfig => server !== null);

    return { servers };
  } catch {
    return EMPTY_MCP_SNAPSHOT;
  }
}

export async function saveMcpSnapshot({
  servers,
}: McpServerSnapshot): Promise<void> {
  try {
    const supabase = getSupabaseBrowserClient();
    const keptIds = servers.map((server) => server.id);

    const rows = servers.map((server) => ({
      id: server.id,
      name: server.name,
      transport: server.transport,
      stdio: server.stdio ?? null,
      http: server.http ?? null,
      created_at: server.createdAt,
      updated_at: server.updatedAt,
    }));

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("mcp_servers")
        .upsert(rows, { onConflict: "id" });
      if (upsertError) return;
    }

    const { data: existing, error: listError } = await supabase
      .from("mcp_servers")
      .select("id");
    if (listError) return;

    const staleIds = (existing ?? [])
      .map((row) => row.id as string)
      .filter((id) => !keptIds.includes(id));

    if (staleIds.length > 0) {
      await supabase.from("mcp_servers").delete().in("id", staleIds);
    }
  } catch {
    // 네트워크 실패는 등록 흐름을 막지 않는다.
  }
}

/** 서버 설정을 내보내기용 JSON 문자열로 직렬화한다. */
export function exportMcpSnapshot(servers: McpServerConfig[]): string {
  const payload: StoredSnapshot = { version: SCHEMA_VERSION, servers };
  return JSON.stringify(payload, null, 2);
}

/** 가져오기 파일을 검증한다. 형식이 잘못됐으면 예외를 던진다(호출부에서 사용자에게 안내). */
export function parseImportedSnapshot(raw: string): McpServerConfig[] {
  const parsed: unknown = JSON.parse(raw);

  const servers =
    isRecord(parsed) && Array.isArray(parsed.servers)
      ? parsed.servers
      : Array.isArray(parsed)
        ? parsed
        : null;

  if (!servers) {
    throw new Error("올바른 MCP 서버 설정 파일이 아닙니다.");
  }

  const valid = servers.filter(isServerConfig);
  if (valid.length === 0) {
    throw new Error("가져올 수 있는 서버 설정이 없습니다.");
  }

  return valid;
}
