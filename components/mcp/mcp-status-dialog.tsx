"use client";

import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  Loader2,
  Plug,
  Radio,
  Server,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMcp } from "@/hooks/use-mcp";
import { cn } from "@/lib/utils";
import type {
  McpConnectionState,
  McpConnectionStatus,
  McpServerConfig,
} from "@/lib/types/mcp";

const STATUS_META: Record<
  McpConnectionStatus,
  {
    label: string;
    badge: "default" | "secondary" | "destructive" | "outline";
    dot: string;
  }
> = {
  connected: {
    label: "연결됨",
    badge: "default",
    dot: "bg-emerald-500",
  },
  connecting: {
    label: "연결 중",
    badge: "secondary",
    dot: "bg-amber-400 animate-pulse",
  },
  error: {
    label: "오류",
    badge: "destructive",
    dot: "bg-destructive",
  },
  disconnected: {
    label: "연결 안 됨",
    badge: "outline",
    dot: "bg-muted-foreground/35",
  },
};

function countTools(
  statuses: Record<string, McpConnectionState>,
  servers: McpServerConfig[]
) {
  return servers.reduce((sum, server) => {
    const state = statuses[server.id];
    if (state?.status !== "connected") return sum;
    return sum + (state.capabilities?.tools.length ?? 0);
  }, 0);
}

function StatChip({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl bg-muted/60 px-3 py-2.5">
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="truncate text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function McpStatusDialog() {
  const mcp = useMcp();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const totalTools = countTools(mcp.statuses, mcp.servers);

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) setExpandedId(null);
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            aria-label="MCP 연결 상태 보기"
          />
        }
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            mcp.isLive ? "bg-emerald-500" : "bg-muted-foreground/40"
          )}
          aria-hidden
        />
        <Plug className="size-3.5" />
        MCP
        {mcp.connectedCount > 0 && (
          <Badge variant="secondary" className="h-4 px-1.5">
            {mcp.connectedCount}
          </Badge>
        )}
      </DialogTrigger>

      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="relative overflow-hidden border-b px-5 pt-5 pb-4">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_55%)]"
            aria-hidden
          />
          <DialogHeader className="relative gap-1.5">
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Plug className="size-4" />
              </span>
              MCP 연결 상태
            </DialogTitle>
            <DialogDescription className="flex items-center gap-1.5 text-xs">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  mcp.isLive ? "bg-emerald-500" : "bg-muted-foreground/40"
                )}
                aria-hidden
              />
              {mcp.isLive
                ? "실시간으로 서버 상태를 동기화하고 있어요."
                : "상태 동기화가 끊겼어요. 잠시 후 다시 확인해 주세요."}
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-4 flex gap-2">
            <StatChip
              icon={<Radio className="size-3" />}
              label="연결"
              value={`${mcp.connectedCount}/${mcp.servers.length}`}
            />
            <StatChip
              icon={<Wrench className="size-3" />}
              label="도구"
              value={totalTools}
            />
            <StatChip
              icon={<Server className="size-3" />}
              label="동기화"
              value={mcp.isLive ? "Live" : "Offline"}
            />
          </div>
        </div>

        {mcp.servers.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
              <Server className="size-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">등록된 MCP 서버가 없어요</p>
            <p className="mt-1 text-xs text-muted-foreground">
              서버를 추가하면 여기서 연결과 도구 상태를 확인할 수 있어요.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[min(22rem,50vh)]">
            <ul className="flex flex-col gap-2 p-3" aria-label="MCP 서버 목록">
              {mcp.servers.map((server) => {
                const state = mcp.statuses[server.id] ?? {
                  status: "disconnected" as const,
                };
                const meta = STATUS_META[state.status];
                const tools = state.capabilities?.tools ?? [];
                const prompts = state.capabilities?.prompts.length ?? 0;
                const resources = state.capabilities?.resources.length ?? 0;
                const isConnected = state.status === "connected";
                const isExpanded = expandedId === server.id;

                return (
                  <li
                    key={server.id}
                    className="rounded-xl border bg-card/60 p-3 shadow-xs"
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          meta.dot
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">
                            {server.name}
                          </span>
                          <Badge
                            variant="outline"
                            className="h-4 shrink-0 px-1.5 text-[10px]"
                          >
                            {server.transport === "stdio" ? "STDIO" : "HTTP"}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {server.transport === "stdio"
                            ? server.stdio?.command
                            : server.http?.url}
                        </p>
                        {isConnected && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            도구 {tools.length}
                            {prompts > 0 && ` · 프롬프트 ${prompts}`}
                            {resources > 0 && ` · 리소스 ${resources}`}
                          </p>
                        )}
                        {state.status === "error" && state.error && (
                          <p className="mt-1.5 rounded-lg bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                            {state.error.message}
                          </p>
                        )}
                      </div>
                      <Badge variant={meta.badge} className="shrink-0 gap-1">
                        {state.status === "connecting" && (
                          <Loader2 className="size-3 animate-spin" />
                        )}
                        {meta.label}
                      </Badge>
                    </div>

                    {isConnected && tools.length > 0 && (
                      <div className="mt-2.5 border-t pt-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId((id) =>
                              id === server.id ? null : server.id
                            )
                          }
                          className="flex w-full items-center justify-between rounded-lg px-1.5 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-expanded={isExpanded}
                        >
                          <span className="flex items-center gap-1.5">
                            <Wrench className="size-3" />
                            도구 {tools.length}개
                          </span>
                          <ChevronDown
                            className={cn(
                              "size-3.5 transition-transform duration-200",
                              isExpanded && "rotate-180"
                            )}
                          />
                        </button>
                        {isExpanded && (
                          <ul className="mt-1.5 flex flex-col gap-1">
                            {tools.map((tool) => (
                              <li
                                key={tool.name}
                                className="rounded-lg bg-muted/50 px-2.5 py-2"
                              >
                                <p className="truncate font-mono text-xs font-medium">
                                  {tool.name}
                                </p>
                                {tool.description && (
                                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                                    {tool.description}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {isConnected && tools.length === 0 && (
                      <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                        제공 중인 도구가 없어요.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
