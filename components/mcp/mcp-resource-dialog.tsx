"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { McpResultView } from "@/components/mcp/mcp-result-view";
import { useMcp } from "@/hooks/use-mcp";
import { McpClientError } from "@/lib/mcp/client-api";

interface McpResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string;
  uri: string;
  name?: string;
}

export function McpResourceDialog({
  open,
  onOpenChange,
  serverId,
  uri,
  name,
}: McpResourceDialogProps) {
  const mcp = useMcp();
  // 이 다이얼로그는 항상 새 대상으로 새로 마운트되므로, 처음부터 로딩 중으로 시작한다.
  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const value = await mcp.readResource(serverId, uri);
      setResult(value);
      setError(null);
    } catch (err) {
      setError(
        err instanceof McpClientError ? err.message : "리소스를 읽지 못했어요."
      );
    } finally {
      setIsLoading(false);
    }
  }, [mcp, serverId, uri]);

  useEffect(() => {
    // 마운트 시 한 번 읽어온다. load()의 setState 호출은 항상 await 이후(비동기)에 일어난다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const handleReload = () => {
    setIsLoading(true);
    void load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate">{name ?? uri}</DialogTitle>
          <DialogDescription className="truncate">{uri}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReload}
            disabled={isLoading}
            className="w-fit gap-1.5"
          >
            {isLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            다시 읽기
          </Button>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {!isLoading && result !== null && <McpResultView result={result} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
