"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Download, FileUp, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMcp } from "@/hooks/use-mcp";
import { exportMcpSnapshot, parseImportedSnapshot } from "@/lib/storage/mcp-storage";
import { cn } from "@/lib/utils";

export function McpImportExportButtons() {
  const mcp = useMcp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleExport = () => {
    const json = exportMcpSnapshot(mcp.servers);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mcp-servers-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const servers = parseImportedSnapshot(text);
      for (const server of servers) mcp.upsertServer(server);
      setMessage({
        type: "success",
        text: `${servers.length}개 서버를 가져왔어요.`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error ? error.message : "가져오기에 실패했어요.",
      });
    }
  };

  return (
    <div className="flex flex-col gap-1.5 sm:items-end">
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={mcp.servers.length === 0}
          className="gap-1.5 bg-card shadow-sm"
        >
          <Download className="size-3.5" />
          내보내기
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleImportClick}
          className="gap-1.5 bg-card shadow-sm"
        >
          <Upload className="size-3.5" />
          가져오기
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => void handleFileChange(e)}
        />
      </div>
      {message && (
        <p
          className={cn(
            "inline-flex items-center gap-1.5 text-xs",
            message.type === "error"
              ? "text-destructive"
              : "text-muted-foreground"
          )}
        >
          {message.type === "success" && <FileUp className="size-3" />}
          {message.text}
        </p>
      )}
    </div>
  );
}
