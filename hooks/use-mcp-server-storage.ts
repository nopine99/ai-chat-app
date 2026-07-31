"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";

import {
  EMPTY_MCP_SNAPSHOT,
  fetchMcpSnapshot,
  saveMcpSnapshot,
  type McpServerSnapshot,
} from "@/lib/storage/mcp-storage";
import type { McpServerConfig } from "@/lib/types/mcp";

const SAVE_DEBOUNCE_MS = 400;

/**
 * MCP 서버 "등록 정보"를 Supabase와 동기화한다.
 * 실시간 연결 상태(Tools/Prompts/Resources 등)는 다루지 않는다. 그건 McpProvider의 역할이다.
 */
export function useMcpServerStorage() {
  const [snapshot, setSnapshot] =
    useState<McpServerSnapshot>(EMPTY_MCP_SNAPSHOT);
  const [hydrated, setHydrated] = useState(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void fetchMcpSnapshot().then((next) => {
      if (cancelled) return;
      setSnapshot(next);
      setHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !dirtyRef.current) return;

    const timer = window.setTimeout(() => {
      void saveMcpSnapshot(snapshot);
    }, SAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [snapshot, hydrated]);

  const setServers = useCallback(
    (update: SetStateAction<McpServerConfig[]>) => {
      dirtyRef.current = true;
      setSnapshot((prev) => ({
        ...prev,
        servers: typeof update === "function" ? update(prev.servers) : update,
      }));
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
