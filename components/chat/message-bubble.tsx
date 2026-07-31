"use client";

import { memo } from "react";
import { Sparkles } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MarkdownContent } from "@/components/chat/markdown-content";
import { useMounted } from "@/hooks/use-mounted";
import { formatMessageTime } from "@/lib/format-message-time";
import { hasItineraryBlock } from "@/lib/itinerary/parse";
import type { ChatMessage } from "@/lib/types/chat";

interface MessageBubbleProps {
  message: ChatMessage;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isFirstInGroup,
  isLastInGroup,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const mounted = useMounted();
  const time = mounted ? formatMessageTime(message.createdAt) : null;

  if (isUser) {
    return (
      <div className="flex w-full items-end justify-end gap-1.5">
        {isLastInGroup && (
          <span className="mb-0.5 shrink-0 text-[11px] text-muted-foreground">
            {time}
          </span>
        )}
        <div className="relative max-w-[72%]">
          <span
            aria-hidden
            className="absolute -right-1 bottom-2 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-bubble-user"
          />
          <div className="relative rounded-2xl bg-bubble-user px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words text-bubble-user-foreground">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full items-start gap-2">
      <div className="w-8 shrink-0">
        {isFirstInGroup && (
          <Avatar>
            <AvatarFallback className="bg-brand text-brand-foreground">
              <Sparkles className="size-4" />
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* 코드블록·표가 말풍선을 밀어내지 않고 내부에서 가로 스크롤되도록 min-w-0을 건다.
          지도 카드는 72% 폭에서 너무 좁아 읽기 어려우므로 그 메시지만 넓게 쓴다. */}
      <div
        className={`flex min-w-0 flex-col gap-1 ${
          hasItineraryBlock(message.content) ? "max-w-[92%]" : "max-w-[72%]"
        }`}
      >
        {isFirstInGroup && (
          <span className="px-1 text-xs font-medium text-muted-foreground">
            AI 어시스턴트
          </span>
        )}
        <div className="flex min-w-0 items-end gap-1.5">
          <div className="relative min-w-0">
            <span
              aria-hidden
              className="absolute -left-1 bottom-2 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-bubble-assistant"
            />
            <div className="relative rounded-2xl border border-bubble-assistant-border bg-bubble-assistant px-3.5 py-2 text-[13px] leading-relaxed break-words text-bubble-assistant-foreground shadow-sm">
              <MarkdownContent content={message.content} />
            </div>
          </div>
          {isLastInGroup && (
            <span className="mb-0.5 shrink-0 text-[11px] text-muted-foreground">
              {time}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
