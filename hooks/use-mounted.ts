"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * 서버 렌더와 첫 하이드레이션에서는 false, 이후 true.
 * 현재 시각·사용자 로케일·타임존에 의존하는 값은 서버 HTML과 어긋날 수 있으므로,
 * 이 훅으로 클라이언트에서만 렌더한다.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
