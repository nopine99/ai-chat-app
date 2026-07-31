"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageOff } from "lucide-react";

interface ChatImageProps {
  /** data URL, http(s) URL, 또는 raw base64 + mimeType */
  src?: string;
  mimeType?: string;
  data?: string;
  alt?: string;
}

function toObjectUrl(mimeType: string, base64: string): string | null {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

function resolveDisplaySource(
  src: string | undefined,
  mimeType: string | undefined,
  data: string | undefined
): { url: string; revoke: boolean } | null {
  if (
    src?.startsWith("blob:") ||
    src?.startsWith("http://") ||
    src?.startsWith("https://") ||
    src?.startsWith("data:image/")
  ) {
    return { url: src, revoke: false };
  }

  if (mimeType && data) {
    const url = toObjectUrl(mimeType, data.replace(/\s/g, ""));
    return url ? { url, revoke: true } : null;
  }

  if (src && mimeType) {
    const url = toObjectUrl(mimeType, src.replace(/\s/g, ""));
    return url ? { url, revoke: true } : null;
  }

  return null;
}

/**
 * 말풍선·도구 카드용 이미지.
 * base64는 data URL 문자열로 두지 않고 blob URL로 바꿔 디코드·렌더 비용을 줄인다.
 */
export function ChatImage({
  src,
  mimeType,
  data,
  alt = "이미지",
}: ChatImageProps) {
  const sourceKey = `${mimeType ?? ""}:${(data ?? src ?? "").slice(0, 64)}`;
  const resolved = useMemo(
    () => resolveDisplaySource(src, mimeType, data),
    [src, mimeType, data]
  );

  // 소스가 바뀌면 이전 실패 상태가 자동으로 무효화되도록 key로 비교한다.
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const failed = failedKey === sourceKey;

  useEffect(() => {
    if (!resolved?.revoke) return;
    const url = resolved.url;
    return () => URL.revokeObjectURL(url);
  }, [resolved]);

  if (failed || !resolved) {
    return (
      <div className="my-2 flex items-center gap-2 rounded-lg border border-dashed border-foreground/15 px-3 py-2 text-[12px] text-muted-foreground last:mb-0">
        <ImageOff className="size-3.5 shrink-0" />
        이미지를 표시하지 못했어요.
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- blob/data URL을 그대로 렌더한다.
    <img
      src={resolved.url}
      alt={alt}
      className="my-2 max-h-80 max-w-full rounded-lg border border-foreground/10 object-contain last:mb-0"
      loading="lazy"
      decoding="async"
      onError={() => setFailedKey(sourceKey)}
    />
  );
}
