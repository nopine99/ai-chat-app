"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";

import {
  EMPTY_CHAT_SNAPSHOT,
  fetchChatSnapshot,
  saveChatSnapshot,
  type ChatSnapshot,
} from "@/lib/storage/chat-storage";
import type { ChatSession } from "@/lib/types/chat";

const SAVE_DEBOUNCE_MS = 400;

/**
 * 채팅 세션 상태를 Supabase와 동기화한다.
 * 마운트 시 스냅샷을 불러오고, 사용자 변경만 디바운스해 저장한다.
 */
export function useChatPersistence() {
  const [snapshot, setSnapshot] = useState<ChatSnapshot>(EMPTY_CHAT_SNAPSHOT);
  const [hydrated, setHydrated] = useState(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void fetchChatSnapshot().then((next) => {
      if (cancelled) return;
      setSnapshot(next);
      setHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !dirtyRef.current) return;

    const timer = window.setTimeout(() => {
      void saveChatSnapshot(snapshot);
    }, SAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [snapshot, hydrated]);

  const setSessions = useCallback((update: SetStateAction<ChatSession[]>) => {
    dirtyRef.current = true;
    setSnapshot((prev) => ({
      ...prev,
      sessions: typeof update === "function" ? update(prev.sessions) : update,
    }));
  }, []);

  const setActiveChatId = useCallback((activeChatId: string | null) => {
    dirtyRef.current = true;
    setSnapshot((prev) => ({
      ...prev,
      activeChatId,
    }));
  }, []);

  return {
    sessions: snapshot.sessions,
    setSessions,
    activeChatId: snapshot.activeChatId,
    setActiveChatId,
  };
}
