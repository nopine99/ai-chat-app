"use client";

import { useCallback, useState } from "react";
import { Loader2, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { McpArgsForm, type McpArgsResult } from "@/components/mcp/mcp-args-form";
import { McpResultView } from "@/components/mcp/mcp-result-view";
import { useMcp } from "@/hooks/use-mcp";
import { McpClientError } from "@/lib/mcp/client-api";
import type { SchemaField } from "@/lib/mcp/schema-form";

interface McpRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string;
  kind: "tool" | "prompt";
  name: string;
  description?: string;
  fields: SchemaField[];
}

export function McpRunDialog({
  open,
  onOpenChange,
  serverId,
  kind,
  name,
  description,
  fields,
}: McpRunDialogProps) {
  const mcp = useMcp();
  const [argsResult, setArgsResult] = useState<McpArgsResult>({
    args: {},
    error: null,
  });
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const handleRun = useCallback(async () => {
    if (argsResult.error || !argsResult.args) return;

    setIsRunning(true);
    setRunError(null);
    setResult(null);

    try {
      const value =
        kind === "tool"
          ? await mcp.callTool(serverId, name, argsResult.args)
          : await mcp.getPrompt(
              serverId,
              name,
              argsResult.args as Record<string, string>
            );
      setResult(value);
    } catch (error) {
      setRunError(
        error instanceof McpClientError
          ? error.message
          : "실행 중 오류가 발생했어요."
      );
    } finally {
      setIsRunning(false);
    }
  }, [argsResult, kind, mcp, name, serverId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <McpArgsForm fields={fields} onChange={setArgsResult} />

          {argsResult.error && (
            <p className="text-xs text-destructive">{argsResult.error}</p>
          )}

          <Button
            onClick={handleRun}
            disabled={isRunning || Boolean(argsResult.error)}
            className="gap-1.5"
          >
            {isRunning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            실행
          </Button>

          {runError && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
              {runError}
            </p>
          )}

          {result !== null && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                결과
              </span>
              <McpResultView result={result} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
