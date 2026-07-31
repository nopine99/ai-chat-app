"use client";

import { createContext, useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  McpClientError,
  callServerTool,
  connectServer,
  disconnectServer,
  getServerPrompt,
  readServerResource,
  refreshServerCapabilities,
} from "@/lib/mcp/client-api";
import { useMcpServerStorage } from "@/hooks/use-mcp-server-storage";
import { useMcpStatusStream } from "@/hooks/use-mcp-status-stream";
import type { McpConnectionState, McpServerConfig } from "@/lib/types/mcp";

export interface McpContextValue {
  servers: McpServerConfig[];
  statuses: Record<string, McpConnectionState>;
  connectedCount: number;
  /** 서버 상태 스트림이 살아있는지. false면 화면의 상태가 최신이 아닐 수 있다. */
  isLive: boolean;
  upsertServer: (server: McpServerConfig) => void;
  removeServer: (id: string) => Promise<void>;
  replaceServers: (servers: McpServerConfig[]) => void;
  connect: (id: string) => Promise<void>;
  disconnect: (id: string) => Promise<void>;
  refreshCapabilities: (id: string) => Promise<void>;
  callTool: (
    id: string,
    name: string,
    args?: Record<string, unknown>
  ) => Promise<unknown>;
  getPrompt: (
    id: string,
    name: string,
    args?: Record<string, string>
  ) => Promise<unknown>;
  readResource: (id: string, uri: string) => Promise<unknown>;
}

export const McpContext = createContext<McpContextValue | null>(null);

const DISCONNECTED: McpConnectionState = { status: "disconnected" };

export function McpProvider({ children }: { children: ReactNode }) {
  const storage = useMcpServerStorage();
  const [statuses, setStatuses] = useState<Record<string, McpConnectionState>>(
    {}
  );

  const setStatus = useCallback((id: string, state: McpConnectionState) => {
    setStatuses((prev) => ({ ...prev, [id]: state }));
  }, []);

  // 서버 프로세스가 실제로 들고 있는 연결이 유일한 진실이다.
  // 스냅샷에 없는 서버는 연결이 끊긴 것으로 보되, 아직 결과가 없는 로컬 진행/실패 상태는 남긴다.
  const applySnapshot = useCallback(
    (snapshot: Record<string, McpConnectionState>) => {
      setStatuses((prev) => {
        const next: Record<string, McpConnectionState> = { ...snapshot };
        for (const [id, state] of Object.entries(prev)) {
          const isLocalOnly =
            state.status === "connecting" || state.status === "error";
          if (!(id in next) && isLocalOnly) next[id] = state;
        }
        return next;
      });
    },
    []
  );

  const isLive = useMcpStatusStream({
    onSnapshot: applySnapshot,
    onUpdate: setStatus,
  });

  const handleDisconnectedError = useCallback(
    (id: string, error: unknown) => {
      if (error instanceof McpClientError && error.code === "NOT_CONNECTED") {
        setStatus(id, DISCONNECTED);
      }
    },
    [setStatus]
  );

  const connect = useCallback(
    async (id: string) => {
      const server = storage.servers.find((s) => s.id === id);
      if (!server) {
        throw new McpClientError({
          code: "BAD_REQUEST",
          message: "등록되지 않은 서버입니다.",
        });
      }

      setStatus(id, { status: "connecting" });
      try {
        const state = await connectServer(server);
        setStatus(id, state);
      } catch (error) {
        const mcpError =
          error instanceof McpClientError
            ? error
            : new McpClientError({
                code: "UPSTREAM_ERROR",
                message: "연결에 실패했어요.",
              });
        setStatus(id, {
          status: "error",
          error: { code: mcpError.code, message: mcpError.message },
        });
        throw mcpError;
      }
    },
    [storage.servers, setStatus]
  );

  const disconnect = useCallback(
    async (id: string) => {
      try {
        await disconnectServer(id);
      } finally {
        setStatus(id, DISCONNECTED);
      }
    },
    [setStatus]
  );

  const refreshCapabilities = useCallback(async (id: string) => {
    const { capabilities } = await refreshServerCapabilities(id);
    setStatuses((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { status: "connected" }), capabilities },
    }));
  }, []);

  const callTool = useCallback(
    async (id: string, name: string, args?: Record<string, unknown>) => {
      try {
        const { result } = await callServerTool(id, name, args);
        return result;
      } catch (error) {
        handleDisconnectedError(id, error);
        throw error;
      }
    },
    [handleDisconnectedError]
  );

  const getPrompt = useCallback(
    async (id: string, name: string, args?: Record<string, string>) => {
      try {
        const { result } = await getServerPrompt(id, name, args);
        return result;
      } catch (error) {
        handleDisconnectedError(id, error);
        throw error;
      }
    },
    [handleDisconnectedError]
  );

  const readResource = useCallback(
    async (id: string, uri: string) => {
      try {
        const { result } = await readServerResource(id, uri);
        return result;
      } catch (error) {
        handleDisconnectedError(id, error);
        throw error;
      }
    },
    [handleDisconnectedError]
  );

  const removeServer = useCallback(
    async (id: string) => {
      try {
        await disconnectServer(id);
      } catch {
        // 이미 끊겨 있거나 서버가 응답하지 않아도 로컬 등록은 지운다.
      }
      setStatuses((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      storage.removeServer(id);
    },
    [storage]
  );

  const connectedCount = useMemo(
    () =>
      storage.servers.filter(
        (server) => statuses[server.id]?.status === "connected"
      ).length,
    [storage.servers, statuses]
  );

  const value = useMemo<McpContextValue>(
    () => ({
      servers: storage.servers,
      statuses,
      connectedCount,
      isLive,
      upsertServer: storage.upsertServer,
      removeServer,
      replaceServers: storage.replaceServers,
      connect,
      disconnect,
      refreshCapabilities,
      callTool,
      getPrompt,
      readResource,
    }),
    [
      storage.servers,
      storage.upsertServer,
      storage.replaceServers,
      statuses,
      connectedCount,
      isLive,
      removeServer,
      connect,
      disconnect,
      refreshCapabilities,
      callTool,
      getPrompt,
      readResource,
    ]
  );

  return <McpContext.Provider value={value}>{children}</McpContext.Provider>;
}
