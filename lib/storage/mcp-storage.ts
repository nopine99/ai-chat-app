import type { McpServerConfig } from "@/lib/types/mcp";

const STORAGE_KEY = "ai-memo-app.mcp-servers";
const SCHEMA_VERSION = 1;

export interface McpServerSnapshot {
  servers: McpServerConfig[];
}

interface StoredSnapshot extends McpServerSnapshot {
  version: number;
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
      if (!Array.isArray(stdio.args) || !stdio.args.every((a) => typeof a === "string"))
        return false;
    }
    if (stdio.env !== undefined && !isStringRecord(stdio.env)) return false;
    if (stdio.cwd !== undefined && typeof stdio.cwd !== "string") return false;
    return true;
  }

  if (value.transport === "http") {
    const http = value.http;
    if (!isRecord(http) || typeof http.url !== "string") return false;
    if (http.headers !== undefined && !isStringRecord(http.headers)) return false;
    return true;
  }

  return false;
}

/** 저장값이 없거나 손상됐으면 예외 대신 빈 스냅샷을 돌려준다. */
function loadSnapshot(): McpServerSnapshot {
  if (typeof window === "undefined") return EMPTY_MCP_SNAPSHOT;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_MCP_SNAPSHOT;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== SCHEMA_VERSION) {
      return EMPTY_MCP_SNAPSHOT;
    }
    if (!Array.isArray(parsed.servers)) return EMPTY_MCP_SNAPSHOT;

    return { servers: parsed.servers.filter(isServerConfig) };
  } catch {
    return EMPTY_MCP_SNAPSHOT;
  }
}

let cached: McpServerSnapshot | null = null;

/**
 * `useSyncExternalStore`가 렌더 중에 호출하므로 항상 같은 참조를 돌려줘야 한다.
 * 그래서 첫 호출 결과를 캐시하고, 쓰기가 일어날 때만 갱신한다.
 */
export function getStoredMcpSnapshot(): McpServerSnapshot {
  cached ??= loadSnapshot();
  return cached;
}

export function saveMcpSnapshot({ servers }: McpServerSnapshot): void {
  if (typeof window === "undefined") return;

  const payload: StoredSnapshot = { version: SCHEMA_VERSION, servers };
  cached = { servers: payload.servers };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 용량 초과나 프라이빗 모드에서의 쓰기 실패는 등록 흐름을 막지 않는다.
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

  const servers = isRecord(parsed) && Array.isArray(parsed.servers)
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
