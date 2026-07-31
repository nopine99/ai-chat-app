import { McpError } from "@/lib/mcp/errors";
import type { McpServerConfig, McpTransportKind } from "@/lib/types/mcp";

const MAX_STRING_LENGTH = 4_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_STRING_LENGTH
  );
}

function parseStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    throw new McpError("BAD_REQUEST", `${field} 형식이 올바르지 않습니다.`);
  }
  return value;
}

function parseStringRecord(
  value: unknown,
  field: string
): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  if (
    !isRecord(value) ||
    Object.values(value).some((v) => typeof v !== "string")
  ) {
    throw new McpError("BAD_REQUEST", `${field} 형식이 올바르지 않습니다.`);
  }
  return value as Record<string, string>;
}

/** 클라이언트가 보낸 서버 등록 정보를 검증한다. 매 요청마다 새로 검증하고 서버에는 저장하지 않는다. */
export function parseServerConfig(body: unknown): McpServerConfig {
  if (!isRecord(body)) throw new McpError("BAD_REQUEST");

  const { server } = body as { server?: unknown };
  if (!isRecord(server)) {
    throw new McpError("BAD_REQUEST", "server 정보가 필요합니다.");
  }

  const { id, name, transport, stdio, http } = server as Record<
    string,
    unknown
  >;

  if (!isNonEmptyString(id)) {
    throw new McpError("BAD_REQUEST", "서버 id가 필요합니다.");
  }
  if (!isNonEmptyString(name)) {
    throw new McpError("BAD_REQUEST", "서버 이름이 필요합니다.");
  }
  if (transport !== "stdio" && transport !== "http") {
    throw new McpError("BAD_REQUEST", "transport는 stdio 또는 http여야 합니다.");
  }

  const kind = transport as McpTransportKind;

  if (kind === "stdio") {
    if (!isRecord(stdio) || !isNonEmptyString(stdio.command)) {
      throw new McpError("BAD_REQUEST", "실행 명령어(command)가 필요합니다.");
    }
    if (stdio.cwd !== undefined && !isNonEmptyString(stdio.cwd)) {
      throw new McpError("BAD_REQUEST", "cwd 형식이 올바르지 않습니다.");
    }

    return {
      id,
      name,
      transport: "stdio",
      stdio: {
        command: stdio.command,
        args: parseStringArray(stdio.args, "args"),
        env: parseStringRecord(stdio.env, "env"),
        cwd: stdio.cwd as string | undefined,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  if (!isRecord(http) || !isNonEmptyString(http.url)) {
    throw new McpError("BAD_REQUEST", "서버 URL이 필요합니다.");
  }

  return {
    id,
    name,
    transport: "http",
    http: {
      url: http.url,
      headers: parseStringRecord(http.headers, "headers"),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function parseServerId(body: unknown): string {
  if (!isRecord(body)) throw new McpError("BAD_REQUEST");
  const { serverId } = body as { serverId?: unknown };
  if (!isNonEmptyString(serverId)) {
    throw new McpError("BAD_REQUEST", "serverId가 필요합니다.");
  }
  return serverId;
}

export function parseToolCallBody(body: unknown): {
  serverId: string;
  name: string;
  args?: Record<string, unknown>;
} {
  if (!isRecord(body)) throw new McpError("BAD_REQUEST");
  const { serverId, name, arguments: args } = body as Record<string, unknown>;

  if (!isNonEmptyString(serverId)) {
    throw new McpError("BAD_REQUEST", "serverId가 필요합니다.");
  }
  if (!isNonEmptyString(name)) {
    throw new McpError("BAD_REQUEST", "name이 필요합니다.");
  }
  if (args !== undefined && !isRecord(args)) {
    throw new McpError("BAD_REQUEST", "arguments 형식이 올바르지 않습니다.");
  }

  return { serverId, name, args: args as Record<string, unknown> | undefined };
}

export function parsePromptGetBody(body: unknown): {
  serverId: string;
  name: string;
  args?: Record<string, string>;
} {
  if (!isRecord(body)) throw new McpError("BAD_REQUEST");
  const { serverId, name, arguments: args } = body as Record<string, unknown>;

  if (!isNonEmptyString(serverId)) {
    throw new McpError("BAD_REQUEST", "serverId가 필요합니다.");
  }
  if (!isNonEmptyString(name)) {
    throw new McpError("BAD_REQUEST", "name이 필요합니다.");
  }

  return {
    serverId,
    name,
    args: parseStringRecord(args, "arguments"),
  };
}

export function parseResourceReadBody(body: unknown): {
  serverId: string;
  uri: string;
} {
  if (!isRecord(body)) throw new McpError("BAD_REQUEST");
  const { serverId, uri } = body as Record<string, unknown>;

  if (!isNonEmptyString(serverId)) {
    throw new McpError("BAD_REQUEST", "serverId가 필요합니다.");
  }
  if (!isNonEmptyString(uri)) {
    throw new McpError("BAD_REQUEST", "uri가 필요합니다.");
  }

  return { serverId, uri };
}
