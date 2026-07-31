import type { McpErrorCode } from "@/lib/types/mcp";

const USER_MESSAGES: Record<McpErrorCode, string> = {
  BAD_REQUEST: "요청 형식을 확인해주세요.",
  NOT_CONNECTED: "서버에 연결되어 있지 않아요. 먼저 연결해주세요.",
  CONNECTION_FAILED: "서버에 연결할 수 없어요. 설정을 확인해주세요.",
  TIMEOUT: "서버 응답이 너무 오래 걸려요. 잠시 후 다시 시도해주세요.",
  UPSTREAM_ERROR: "MCP 서버에서 오류가 발생했어요.",
};

const HTTP_STATUS: Record<McpErrorCode, number> = {
  BAD_REQUEST: 400,
  NOT_CONNECTED: 409,
  CONNECTION_FAILED: 502,
  TIMEOUT: 504,
  UPSTREAM_ERROR: 502,
};

export class McpError extends Error {
  readonly code: McpErrorCode;

  constructor(code: McpErrorCode, message?: string) {
    super(message ?? USER_MESSAGES[code]);
    this.name = "McpError";
    this.code = code;
  }
}

const KNOWN_CODES = new Set<string>(Object.keys(USER_MESSAGES));

/**
 * dev 서버(Turbopack)는 라우트마다 별도 모듈 그래프로 번들링할 수 있어,
 * `lib/mcp/errors.ts`가 여러 인스턴스로 로드되면 `instanceof McpError`가 실패할 수 있다.
 * 그런 경우를 대비해 구조로도 McpError를 식별한다.
 */
function isMcpErrorLike(
  error: unknown
): error is { code: McpErrorCode; message: string } {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return (
    typeof candidate.code === "string" &&
    KNOWN_CODES.has(candidate.code) &&
    typeof candidate.message === "string"
  );
}

export function toMcpError(error: unknown): McpError {
  if (error instanceof McpError) return error;
  if (isMcpErrorLike(error)) return new McpError(error.code, error.message);

  // 원문 에러 메시지는 로그에서만 쓰고, 클라이언트에는 매핑된 코드만 내려준다.
  console.error("[mcp]", error instanceof Error ? error.message : error);

  return new McpError("UPSTREAM_ERROR");
}

export function httpStatusFor(code: McpErrorCode): number {
  return HTTP_STATUS[code];
}

export function userMessageFor(code: McpErrorCode): string {
  return USER_MESSAGES[code];
}
