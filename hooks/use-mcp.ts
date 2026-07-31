"use client";

import { useContext } from "react";

import { McpContext } from "@/components/mcp/mcp-provider";
import type { McpConnectionState } from "@/lib/types/mcp";

const DISCONNECTED: McpConnectionState = { status: "disconnected" };

/** 앱 전체에서 공유되는 MCP 서버 등록/연결 상태에 접근한다. */
export function useMcp() {
  const context = useContext(McpContext);
  if (!context) {
    throw new Error("useMcp은 McpProvider 내부에서만 사용할 수 있어요.");
  }
  return context;
}

/** 특정 서버의 연결 상태만 구독한다. 상태가 없으면 disconnected로 취급한다. */
export function useMcpServerStatus(serverId: string): McpConnectionState {
  const { statuses } = useMcp();
  return statuses[serverId] ?? DISCONNECTED;
}
