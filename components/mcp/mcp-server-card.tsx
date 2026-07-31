"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Globe,
  Loader2,
  Pencil,
  Plug,
  PlugZap,
  Terminal,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { McpCapabilityPanel } from "@/components/mcp/mcp-capability-panel";
import { useMcp, useMcpServerStatus } from "@/hooks/use-mcp";
import { McpClientError } from "@/lib/mcp/client-api";
import { cn } from "@/lib/utils";
import type { McpConnectionStatus, McpServerConfig } from "@/lib/types/mcp";

const STATUS_LABEL: Record<
  McpConnectionStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    dot: string;
  }
> = {
  connected: {
    label: "연결됨",
    variant: "default",
    dot: "bg-primary",
  },
  connecting: {
    label: "연결 중",
    variant: "secondary",
    dot: "bg-muted-foreground animate-pulse",
  },
  error: {
    label: "오류",
    variant: "destructive",
    dot: "bg-destructive",
  },
  disconnected: {
    label: "연결 안 됨",
    variant: "outline",
    dot: "bg-muted-foreground/40",
  },
};

interface McpServerCardProps {
  server: McpServerConfig;
  onEdit: () => void;
}

export function McpServerCard({ server, onEdit }: McpServerCardProps) {
  const mcp = useMcp();
  const status = useMcpServerStatus(server.id);
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isConnected = status.status === "connected";
  const isConnecting = status.status === "connecting";
  const isStdio = server.transport === "stdio";

  const handleToggleConnection = async () => {
    setActionError(null);
    setIsBusy(true);
    try {
      if (isConnected) {
        await mcp.disconnect(server.id);
      } else {
        await mcp.connect(server.id);
        setExpanded(true);
      }
    } catch (error) {
      setActionError(
        error instanceof McpClientError
          ? error.message
          : "요청을 처리하지 못했어요."
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    setIsBusy(true);
    try {
      await mcp.removeServer(server.id);
    } finally {
      setIsBusy(false);
    }
  };

  const statusInfo = STATUS_LABEL[status.status];

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow",
        isConnected && "border-primary/25 shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_12%,transparent)]"
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            isConnected
              ? "bg-accent text-accent-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {isStdio ? (
            <Terminal className="size-5" />
          ) : (
            <Globe className="size-5" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="truncate text-sm font-semibold">{server.name}</h2>
            <Badge variant="outline" className="shrink-0 gap-1 font-normal">
              {isStdio ? (
                <Terminal className="size-3" />
              ) : (
                <Globe className="size-3" />
              )}
              {isStdio ? "STDIO" : "HTTP"}
            </Badge>
            <Badge variant={statusInfo.variant} className="shrink-0 gap-1.5">
              {isConnecting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <span
                  className={cn("size-1.5 rounded-full", statusInfo.dot)}
                  aria-hidden
                />
              )}
              {statusInfo.label}
            </Badge>
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {isStdio ? server.stdio?.command : server.http?.url}
          </p>
          {status.serverInfo && (
            <p className="truncate text-xs text-muted-foreground">
              {status.serverInfo.name}{" "}
              <span className="opacity-70">v{status.serverInfo.version}</span>
            </p>
          )}
          {isConnected && status.capabilities && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <CapabilityChip
                label="도구"
                count={status.capabilities.tools.length}
              />
              <CapabilityChip
                label="프롬프트"
                count={status.capabilities.prompts.length}
              />
              <CapabilityChip
                label="리소스"
                count={status.capabilities.resources.length}
              />
            </div>
          )}
        </div>
      </div>

      {status.status === "error" && status.error && (
        <p className="mx-4 mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {status.error.message}
        </p>
      )}
      {actionError && (
        <p className="mx-4 mb-3 text-xs text-destructive">{actionError}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5 border-t bg-muted/30 px-3 py-2.5">
        <Button
          size="sm"
          variant={isConnected ? "outline" : "default"}
          onClick={() => void handleToggleConnection()}
          disabled={isBusy || isConnecting}
          className="gap-1.5"
        >
          {isBusy || isConnecting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : isConnected ? (
            <Plug className="size-3.5" />
          ) : (
            <PlugZap className="size-3.5" />
          )}
          {isConnected ? "연결 해제" : "연결"}
        </Button>

        {isConnected && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded((prev) => !prev)}
            className="gap-1.5"
          >
            {expanded ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
            {expanded ? "접기" : "기능 보기"}
          </Button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={onEdit}
            disabled={isBusy}
            className="gap-1.5"
          >
            <Pencil className="size-3.5" />
            수정
          </Button>

          {confirmingDelete ? (
            <span className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">삭제할까요?</span>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void handleDelete()}
                disabled={isBusy}
                className="gap-1.5"
              >
                <Trash2 className="size-3.5" />
                삭제
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmingDelete(false)}
              >
                취소
              </Button>
            </span>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="size-3.5" />
              삭제
            </Button>
          )}
        </div>
      </div>

      {expanded && isConnected && (
        <div className="border-t bg-background px-4 py-3">
          <McpCapabilityPanel
            serverId={server.id}
            capabilities={status.capabilities}
          />
        </div>
      )}
    </article>
  );
}

function CapabilityChip({ label, count }: { label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
      {label}
      <span className="font-medium text-foreground tabular-nums">{count}</span>
    </span>
  );
}
