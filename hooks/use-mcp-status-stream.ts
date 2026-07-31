"use client";

import { useEffect, useState } from "react";

import type { McpConnectionState, McpStatusEvent } from "@/lib/types/mcp";

interface McpStatusStreamHandlers {
  /** 스트림이 (재)연결될 때마다 서버가 보내는 전체 상태. 여기 없는 서버는 연결 해제 상태다. */
  onSnapshot: (statuses: Record<string, McpConnectionState>) => void;
  onUpdate: (serverId: string, state: McpConnectionState) => void;
}

function parseEvent(raw: string): McpStatusEvent | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const type = (parsed as { type?: unknown }).type;
    if (type !== "snapshot" && type !== "update") return null;
    return parsed as McpStatusEvent;
  } catch {
    return null;
  }
}

/**
 * `/api/mcp/events` SSE를 구독해 서버 쪽 연결 상태 변화를 실시간으로 받는다.
 * 핸들러는 안정적인 참조여야 한다(useCallback). 반환값은 스트림이 살아있는지 여부다.
 */
export function useMcpStatusStream({
  onSnapshot,
  onUpdate,
}: McpStatusStreamHandlers): boolean {
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const source = new EventSource("/api/mcp/events");

    source.onopen = () => setIsLive(true);
    // EventSource가 알아서 재연결한다. 재연결되면 새 스냅샷으로 다시 동기화된다.
    source.onerror = () => setIsLive(false);
    source.onmessage = (event: MessageEvent<string>) => {
      const parsed = parseEvent(event.data);
      if (!parsed) return;
      if (parsed.type === "snapshot") onSnapshot(parsed.statuses);
      else onUpdate(parsed.serverId, parsed.state);
    };

    return () => source.close();
  }, [onSnapshot, onUpdate]);

  return isLive;
}
