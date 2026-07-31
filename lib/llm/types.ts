import type { MessageRole } from "@/lib/types/chat";

/** 서버로 보내는 대화 턴. 클라이언트/서버가 공유하는 계약이다. */
export interface ChatTurn {
  role: MessageRole;
  content: string;
}

export interface ChatStreamRequest {
  messages: ChatTurn[];
}

export type ChatErrorCode =
  | "BAD_REQUEST"
  | "AUTH_ERROR"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR";

/** SSE 이벤트 페이로드. 스트림 중 에러도 연결을 끊지 않고 이 형태로 전달한다. */
export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | {
      type: "image";
      id: string;
      mimeType: string;
      data: string;
      alt?: string;
      callId?: string;
    }
  | {
      type: "tool_start";
      callId: string;
      serverId: string;
      serverName: string;
      name: string;
      args: Record<string, unknown>;
    }
  | { type: "tool_result"; callId: string; ok: boolean; result: unknown }
  | { type: "error"; code: ChatErrorCode; message: string }
  | { type: "done" };
