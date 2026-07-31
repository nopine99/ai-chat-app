export type MessageRole = "user" | "assistant";

/** 채팅 타임라인에 붙는 MCP 도구 호출 스텝. */
export interface ChatToolCall {
  callId: string;
  serverId: string;
  serverName: string;
  name: string;
  args: Record<string, unknown>;
  ok?: boolean;
  result?: unknown;
}

/** 생성 이미지. 본문 마크다운이 아니라 첨부로 두어 렌더 비용을 줄인다. */
export interface ChatImageAttachment {
  id: string;
  mimeType: string;
  /** base64 (data: 접두사 없음). */
  data: string;
  alt?: string;
  callId?: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  toolCalls?: ChatToolCall[];
  attachments?: ChatImageAttachment[];
}

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
}
