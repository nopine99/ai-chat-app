"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMcp } from "@/hooks/use-mcp";
import type { McpServerConfig, McpTransportKind } from "@/lib/types/mcp";

interface McpServerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingServer?: McpServerConfig;
}

interface KeyValueRow {
  id: string;
  key: string;
  value: string;
}

function createEmptyRow(): KeyValueRow {
  return { id: crypto.randomUUID(), key: "", value: "" };
}

function recordToRows(record: Record<string, string> | undefined): KeyValueRow[] {
  const entries = Object.entries(record ?? {});
  if (entries.length === 0) return [createEmptyRow()];
  return entries.map(([key, value]) => ({ id: crypto.randomUUID(), key, value }));
}

function rowsToRecord(rows: KeyValueRow[]): Record<string, string> | undefined {
  const result: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    result[key] = row.value;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function recordToLines(record: Record<string, string> | undefined): string {
  return Object.entries(record ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function linesToRecord(text: string): Record<string, string> | undefined {
  const result: Record<string, string> = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function linesToArray(text: string): string[] | undefined {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : undefined;
}

export function McpServerFormDialog({
  open,
  onOpenChange,
  editingServer,
}: McpServerFormDialogProps) {
  const mcp = useMcp();

  // 부모가 서버 추가/수정 대상이 바뀔 때마다 다른 key로 이 컴포넌트를 새로 마운트해준다.
  // 그래서 폼 상태는 아래처럼 최초 렌더 시 props 기준으로 한 번만 초기화하면 된다.
  const [name, setName] = useState(editingServer?.name ?? "");
  const [transport, setTransport] = useState<McpTransportKind>(
    editingServer?.transport ?? "stdio"
  );
  const [command, setCommand] = useState(editingServer?.stdio?.command ?? "");
  const [argsText, setArgsText] = useState(
    (editingServer?.stdio?.args ?? []).join("\n")
  );
  const [envText, setEnvText] = useState(
    recordToLines(editingServer?.stdio?.env)
  );
  const [cwd, setCwd] = useState(editingServer?.stdio?.cwd ?? "");
  const [url, setUrl] = useState(editingServer?.http?.url ?? "");
  const [headerRows, setHeaderRows] = useState<KeyValueRow[]>(() =>
    recordToRows(editingServer?.http?.headers)
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    if (transport === "stdio" && !command.trim()) {
      setError("실행 명령어(command)를 입력해주세요.");
      return;
    }
    if (transport === "http" && !url.trim()) {
      setError("서버 URL을 입력해주세요.");
      return;
    }

    const now = new Date().toISOString();
    const base = {
      id: editingServer?.id ?? crypto.randomUUID(),
      name: name.trim(),
      createdAt: editingServer?.createdAt ?? now,
      updatedAt: now,
    };

    const server: McpServerConfig =
      transport === "stdio"
        ? {
            ...base,
            transport: "stdio",
            stdio: {
              command: command.trim(),
              args: linesToArray(argsText),
              env: linesToRecord(envText),
              cwd: cwd.trim() || undefined,
            },
          }
        : {
            ...base,
            transport: "http",
            http: {
              url: url.trim(),
              headers: rowsToRecord(headerRows),
            },
          };

    mcp.upsertServer(server);
    onOpenChange(false);
  };

  const updateHeaderRow = (id: string, field: "key" | "value", value: string) => {
    setHeaderRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const addHeaderRow = () => {
    setHeaderRows((prev) => [...prev, createEmptyRow()]);
  };

  const removeHeaderRow = (id: string) => {
    setHeaderRows((prev) => {
      const next = prev.filter((row) => row.id !== id);
      return next.length > 0 ? next : [createEmptyRow()];
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingServer ? "서버 수정" : "MCP 서버 추가"}</DialogTitle>
          <DialogDescription>
            등록 정보는 Supabase에 저장돼요.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mcp-server-name">이름</Label>
            <Input
              id="mcp-server-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 로컬 파일시스템 서버"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mcp-server-transport">연결 방식</Label>
            <Select
              value={transport}
              onValueChange={(value) => setTransport(value as McpTransportKind)}
            >
              <SelectTrigger id="mcp-server-transport" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stdio">STDIO (로컬 프로세스 실행)</SelectItem>
                <SelectItem value="http">Streamable HTTP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {transport === "stdio" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mcp-server-command">실행 명령어</Label>
                <Input
                  id="mcp-server-command"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="npx"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mcp-server-args">인자 (한 줄에 하나씩)</Label>
                <Textarea
                  id="mcp-server-args"
                  rows={3}
                  value={argsText}
                  onChange={(e) => setArgsText(e.target.value)}
                  placeholder={"-y\n@modelcontextprotocol/server-filesystem\n/path/to/dir"}
                  className="font-mono text-xs"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mcp-server-cwd">작업 디렉터리 (선택)</Label>
                <Input
                  id="mcp-server-cwd"
                  value={cwd}
                  onChange={(e) => setCwd(e.target.value)}
                  placeholder="비워두면 현재 서버 프로세스 경로를 사용해요"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mcp-server-env">환경 변수 (KEY=VALUE, 한 줄에 하나씩)</Label>
                <Textarea
                  id="mcp-server-env"
                  rows={3}
                  value={envText}
                  onChange={(e) => setEnvText(e.target.value)}
                  placeholder={"API_KEY=..."}
                  className="font-mono text-xs"
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mcp-server-url">서버 URL</Label>
                <Input
                  id="mcp-server-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="http://localhost:3000/mcp"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>요청 헤더 (선택)</Label>
                <div className="flex flex-col gap-2">
                  {headerRows.map((row) => (
                    <div key={row.id} className="flex items-center gap-1.5">
                      <Input
                        aria-label="헤더 키"
                        value={row.key}
                        onChange={(e) =>
                          updateHeaderRow(row.id, "key", e.target.value)
                        }
                        placeholder="Authorization"
                        className="font-mono text-xs"
                      />
                      <Input
                        aria-label="헤더 값"
                        value={row.value}
                        onChange={(e) =>
                          updateHeaderRow(row.id, "value", e.target.value)
                        }
                        placeholder="Bearer ..."
                        className="font-mono text-xs"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="헤더 삭제"
                        onClick={() => removeHeaderRow(row.id)}
                      >
                        <Trash2 className="text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={addHeaderRow}
                >
                  <Plus />
                  헤더 추가
                </Button>
              </div>
            </>
          )}

          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
            토큰·API 키 같은 민감한 값은 Supabase에 평문으로 저장돼요. 공용 기기에서는 등록을 피해주세요.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSubmit}>{editingServer ? "저장" : "추가"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
