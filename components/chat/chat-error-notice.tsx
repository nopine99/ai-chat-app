"use client";

import { RotateCcw, TriangleAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ChatStreamError } from "@/hooks/use-chat-stream";

interface ChatErrorNoticeProps {
  error: ChatStreamError;
  onRetry: () => void;
  onDismiss: () => void;
}

export function ChatErrorNotice({
  error,
  onRetry,
  onDismiss,
}: ChatErrorNoticeProps) {
  const canRetry = error.code !== "BAD_REQUEST";

  return (
    <div
      role="alert"
      className="mx-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border border-destructive/25 bg-background/90 px-3.5 py-3 shadow-sm"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />

      <div className="flex-1 space-y-2">
        <p className="text-[13px] leading-relaxed text-foreground">
          {error.message}
        </p>
        {canRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RotateCcw className="size-3.5" />
            다시 시도
          </Button>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="알림 닫기"
        onClick={onDismiss}
        className="shrink-0"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
