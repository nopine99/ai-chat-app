"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ImageIcon,
  Loader2,
  Wrench,
  XCircle,
} from "lucide-react";

import { ChatImage } from "@/components/chat/chat-image";
import { McpResultView } from "@/components/mcp/mcp-result-view";
import { cn } from "@/lib/utils";
import type { ChatImageAttachment, ChatToolCall } from "@/lib/types/chat";

interface ToolCallCardProps {
  call: ChatToolCall;
  attachments?: ChatImageAttachment[];
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function resultHasImageRef(result: unknown): boolean {
  if (typeof result !== "object" || result === null) return false;
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return false;
  return content.some(
    (block) =>
      typeof block === "object" &&
      block !== null &&
      (block as { type?: string }).type === "image_ref"
  );
}

export function ToolCallCard({
  call,
  attachments = [],
}: ToolCallCardProps) {
  const [open, setOpen] = useState(false);
  const pending = call.ok === undefined;
  const hasImages = attachments.length > 0;
  const awaitingImages =
    call.ok === true && !hasImages && resultHasImageRef(call.result);

  return (
    <div className="rounded-xl border bg-muted/30 text-[12px]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        {pending ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : call.ok ? (
          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
        ) : (
          <XCircle className="size-3.5 shrink-0 text-destructive" />
        )}
        {hasImages ? (
          <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <Wrench className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">
          {call.name}
          <span className="ml-1.5 font-normal text-muted-foreground">
            {call.serverName}
            {hasImages ? ` · 이미지 ${attachments.length}` : ""}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {(hasImages || awaitingImages) && (
        <div className="flex flex-col gap-2 border-t px-3 py-2">
          {awaitingImages && (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              이미지 전송 중… 답변 텍스트는 계속 받을 수 있어요.
            </p>
          )}
          {attachments.map((image) => (
            <ChatImage
              key={image.id}
              mimeType={image.mimeType}
              data={image.data}
              alt={image.alt || `생성 이미지`}
            />
          ))}
        </div>
      )}

      {open && (
        <div className="flex flex-col gap-2 border-t px-3 py-2">
          <section>
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">
              인자
            </p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-background/80 p-2 font-mono text-[11px]">
              {formatJson(call.args)}
            </pre>
          </section>
          {!pending && (
            <section>
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                {call.ok ? "결과" : "오류"}
              </p>
              {call.ok ? (
                <div className="rounded-lg border bg-background/80 p-2">
                  <McpResultView
                    result={call.result}
                    imageResolver={(imageId) =>
                      attachments.find((item) => item.id === imageId)
                    }
                  />
                </div>
              ) : (
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-background/80 p-2 font-mono text-[11px]">
                  {formatJson(call.result)}
                </pre>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
