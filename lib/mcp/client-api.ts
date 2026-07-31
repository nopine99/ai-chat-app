import type {
  McpApiErrorBody,
  McpConnectionState,
  McpErrorCode,
  McpServerCapabilities,
  McpServerConfig,
} from "@/lib/types/mcp";

export class McpClientError extends Error {
  readonly code: McpErrorCode;

  constructor(body: McpApiErrorBody) {
    super(body.message);
    this.name = "McpClientError";
    this.code = body.code;
  }
}

function isErrorBody(value: unknown): value is McpApiErrorBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Partial<McpApiErrorBody>;
  return typeof body.code === "string" && typeof body.message === "string";
}

async function handleResponse<T>(response: Response): Promise<T> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // 본문이 없거나 JSON이 아닐 수 있다.
  }

  if (!response.ok) {
    if (isErrorBody(payload)) throw new McpClientError(payload);
    throw new McpClientError({
      code: "UPSTREAM_ERROR",
      message: "요청을 처리하지 못했어요.",
    });
  }

  return payload as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export function connectServer(
  server: McpServerConfig
): Promise<McpConnectionState> {
  return postJson<McpConnectionState>("/api/mcp/connect", { server });
}

export function disconnectServer(
  serverId: string
): Promise<{ status: "disconnected" }> {
  return postJson<{ status: "disconnected" }>("/api/mcp/disconnect", {
    serverId,
  });
}

export function refreshServerCapabilities(
  serverId: string
): Promise<{ capabilities: McpServerCapabilities }> {
  return postJson<{ capabilities: McpServerCapabilities }>(
    "/api/mcp/refresh",
    { serverId }
  );
}

export function callServerTool(
  serverId: string,
  name: string,
  args?: Record<string, unknown>
): Promise<{ result: unknown }> {
  return postJson<{ result: unknown }>("/api/mcp/tools/call", {
    serverId,
    name,
    arguments: args,
  });
}

export function getServerPrompt(
  serverId: string,
  name: string,
  args?: Record<string, string>
): Promise<{ result: unknown }> {
  return postJson<{ result: unknown }>("/api/mcp/prompts/get", {
    serverId,
    name,
    arguments: args,
  });
}

export function readServerResource(
  serverId: string,
  uri: string
): Promise<{ result: unknown }> {
  return postJson<{ result: unknown }>("/api/mcp/resources/read", {
    serverId,
    uri,
  });
}
