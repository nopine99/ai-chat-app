"use client";

import { useState, type ReactNode } from "react";
import { Cable, Plus, Server } from "lucide-react";

import { Button } from "@/components/ui/button";
import { McpImportExportButtons } from "@/components/mcp/mcp-import-export-buttons";
import { McpServerCard } from "@/components/mcp/mcp-server-card";
import { McpServerFormDialog } from "@/components/mcp/mcp-server-form-dialog";
import { useMcp } from "@/hooks/use-mcp";
import { cn } from "@/lib/utils";
import type { McpServerConfig } from "@/lib/types/mcp";

export function McpManager() {
  const mcp = useMcp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<
    McpServerConfig | undefined
  >(undefined);
  // 폼 다이얼로그를 열 때마다 값을 바꿔, 대상이 바뀌면 다이얼로그 내부 상태가 확실히 새로 초기화되게 한다.
  const [formInstanceKey, setFormInstanceKey] = useState(0);

  const openCreateDialog = () => {
    setEditingServer(undefined);
    setFormInstanceKey((key) => key + 1);
    setDialogOpen(true);
  };

  const openEditDialog = (server: McpServerConfig) => {
    setEditingServer(server);
    setFormInstanceKey((key) => key + 1);
    setDialogOpen(true);
  };

  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:py-8">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-3 py-1 text-xs text-muted-foreground shadow-sm">
            <span
              className={cn(
                "size-1.5 rounded-full",
                mcp.isLive ? "bg-primary animate-pulse" : "bg-muted-foreground/40"
              )}
              aria-hidden
            />
            {mcp.isLive ? "실시간 동기화 중" : "상태 동기화 끊김"}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              MCP 서버 관리
            </h1>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
              도구·프롬프트·리소스를 제공하는 MCP 서버를 연결하고 관리하세요.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatPill
              icon={<Server className="size-3.5" />}
              label="등록"
              value={mcp.servers.length}
            />
            <StatPill
              icon={<Cable className="size-3.5" />}
              label="연결됨"
              value={mcp.connectedCount}
              accent
            />
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <McpImportExportButtons />
          <Button onClick={openCreateDialog} className="gap-1.5 shadow-sm">
            <Plus className="size-4" />
            서버 추가
          </Button>
        </div>
      </section>

      {mcp.servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/80 bg-card/50 px-6 py-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-sm">
            <Server className="size-6" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">등록된 MCP 서버가 없어요</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              서버를 추가하면 채팅에서 도구를 바로 사용할 수 있어요.
            </p>
          </div>
          <Button onClick={openCreateDialog} className="gap-1.5">
            <Plus className="size-4" />
            첫 서버 추가하기
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {mcp.servers.map((server) => (
            <McpServerCard
              key={server.id}
              server={server}
              onEdit={() => openEditDialog(server)}
            />
          ))}
        </div>
      )}

      <McpServerFormDialog
        key={formInstanceKey}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingServer={editingServer}
      />
    </div>
  );
}

function StatPill({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs shadow-sm",
        accent
          ? "border-primary/20 bg-accent text-accent-foreground"
          : "border-border/70 bg-card text-muted-foreground"
      )}
    >
      {icon}
      <span>{label}</span>
      <span className="font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  );
}
