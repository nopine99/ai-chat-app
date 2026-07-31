import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { ListChangedHandlers } from "@modelcontextprotocol/sdk/types.js";

import { McpError } from "@/lib/mcp/errors";
import type {
  McpConnectionState,
  McpServerCapabilities,
  McpServerConfig,
  McpServerInfo,
} from "@/lib/types/mcp";

const CONNECT_TIMEOUT_MS = 15_000;
const CALL_TIMEOUT_MS = 30_000;
/**
 * STDIO는 프로세스가 죽으면 transport가 바로 닫히지만, Streamable HTTP는 상대가 사라져도
 * 다음 요청 전까지 알 수 없다. 주기적인 ping으로 끊긴 연결을 스스로 찾아낸다.
 */
const HEALTH_CHECK_INTERVAL_MS = 20_000;
const PING_TIMEOUT_MS = 5_000;

interface ManagedConnection {
  client: Client;
  state: McpConnectionState;
  healthCheck: ReturnType<typeof setInterval>;
}

const DISCONNECTED: McpConnectionState = { status: "disconnected" };

type StateListener = (serverId: string, state: McpConnectionState) => void;

/**
 * MCP 서버와의 살아있는 연결(Client + 하위 프로세스/소켓)을 Node 프로세스 메모리에 보관한다.
 * 서버는 등록 정보를 저장하지 않는다. 클라이언트가 connect 때마다 설정을 함께 보낸다.
 * 프로세스가 재시작되면(dev 서버 재기동, 서버리스 콜드 스타트 등) 연결은 모두 사라진다.
 */
class McpConnectionManager {
  private connections = new Map<string, ManagedConnection>();
  private listeners = new Set<StateListener>();

  /** 현재 살아있는 모든 연결의 상태. 여기에 없는 서버는 연결되지 않은 것이다. */
  snapshot(): Record<string, McpConnectionState> {
    const result: Record<string, McpConnectionState> = {};
    for (const [id, connection] of this.connections) result[id] = connection.state;
    return result;
  }

  /** 연결 상태 변화를 구독한다. SSE 라우트가 이 스트림을 클라이언트로 중계한다. */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async connect(config: McpServerConfig): Promise<McpConnectionState> {
    await this.disconnect(config.id);

    const transport = buildTransport(config);
    const client = new Client(
      { name: "ai-memo-app", version: "0.1.0" },
      { listChanged: this.buildListChangedHandlers(config.id) }
    );

    // 서버 프로세스 종료·HTTP 세션 만료 등으로 전송 계층이 닫히면 즉시 상태를 정리한다.
    client.onclose = () => {
      this.forget(config.id, client);
    };
    client.onerror = (error) => {
      console.error("[mcp] transport error", error.message);
    };

    try {
      await client.connect(transport, { timeout: CONNECT_TIMEOUT_MS });
    } catch (error) {
      throw toConnectionError(error);
    }

    const capabilities = await this.fetchCapabilities(client);
    const state: McpConnectionState = {
      status: "connected",
      connectedAt: new Date().toISOString(),
      serverInfo: toServerInfo(client.getServerVersion()),
      capabilities,
    };

    const healthCheck = setInterval(() => {
      void this.checkHealth(config.id, client);
    }, HEALTH_CHECK_INTERVAL_MS);
    healthCheck.unref?.();

    this.connections.set(config.id, { client, state, healthCheck });
    this.emit(config.id, state);
    return state;
  }

  async disconnect(id: string): Promise<void> {
    const existing = this.connections.get(id);
    if (!existing) return;

    this.forget(id, existing.client);
    try {
      await existing.client.close();
    } catch {
      // 이미 죽은 프로세스/소켓일 수 있다. 종료 실패는 무시한다.
    }
  }

  async refresh(id: string): Promise<McpServerCapabilities> {
    const connection = this.requireConnection(id);
    const capabilities = await this.fetchCapabilities(connection.client);
    connection.state = { ...connection.state, capabilities };
    this.emit(id, connection.state);
    return capabilities;
  }

  async callTool(id: string, name: string, args?: Record<string, unknown>) {
    const connection = this.requireConnection(id);
    try {
      return await connection.client.callTool(
        { name, arguments: args },
        undefined,
        { timeout: CALL_TIMEOUT_MS }
      );
    } catch (error) {
      throw toCallError(error);
    }
  }

  async getPrompt(id: string, name: string, args?: Record<string, string>) {
    const connection = this.requireConnection(id);
    try {
      return await connection.client.getPrompt(
        { name, arguments: args },
        { timeout: CALL_TIMEOUT_MS }
      );
    } catch (error) {
      throw toCallError(error);
    }
  }

  async readResource(id: string, uri: string) {
    const connection = this.requireConnection(id);
    try {
      return await connection.client.readResource(
        { uri },
        { timeout: CALL_TIMEOUT_MS }
      );
    } catch (error) {
      throw toCallError(error);
    }
  }

  private emit(id: string, state: McpConnectionState): void {
    for (const listener of this.listeners) {
      try {
        listener(id, state);
      } catch (error) {
        console.error(
          "[mcp] state listener failed",
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  /**
   * 등록된 연결을 정리하고 끊김을 알린다.
   * 이미 교체·정리된 클라이언트의 뒤늦은 onclose가 새 연결 상태를 덮어쓰지 않도록,
   * 지금 등록된 클라이언트와 같을 때만 동작한다.
   */
  private forget(id: string, client: Client): boolean {
    const connection = this.connections.get(id);
    if (connection?.client !== client) return false;

    clearInterval(connection.healthCheck);
    this.connections.delete(id);
    this.emit(id, DISCONNECTED);
    return true;
  }

  private async checkHealth(id: string, client: Client): Promise<void> {
    if (this.connections.get(id)?.client !== client) return;

    try {
      await client.ping({ timeout: PING_TIMEOUT_MS });
    } catch {
      if (!this.forget(id, client)) return;
      try {
        await client.close();
      } catch {
        // 이미 끊긴 연결이다.
      }
    }
  }

  /** 서버가 list_changed 알림을 보내면 SDK가 목록을 다시 받아오고, 그 결과를 상태에 반영한다. */
  private buildListChangedHandlers(id: string): ListChangedHandlers {
    return {
      tools: {
        onChanged: (error, tools) => {
          if (error || !tools) return;
          this.patchCapabilities(id, { tools });
        },
      },
      prompts: {
        onChanged: (error, prompts) => {
          if (error || !prompts) return;
          this.patchCapabilities(id, { prompts });
        },
      },
      resources: {
        onChanged: (error, resources) => {
          if (error || !resources) return;
          this.patchCapabilities(id, { resources });
        },
      },
    };
  }

  private patchCapabilities(
    id: string,
    patch: Partial<McpServerCapabilities>
  ): void {
    const connection = this.connections.get(id);
    if (!connection) return;

    const current = connection.state.capabilities;
    const next: McpServerCapabilities = {
      tools: patch.tools ?? current?.tools ?? [],
      prompts: patch.prompts ?? current?.prompts ?? [],
      resources: patch.resources ?? current?.resources ?? [],
    };
    // 내용이 같은 알림으로 클라이언트를 깨우지 않는다.
    if (JSON.stringify(current) === JSON.stringify(next)) return;

    connection.state = { ...connection.state, capabilities: next };
    this.emit(id, connection.state);
  }

  private requireConnection(id: string): ManagedConnection {
    const connection = this.connections.get(id);
    if (!connection || connection.state.status !== "connected") {
      throw new McpError("NOT_CONNECTED");
    }
    return connection;
  }

  private async fetchCapabilities(
    client: Client
  ): Promise<McpServerCapabilities> {
    const caps = client.getServerCapabilities();

    const [tools, prompts, resources] = await Promise.all([
      caps?.tools
        ? safeList(() => client.listTools()).then((r) => r?.tools ?? [])
        : Promise.resolve([]),
      caps?.prompts
        ? safeList(() => client.listPrompts()).then((r) => r?.prompts ?? [])
        : Promise.resolve([]),
      caps?.resources
        ? safeList(() => client.listResources()).then(
            (r) => r?.resources ?? []
          )
        : Promise.resolve([]),
    ]);

    return { tools, prompts, resources };
  }
}

async function safeList<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    console.error(
      "[mcp] capability list failed",
      error instanceof Error ? error.message : error
    );
    return undefined;
  }
}

function buildTransport(config: McpServerConfig): Transport {
  if (config.transport === "stdio") {
    if (!config.stdio?.command?.trim()) {
      throw new McpError("BAD_REQUEST", "실행 명령어(command)가 필요합니다.");
    }
    return new StdioClientTransport({
      command: config.stdio.command,
      args: config.stdio.args,
      env: config.stdio.env,
      cwd: config.stdio.cwd,
    });
  }

  if (config.transport === "http") {
    const url = parseHttpUrl(config.http?.url);
    return new StreamableHTTPClientTransport(url, {
      requestInit: config.http?.headers
        ? { headers: config.http.headers }
        : undefined,
    });
  }

  throw new McpError("BAD_REQUEST", "지원하지 않는 transport입니다.");
}

function parseHttpUrl(raw: string | undefined): URL {
  if (!raw?.trim()) {
    throw new McpError("BAD_REQUEST", "서버 URL이 필요합니다.");
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new McpError("BAD_REQUEST", "URL 형식이 올바르지 않습니다.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new McpError("BAD_REQUEST", "http:// 또는 https:// URL만 지원합니다.");
  }

  return url;
}

function toServerInfo(
  info: { name: string; version: string } | undefined
): McpServerInfo | undefined {
  return info ? { name: info.name, version: info.version } : undefined;
}

function isTimeoutError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const message = (error as { message?: unknown }).message;
  return (
    typeof message === "string" && message.toLowerCase().includes("timed out")
  );
}

function toConnectionError(error: unknown): McpError {
  if (error instanceof McpError) return error;
  if (isTimeoutError(error)) return new McpError("TIMEOUT");
  console.error(
    "[mcp] connect failed",
    error instanceof Error ? error.message : error
  );
  return new McpError("CONNECTION_FAILED");
}

function toCallError(error: unknown): McpError {
  if (error instanceof McpError) return error;
  if (isTimeoutError(error)) return new McpError("TIMEOUT");
  console.error(
    "[mcp] request failed",
    error instanceof Error ? error.message : error
  );
  return new McpError("UPSTREAM_ERROR");
}

const globalForMcp = globalThis as unknown as {
  __mcpConnectionManager?: unknown;
};

/**
 * HMR로 캐시된 인스턴스가 지금 코드의 인터페이스를 모두 갖췄는지 본다.
 * 매니저를 수정하면 예전 인스턴스에는 새 메서드가 없어 라우트가 런타임에 깨지므로,
 * 그럴 때는 캐시를 버리고 새로 만든다(당시 열려 있던 연결은 함께 버려진다).
 */
function reuseCachedManager(): McpConnectionManager | undefined {
  const cached = globalForMcp.__mcpConnectionManager;
  if (typeof cached !== "object" || cached === null) return undefined;

  const candidate = cached as Record<string, unknown>;
  const isCompatible = Object.getOwnPropertyNames(
    McpConnectionManager.prototype
  )
    .filter((name) => name !== "constructor")
    .every((name) => typeof candidate[name] === "function");

  return isCompatible ? (cached as McpConnectionManager) : undefined;
}

/**
 * Next.js dev 서버는 파일 변경 시 라우트 모듈을 다시 평가할 수 있다.
 * globalThis에 캐시해 HMR로 인해 매니저 인스턴스(=열려있는 연결들)가 유실되지 않게 한다.
 */
export const mcpManager = reuseCachedManager() ?? new McpConnectionManager();

if (process.env.NODE_ENV !== "production") {
  globalForMcp.__mcpConnectionManager = mcpManager;
}
