import { Sparkles } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function TypingIndicator() {
  return (
    <div className="mt-3 flex w-full items-start gap-2">
      <div className="w-8 shrink-0">
        <Avatar>
          <AvatarFallback className="bg-brand text-brand-foreground">
            <Sparkles className="size-4" />
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="relative">
        <span
          aria-hidden
          className="absolute -left-1 bottom-2 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-bubble-assistant"
        />
        <div className="relative flex items-center gap-1 rounded-2xl border border-bubble-assistant-border bg-bubble-assistant px-4 py-3 shadow-sm">
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
