"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Sparkles } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageAttachments } from "@/components/chat/message-attachments";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ToolCallCard } from "@/components/chat/tool-call-card";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { useMounted } from "@/hooks/use-mounted";
import type {
  ChatImageAttachment,
  ChatMessage,
  ChatToolCall,
} from "@/lib/types/chat";

const WALLPAPER = "chat-wallpaper";

interface MessageListProps {
  messages: ChatMessage[];
  isAssistantTyping: boolean;
  streamingText: string;
  streamingToolCalls: ChatToolCall[];
  streamingAttachments: ChatImageAttachment[];
  errorNotice: ReactNode;
}

export function MessageList({
  messages,
  isAssistantTyping,
  streamingText,
  streamingToolCalls,
  streamingAttachments,
  errorNotice,
}: MessageListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const mounted = useMounted();

  const hasStreaming =
    Boolean(streamingText) ||
    streamingToolCalls.length > 0 ||
    streamingAttachments.length > 0;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, [
    mounted,
    messages.length,
    isAssistantTyping,
    streamingText,
    streamingToolCalls,
    streamingAttachments.length,
    errorNotice,
  ]);

  const isEmpty =
    messages.length === 0 &&
    !isAssistantTyping &&
    !hasStreaming &&
    !errorNotice;

  if (isEmpty) {
    return (
      <div
        className={`flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center ${WALLPAPER}`}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-brand/15">
          <Sparkles className="size-6 text-brand" />
        </div>
        <h2 className="text-lg font-semibold">무엇을 도와드릴까요?</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          아래 입력창에 메시지를 입력해서 대화를 시작해보세요.
        </p>
      </div>
    );
  }

  const lastRole = messages.at(-1)?.role;

  return (
    <ScrollArea viewportRef={viewportRef} className={`min-h-0 flex-1 ${WALLPAPER}`}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-1.5 px-4 py-6">
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const next = messages[index + 1];
          const isFirstInGroup = !previous || previous.role !== message.role;
          const isLastInGroup = !next || next.role !== message.role;
          const attachments = message.attachments ?? [];
          const standaloneImages = attachments.filter((item) => !item.callId);

          return (
            <div
              key={message.id}
              className={isFirstInGroup && index !== 0 ? "mt-3" : undefined}
            >
              {message.role === "assistant" &&
                message.toolCalls &&
                message.toolCalls.length > 0 && (
                  <div className="mb-1.5 ml-10 flex max-w-[92%] flex-col gap-1.5">
                    {message.toolCalls.map((call) => (
                      <ToolCallCard
                        key={call.callId}
                        call={call}
                        attachments={attachments.filter(
                          (item) => item.callId === call.callId
                        )}
                      />
                    ))}
                  </div>
                )}
              {(message.content.trim() || message.role === "user") && (
                <MessageBubble
                  message={message}
                  isFirstInGroup={isFirstInGroup}
                  isLastInGroup={isLastInGroup}
                />
              )}
              {message.role === "assistant" && standaloneImages.length > 0 && (
                <div className="ml-10 max-w-[92%]">
                  <MessageAttachments attachments={standaloneImages} />
                </div>
              )}
            </div>
          );
        })}

        {hasStreaming ? (
          <div className={lastRole === "assistant" ? undefined : "mt-3"}>
            {streamingToolCalls.length > 0 && (
              <div className="mb-1.5 ml-10 flex max-w-[92%] flex-col gap-1.5">
                {streamingToolCalls.map((call) => (
                  <ToolCallCard
                    key={call.callId}
                    call={call}
                    attachments={streamingAttachments.filter(
                      (item) => item.callId === call.callId
                    )}
                  />
                ))}
              </div>
            )}
            {streamingText ? (
              <MessageBubble
                message={{
                  id: "streaming",
                  role: "assistant",
                  content: streamingText,
                  createdAt: new Date().toISOString(),
                }}
                isFirstInGroup={lastRole !== "assistant"}
                isLastInGroup={false}
              />
            ) : (
              isAssistantTyping &&
              streamingAttachments.length === 0 && <TypingIndicator />
            )}
            {streamingAttachments.filter((item) => !item.callId).length > 0 && (
              <div className="ml-10 max-w-[92%]">
                <MessageAttachments
                  attachments={streamingAttachments.filter(
                    (item) => !item.callId
                  )}
                />
              </div>
            )}
          </div>
        ) : (
          isAssistantTyping && <TypingIndicator />
        )}

        {errorNotice && <div className="mt-3">{errorNotice}</div>}
      </div>
    </ScrollArea>
  );
}
