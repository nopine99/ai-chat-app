"use client";

import { useRef, type KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isAssistantTyping: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isAssistantTyping,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !isAssistantTyping;

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) {
        onSend();
      }
    }
  }

  return (
    <div className="border-t bg-background px-4 py-4">
      <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border bg-background p-2 shadow-sm">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지를 입력하세요..."
          rows={1}
          className="max-h-52 min-h-9 flex-1 resize-none border-none px-2 py-1.5 shadow-none focus-visible:ring-0"
        />
        {isAssistantTyping ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="응답 중지"
            onClick={onStop}
            className="mb-0.5 shrink-0 rounded-full"
          >
            <Square className="size-3.5 fill-current" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            aria-label="메시지 전송"
            disabled={!canSend}
            onClick={onSend}
            className="mb-0.5 shrink-0 rounded-full"
          >
            <ArrowUp className="size-4" />
          </Button>
        )}
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-muted-foreground">
        AI는 실수를 할 수 있습니다. 중요한 정보는 확인해주세요.
      </p>
    </div>
  );
}
