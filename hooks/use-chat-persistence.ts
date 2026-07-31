"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { SetStateAction } from "react";

import {
  EMPTY_CHAT_SNAPSHOT,
  getStoredChatSnapshot,
  saveChatSnapshot,
  type ChatSnapshot,
} from "@/lib/storage/chat-storage";
import type { ChatSession } from "@/lib/types/chat";

const subscribe = () => () => {};
const getServerSnapshot = () => EMPTY_CHAT_SNAPSHOT;

/**
 * 채팅 세션 상태를 localStorage와 동기화한다.
 * 서버 렌더와 첫 하이드레이션에서는 빈 스냅샷을 쓰고, 그 직후 저장된 스냅샷으로 교체된다.
 */
export function useChatPersistence() {
  const restored = useSyncExternalStore(
    subscribe,
    getStoredChatSnapshot,
    getServerSnapshot
  );
  const [edited, setEdited] = useState<ChatSnapshot | null>(null);
  const snapshot = edited ?? restored;

  useEffect(() => {
    // 사용자가 실제로 바꾼 뒤에만 쓴다. 복원값을 그대로 되쓸 이유가 없고,
    // 하이드레이션 시점의 빈 스냅샷이 기존 기록을 덮어쓰는 것도 막힌다.
    if (!edited) return;
    saveChatSnapshot(edited);
  }, [edited]);

  const setSessions = useCallback((update: SetStateAction<ChatSession[]>) => {
    setEdited((prev) => {
      const base = prev ?? getStoredChatSnapshot();
      return {
        ...base,
        sessions: typeof update === "function" ? update(base.sessions) : update,
      };
    });
  }, []);

  const setActiveChatId = useCallback((activeChatId: string | null) => {
    setEdited((prev) => ({
      ...(prev ?? getStoredChatSnapshot()),
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
