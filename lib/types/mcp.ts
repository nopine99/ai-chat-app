/** 클라이언트(localStorage)와 서버(API Route)가 함께 사용하는 MCP 계약 타입. */

export type McpTransportKind = "stdio" | "http";

export interface McpStdioConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface McpHttpConfig {
  url: string;
  headers?: Record<string, string>;
}

/** 클라이언트가 localStorage에 저장하는 서버 등록 정보. */
export interface McpServerConfig {
  id: string;
  name: string;
  transport: McpTransportKind;
  stdio?: McpStdioConfig;
  http?: McpHttpConfig;
  createdAt: string;
  updatedAt: string;
}

export type McpConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface McpToolSummary {
  name: string;
  title?: string;
  description?: string;
  inputSchema: unknown;
}

export interface McpPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface McpPromptSummary {
  name: string;
  title?: string;
  description?: string;
  arguments?: McpPromptArgument[];
}

export interface McpResourceSummary {
  uri: string;
  name?: string;
  title?: string;
  description?: string;
  mimeType?: string;
}

export interface McpServerCapabilities {
  tools: McpToolSummary[];
  prompts: McpPromptSummary[];
  resources: McpResourceSummary[];
}

export interface McpServerInfo {
  name: string;
  version: string;
}

/** 서버(Node 프로세스) 메모리에만 존재하는 실시간 연결 상태. */
export interface McpConnectionState {
  status: McpConnectionStatus;
  connectedAt?: string;
  serverInfo?: McpServerInfo;
  capabilities?: McpServerCapabilities;
  error?: { code: McpErrorCode; message: string };
}

/**
 * `/api/mcp/events` SSE 스트림이 실어 나르는 이벤트.
 * snapshot은 구독 시작 시 1회, update는 연결 상태가 바뀔 때마다 전송된다.
 */
export type McpStatusEvent =
  | { type: "snapshot"; statuses: Record<string, McpConnectionState> }
  | { type: "update"; serverId: string; state: McpConnectionState };

export type McpErrorCode =
  | "BAD_REQUEST"
  | "NOT_CONNECTED"
  | "CONNECTION_FAILED"
  | "TIMEOUT"
  | "UPSTREAM_ERROR";

export interface McpApiErrorBody {
  code: McpErrorCode;
  message: string;
}
