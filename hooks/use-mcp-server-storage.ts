"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { SetStateAction } from "react";

import {
  EMPTY_MCP_SNAPSHOT,
  getStoredMcpSnapshot,
  saveMcpSnapshot,
  type McpServerSnapshot,
} from "@/lib/storage/mcp-storage";
import type { McpServerConfig } from "@/lib/types/mcp";

const subscribe = () => () => {};
const getServerSnapshot = () => EMPTY_MCP_SNAPSHOT;

/**
 * MCP 서버 "등록 정보"를 localStorage와 동기화한다.
 * 실시간 연결 상태(Tools/Prompts/Resources 등)는 다루지 않는다. 그건 McpProvider의 역할이다.
 */
export function useMcpServerStorage() {
  const restored = useSyncExternalStore(
    subscribe,
    getStoredMcpSnapshot,
    getServerSnapshot
  );
  const [edited, setEdited] = useState<McpServerSnapshot | null>(null);
  const snapshot = edited ?? restored;

  useEffect(() => {
    if (!edited) return;
    saveMcpSnapshot(edited);
  }, [edited]);

  const setServers = useCallback(
    (update: SetStateAction<McpServerConfig[]>) => {
      setEdited((prev) => {
        const base = prev ?? getStoredMcpSnapshot();
        return {
          ...base,
          servers:
            typeof update === "function" ? update(base.servers) : update,
        };
      });
    },
    []
  );

  const upsertServer = useCallback(
    (server: McpServerConfig) => {
      setServers((prev) => {
        const exists = prev.some((s) => s.id === server.id);
        return exists
          ? prev.map((s) => (s.id === server.id ? server : s))
          : [...prev, server];
      });
    },
    [setServers]
  );

  const removeServer = useCallback(
    (id: string) => {
      setServers((prev) => prev.filter((s) => s.id !== id));
    },
    [setServers]
  );

  const replaceServers = useCallback(
    (servers: McpServerConfig[]) => {
      setServers(servers);
    },
    [setServers]
  );

  return {
    servers: snapshot.servers,
    upsertServer,
    removeServer,
    replaceServers,
  };
}
