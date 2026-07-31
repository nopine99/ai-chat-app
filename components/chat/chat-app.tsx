"use client";

import { useCallback, useRef, useState } from "react";

import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatWindow } from "@/components/chat/chat-window";
import { useChatPersistence } from "@/hooks/use-chat-persistence";
import { useChatStream } from "@/hooks/use-chat-stream";
import { stripMediaFromContent } from "@/lib/chat/tool-result-media";
import { cn } from "@/lib/utils";
import type { ChatTurn } from "@/lib/llm/types";
import type {
  ChatImageAttachment,
  ChatMessage,
  ChatToolCall,
} from "@/lib/types/chat";

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toTurns(messages: ChatMessage[]): ChatTurn[] {
  // 도구 카드만 있는 빈 assistant 메시지는 API 검증을 통과하지 못하므로 제외한다.
  // 이전 답의 data URL은 길이 제한·재전송 비용을 막기 위해 제거한다.
  return messages
    .filter((message) => message.content.trim().length > 0)
    .map(({ role, content }) => ({
      role,
      content: stripMediaFromContent(content),
    }));
}

export function ChatApp() {
  const { sessions, setSessions, activeChatId, setActiveChatId } =
    useChatPersistence();
  const [draft, setDraft] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  /** 응답이 도착했을 때 어느 세션에 붙일지, 재시도 시 어떤 턴을 다시 보낼지 기억한다. */
  const pendingChatIdRef = useRef<string | null>(null);
  const lastTurnsRef = useRef<ChatTurn[]>([]);

  const appendMessage = useCallback(
    (chatId: string, message: ChatMessage) => {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === chatId
            ? {
                ...session,
                updatedAt: message.createdAt,
                messages: [...session.messages, message],
              }
            : session
        )
      );
    },
    [setSessions]
  );

  const handleAssistantComplete = useCallback(
    (
      text: string,
      toolCalls: ChatToolCall[],
      attachments: ChatImageAttachment[]
    ) => {
      const chatId = pendingChatIdRef.current;
      if (!chatId) return;

      appendMessage(chatId, {
        id: createId("msg"),
        role: "assistant",
        content: stripMediaFromContent(text),
        createdAt: new Date().toISOString(),
        ...(toolCalls.length > 0 ? { toolCalls } : {}),
        ...(attachments.length > 0 ? { attachments } : {}),
      });
    },
    [appendMessage]
  );

  const {
    streamingText,
    streamingToolCalls,
    streamingAttachments,
    isStreaming,
    error,
    start,
    stop,
    clearError,
  } = useChatStream({ onComplete: handleAssistantComplete });

  const activeSession =
    sessions.find((session) => session.id === activeChatId) ?? null;

  const handleSelectChat = useCallback(
    (chatId: string) => {
      stop();
      clearError();
      setActiveChatId(chatId);
      setIsSidebarOpen(false);
    },
    [stop, clearError, setActiveChatId]
  );

  const handleNewChat = useCallback(() => {
    stop();
    clearError();
    setActiveChatId(null);
    setDraft("");
    setIsSidebarOpen(false);
  }, [stop, clearError, setActiveChatId]);

  const handleSend = useCallback(() => {
    const content = draft.trim();
    if (!content || isStreaming) return;

    const userMessage: ChatMessage = {
      id: createId("msg"),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    const targetChatId = activeChatId ?? createId("chat");
    const previousMessages = activeChatId ? (activeSession?.messages ?? []) : [];

    if (activeChatId) {
      appendMessage(targetChatId, userMessage);
    } else {
      setSessions((prev) => [
        {
          id: targetChatId,
          title: content.length > 24 ? `${content.slice(0, 24)}...` : content,
          updatedAt: userMessage.createdAt,
          messages: [userMessage],
        },
        ...prev,
      ]);
    }

    setActiveChatId(targetChatId);
    setDraft("");

    const turns = toTurns([...previousMessages, userMessage]);
    pendingChatIdRef.current = targetChatId;
    lastTurnsRef.current = turns;

    void start(turns);
  }, [
    draft,
    isStreaming,
    activeChatId,
    activeSession,
    appendMessage,
    start,
    setSessions,
    setActiveChatId,
  ]);

  const handleRetry = useCallback(() => {
    if (isStreaming || lastTurnsRef.current.length === 0) return;
    void start(lastTurnsRef.current);
  }, [isStreaming, start]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 shrink-0 border-r transition-transform md:static md:z-0 md:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <ChatSidebar
          sessions={sessions}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onClose={() => setIsSidebarOpen(false)}
        />
      </aside>

      {isSidebarOpen && (
        <button
          type="button"
          aria-label="사이드바 닫기"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}

      <ChatWindow
        session={activeSession}
        draft={draft}
        onDraftChange={setDraft}
        onSend={handleSend}
        onStop={stop}
        isAssistantTyping={isStreaming}
        streamingText={streamingText}
        streamingToolCalls={streamingToolCalls}
        streamingAttachments={streamingAttachments}
        error={error}
        onRetry={handleRetry}
        onDismissError={clearError}
        onOpenSidebar={() => setIsSidebarOpen(true)}
      />
    </div>
  );
}
