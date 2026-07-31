"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CopyStatus = "idle" | "copied" | "error";

const RESET_DELAY_MS = 1500;

/**
 * 클립보드 API는 비보안 컨텍스트나 권한 거부 시 실패하므로,
 * 성공/실패를 상태로 돌려주고 잠시 뒤 idle로 되돌린다.
 */
export function useCopyToClipboard() {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = useCallback(async (text: string) => {
    let next: CopyStatus = "copied";

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      next = "error";
    }

    setStatus(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setStatus("idle"), RESET_DELAY_MS);

    return next === "copied";
  }, []);

  return { status, copy };
}
