"use client";

import { useRef, type ReactNode } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

const LABEL = {
  idle: "코드 복사",
  copied: "복사됨",
  error: "복사 실패, 다시 시도",
} as const;

interface CodeBlockProps {
  children: ReactNode;
}

export function CodeBlock({ children }: CodeBlockProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const { status, copy } = useCopyToClipboard();

  /** 스트리밍 중에도 최신 내용을 복사하도록 클릭 시점의 DOM 텍스트를 읽는다. */
  const handleCopy = () => {
    void copy(preRef.current?.textContent?.replace(/\n$/, "") ?? "");
  };

  const Icon =
    status === "copied" ? Check : status === "error" ? TriangleAlert : Copy;

  return (
    <div className="group/code relative mb-2 last:mb-0">
      <pre
        ref={preRef}
        className="overflow-x-auto rounded-lg bg-foreground/5 p-2.5 pr-10 text-[12px] [&>code]:bg-transparent [&>code]:p-0"
      >
        {children}
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={handleCopy}
        aria-label={LABEL[status]}
        title={LABEL[status]}
        className="absolute top-1.5 right-1.5 bg-background/70 text-muted-foreground opacity-60 backdrop-blur-sm transition-opacity hover:text-foreground group-hover/code:opacity-100 focus-visible:opacity-100"
      >
        <Icon
          className={status === "copied" ? "text-brand" : undefined}
          aria-hidden
        />
      </Button>
    </div>
  );
}
