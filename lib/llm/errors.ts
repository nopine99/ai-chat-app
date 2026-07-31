import type { ChatErrorCode } from "@/lib/llm/types";

const USER_MESSAGES: Record<ChatErrorCode, string> = {
  BAD_REQUEST: "요청 형식을 확인해주세요.",
  AUTH_ERROR: "AI 서비스 인증에 실패했어요. API 키 설정을 확인해주세요.",
  RATE_LIMITED: "요청이 너무 많아요. 잠시 후 다시 시도해주세요.",
  UPSTREAM_ERROR: "AI 서비스에 일시적인 문제가 발생했어요. 다시 시도해주세요.",
};

export class ChatError extends Error {
  readonly code: ChatErrorCode;

  constructor(code: ChatErrorCode, message?: string) {
    super(message ?? USER_MESSAGES[code]);
    this.name = "ChatError";
    this.code = code;
  }
}

/**
 * 상류(Gemini) 에러를 내부 에러 코드로 변환한다.
 * 원문 메시지/스택은 클라이언트로 내보내지 않는다.
 */
export function toChatError(error: unknown): ChatError {
  if (error instanceof ChatError) {
    return error;
  }

  const status = readStatus(error);

  if (status === 400) return new ChatError("BAD_REQUEST");
  if (status === 401 || status === 403) return new ChatError("AUTH_ERROR");
  if (status === 429) return new ChatError("RATE_LIMITED");

  return new ChatError("UPSTREAM_ERROR");
}

export function userMessageFor(code: ChatErrorCode): string {
  return USER_MESSAGES[code];
}

function readStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;

  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}
