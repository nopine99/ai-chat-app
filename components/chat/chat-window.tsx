"use client";

import { PanelLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatErrorNotice } from "@/components/chat/chat-error-notice";
import { MessageList } from "@/components/chat/message-list";
import { McpStatusDialog } from "@/components/mcp/mcp-status-dialog";
import type { ChatStreamError } from "@/hooks/use-chat-stream";
import type {
  ChatImageAttachment,
  ChatSession,
  ChatToolCall,
} from "@/lib/types/chat";

interface ChatWindowProps {
  session: ChatSession | null;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isAssistantTyping: boolean;
  streamingText: string;
  streamingToolCalls: ChatToolCall[];
  streamingAttachments: ChatImageAttachment[];
  error: ChatStreamError | null;
  onRetry: () => void;
  onDismissError: () => void;
  onOpenSidebar: () => void;
}

export function ChatWindow({
  session,
  draft,
  onDraftChange,
  onSend,
  onStop,
  isAssistantTyping,
  streamingText,
  streamingToolCalls,
  streamingAttachments,
  error,
  onRetry,
  onDismissError,
  onOpenSidebar,
}: ChatWindowProps) {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b px-3 py-2.5">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="사이드바 열기"
          onClick={onOpenSidebar}
          className="md:hidden"
        >
          <PanelLeft className="size-4" />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">
          {session?.title ?? "새 채팅"}
        </h1>
        <McpStatusDialog />
      </header>

      <MessageList
        messages={session?.messages ?? []}
        isAssistantTyping={isAssistantTyping}
        streamingText={streamingText}
        streamingToolCalls={streamingToolCalls}
        streamingAttachments={streamingAttachments}
        errorNotice={
          error ? (
            <ChatErrorNotice
              error={error}
              onRetry={onRetry}
              onDismiss={onDismissError}
            />
          ) : null
        }
      />

      <ChatInput
        value={draft}
        onChange={onDraftChange}
        onSend={onSend}
        onStop={onStop}
        isAssistantTyping={isAssistantTyping}
      />
    </div>
  );
}
