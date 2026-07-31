"use client";

import { isValidElement, useMemo, type ReactNode } from "react";
import ReactMarkdown, {
  defaultUrlTransform,
  type Components,
} from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { ChatImage } from "@/components/chat/chat-image";
import { CodeBlock } from "@/components/chat/code-block";
import { ItineraryCard } from "@/components/itinerary/itinerary-card";
import {
  allowDataImageUrl,
  promoteBareDataImages,
  resolveImageSrc,
} from "@/lib/chat/base64-image";
import { splitMessageSegments } from "@/lib/itinerary/parse";

function extractFencedCode(
  children: ReactNode
): { text: string; language?: string } | null {
  const child = Array.isArray(children) ? children[0] : children;
  if (!isValidElement<{ className?: string; children?: ReactNode }>(child)) {
    return null;
  }

  const className = child.props.className;
  const language = className
    ?.split(/\s+/)
    .find((token) => token.startsWith("language-"))
    ?.slice("language-".length);

  const text = collectText(child.props.children).replace(/\n$/, "");
  return { text, language };
}

function collectText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return collectText(node.props.children);
  }
  return "";
}

/**
 * 말풍선 안에서 쓰이므로 본문(13px)보다 커지지 않도록 크기를 억제하고,
 * 마지막 블록의 아래 여백을 없애 말풍선 패딩과 겹치지 않게 한다.
 */
const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium underline underline-offset-2"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 list-disc space-y-0.5 pl-4 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal space-y-0.5 pl-4 last:mb-0">{children}</ol>
  ),
  /** 체크박스 항목(GFM task list)은 불릿과 체크박스가 겹쳐 보이므로 마커를 숨긴다. */
  li: ({ children }) => (
    <li className="marker:text-muted-foreground has-[>input]:list-none">
      {children}
    </li>
  ),
  input: ({ type, checked, disabled }) => (
    <input
      type={type}
      checked={checked}
      disabled={disabled}
      readOnly
      className="mr-1.5 -ml-4 size-3 translate-y-px accent-brand"
    />
  ),
  h1: ({ children }) => (
    <h3 className="mt-3 mb-1.5 text-sm font-semibold first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h4 className="mt-3 mb-1.5 text-sm font-semibold first:mt-0">{children}</h4>
  ),
  h3: ({ children }) => (
    <h5 className="mt-2.5 mb-1 font-semibold first:mt-0">{children}</h5>
  ),
  code: ({ className, children }) => {
    // 펜스 코드는 language-* 클래스를 유지해 base64 이미지 판별에 쓴다.
    const isFenced = Boolean(className?.includes("language-"));
    return (
      <code
        className={
          isFenced
            ? className
            : "rounded bg-foreground/10 px-1 py-0.5 font-mono text-[12px]"
        }
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => {
    const fenced = extractFencedCode(children);
    if (fenced) {
      const src = resolveImageSrc(fenced.text, fenced.language);
      if (src) {
        return <ChatImage src={src} alt="코드 블록 이미지" />;
      }
    }
    return <CodeBlock>{children}</CodeBlock>;
  },
  img: ({ src, alt }) =>
    typeof src === "string" && src.length > 0 ? (
      <ChatImage src={src} alt={alt || "이미지"} />
    ) : null,
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-foreground/20 pl-2.5 text-muted-foreground last:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-2.5 border-foreground/15" />,
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-left text-[12px]">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-foreground/15 px-2 py-1 font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-foreground/15 px-2 py-1">{children}</td>
  ),
};

const plugins = [remarkGfm, remarkBreaks];

function urlTransform(url: string): string {
  return allowDataImageUrl(url, defaultUrlTransform);
}

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  // ```itinerary 블록은 마크다운 대신 지도 카드로 그린다.
  // 스트리밍 중 매 청크마다 재파싱되지 않도록 본문 기준으로 메모한다.
  const segments = useMemo(() => splitMessageSegments(content), [content]);

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.kind === "itinerary") {
          return <ItineraryCard key={index} plan={segment.plan} />;
        }

        if (segment.kind === "itinerary-pending") {
          return <ItineraryPlaceholder key={index} label="여행 일정을 그리는 중…" />;
        }

        if (segment.kind === "itinerary-invalid") {
          return (
            <ItineraryPlaceholder
              key={index}
              label="일정을 지도로 표시하지 못했어요. 다시 물어보면 새로 만들어드릴게요."
            />
          );
        }

        const text = promoteBareDataImages(segment.text);

        return (
          <ReactMarkdown
            key={index}
            remarkPlugins={plugins}
            components={components}
            urlTransform={urlTransform}
          >
            {text}
          </ReactMarkdown>
        );
      })}
    </>
  );
}

function ItineraryPlaceholder({ label }: { label: string }) {
  return (
    <p className="my-2 rounded-lg border border-dashed border-border px-2.5 py-2 text-[12px] text-muted-foreground">
      {label}
    </p>
  );
}
