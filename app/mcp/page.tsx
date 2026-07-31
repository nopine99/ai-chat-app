import Link from "next/link";
import { ArrowLeft, Cable } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { McpManager } from "@/components/mcp/mcp-manager";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "MCP 서버 관리 · AI 메모",
};

export default function McpPage() {
  return (
    <div className="relative flex h-dvh flex-col overflow-y-auto bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand)_18%,transparent),transparent_70%)]"
      />

      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "gap-1.5 text-muted-foreground hover:text-foreground"
            )}
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">채팅으로 돌아가기</span>
            <span className="sm:hidden">뒤로</span>
          </Link>
          <div className="h-4 w-px bg-border" aria-hidden />
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Cable className="size-3.5" />
            </span>
            <span className="truncate text-sm font-medium">MCP 설정</span>
          </div>
        </div>
      </header>

      <McpManager />
    </div>
  );
}
