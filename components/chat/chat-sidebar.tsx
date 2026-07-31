"use client";

import { MessageSquareText, PanelLeftClose, SquarePen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMounted } from "@/hooks/use-mounted";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { cn } from "@/lib/utils";
import type { ChatSession } from "@/lib/types/chat";

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onClose: () => void;
}

export function ChatSidebar({
  sessions,
  activeChatId,
  onSelectChat,
  onNewChat,
  onClose,
}: ChatSidebarProps) {
  const mounted = useMounted();

  return (
    <div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-1.5 px-3 py-3">
        <span className="flex-1 truncate px-1 text-sm font-semibold">
          AI 메모
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="사이드바 닫기"
                onClick={onClose}
                className="md:hidden"
              />
            }
          >
            <PanelLeftClose className="size-4" />
          </TooltipTrigger>
          <TooltipContent>사이드바 닫기</TooltipContent>
        </Tooltip>
      </div>

      <div className="px-3 pb-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 bg-sidebar text-sidebar-foreground"
          onClick={onNewChat}
        >
          <SquarePen className="size-4" />
          새 채팅
        </Button>
      </div>

      <Separator />

      <ScrollArea className="min-h-0 flex-1">
        <nav className="flex flex-col gap-0.5 p-2" aria-label="채팅 목록">
          {sessions.map((session) => {
            const isActive = session.id === activeChatId;
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelectChat(session.id)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-sidebar-accent",
                  isActive &&
                    "bg-sidebar-accent text-sidebar-accent-foreground"
                )}
              >
                <MessageSquareText className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{session.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  {mounted ? formatRelativeTime(session.updatedAt) : null}
                </span>
              </button>
            );
          })}
        </nav>
      </ScrollArea>
    </div>
  );
}
