"use client";

import { useMemo, useState } from "react";
import { ImageOff } from "lucide-react";

interface ChatImageProps {
  /** data URL, http(s) URL, 또는 raw base64 + mimeType */
  src?: string;
  mimeType?: string;
  data?: string;
  alt?: string;
}

function toDataUrl(mimeType: string, base64: string): string {
  return `data:${mimeType};base64,${base64.replace(/\s/g, "")}`;
}

function resolveDisplayUrl(
  src: string | undefined,
  mimeType: string | undefined,
  data: string | undefined
): string | null {
  if (
    src?.startsWith("blob:") ||
    src?.startsWith("http://") ||
    src?.startsWith("https://") ||
    src?.startsWith("data:image/")
  ) {
    return src;
  }

  if (mimeType && data && data.replace(/\s/g, "").length >= 32) {
    return toDataUrl(mimeType, data);
  }

  if (src && mimeType && src.replace(/\s/g, "").length >= 32) {
    return toDataUrl(mimeType, src);
  }

  return null;
}

/**
 * 말풍선·도구 카드용 이미지.
 * 바이너리는 메시지 본문(마크다운)이 아니라 attachments로 분리되어 오므로,
 * 여기서는 안정적으로 data URL을 만들어 한 번만 디코드한다.
 */
export function ChatImage({
  src,
  mimeType,
  data,
  alt = "이미지",
}: ChatImageProps) {
  const sourceKey = `${mimeType ?? ""}:${(data ?? src ?? "").slice(0, 64)}`;
  const displayUrl = useMemo(
    () => resolveDisplayUrl(src, mimeType, data),
    [src, mimeType, data]
  );
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const failed = failedKey === sourceKey;

  if (failed || !displayUrl) {
    return (
      <div className="my-2 flex items-center gap-2 rounded-lg border border-dashed border-foreground/15 px-3 py-2 text-[12px] text-muted-foreground last:mb-0">
        <ImageOff className="size-3.5 shrink-0" />
        이미지를 표시하지 못했어요.
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- data/http URL을 그대로 렌더한다.
    <img
      src={displayUrl}
      alt={alt}
      className="my-2 max-h-80 max-w-full rounded-lg border border-foreground/10 object-contain last:mb-0"
      loading="lazy"
      decoding="async"
      onError={() => setFailedKey(sourceKey)}
    />
  );
}
