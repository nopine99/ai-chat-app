"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { userMessageFor } from "@/lib/llm/errors";
import type { ChatErrorCode, ChatStreamEvent, ChatTurn } from "@/lib/llm/types";
import type { ChatImageAttachment, ChatToolCall } from "@/lib/types/chat";

export interface ChatStreamError {
  code: ChatErrorCode;
  message: string;
}

interface UseChatStreamOptions {
  /**
   * 스트림이 끝났을 때 누적된 응답 텍스트·도구 호출·이미지를 전달한다.
   * 사용자가 중지한 경우 부분 응답도 전달하지만, 에러로 끝난 경우는 전달하지 않는다.
   */
  onComplete: (
    text: string,
    toolCalls: ChatToolCall[],
    attachments: ChatImageAttachment[]
  ) => void;
}

export function useChatStream({ onComplete }: UseChatStreamOptions) {
  const [streamingText, setStreamingText] = useState("");
  const [streamingToolCalls, setStreamingToolCalls] = useState<ChatToolCall[]>(
    []
  );
  const [streamingAttachments, setStreamingAttachments] = useState<
    ChatImageAttachment[]
  >([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<ChatStreamError | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const onCompleteRef = useRef(onComplete);
  const textFlushRafRef = useRef<number | null>(null);
  const pendingTextRef = useRef("");

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      if (textFlushRafRef.current !== null) {
        cancelAnimationFrame(textFlushRafRef.current);
      }
    };
  }, []);

  const flushStreamingText = useCallback((value: string) => {
    pendingTextRef.current = value;
    if (textFlushRafRef.current !== null) return;
    textFlushRafRef.current = requestAnimationFrame(() => {
      textFlushRafRef.current = null;
      setStreamingText(pendingTextRef.current);
    });
  }, []);

  const start = useCallback(async (messages: ChatTurn[]) => {
    controllerRef.current?.abort();
    if (textFlushRafRef.current !== null) {
      cancelAnimationFrame(textFlushRafRef.current);
      textFlushRafRef.current = null;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setStreamingText("");
    setStreamingToolCalls([]);
    setStreamingAttachments([]);
    setError(null);
    setIsStreaming(true);

    let failed = false;
    let text = "";
    let toolCalls: ChatToolCall[] = [];
    let attachments: ChatImageAttachment[] = [];

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        failed = true;
        setError(await readErrorResponse(response));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const event = parseFrame(frame);
          if (!event) continue;

          if (event.type === "delta") {
            text += event.text;
            flushStreamingText(text);
          } else if (event.type === "image") {
            const attachment: ChatImageAttachment = {
              id: event.id,
              mimeType: event.mimeType,
              data: event.data,
              alt: event.alt,
              callId: event.callId,
            };
            attachments = [...attachments, attachment];
            setStreamingAttachments(attachments);
          } else if (event.type === "tool_start") {
            toolCalls = [
              ...toolCalls,
              {
                callId: event.callId,
                serverId: event.serverId,
                serverName: event.serverName,
                name: event.name,
                args: event.args,
              },
            ];
            setStreamingToolCalls(toolCalls);
          } else if (event.type === "tool_result") {
            toolCalls = toolCalls.map((call) =>
              call.callId === event.callId
                ? { ...call, ok: event.ok, result: event.result }
                : call
            );
            setStreamingToolCalls(toolCalls);
          } else if (event.type === "error") {
            failed = true;
            setError({ code: event.code, message: event.message });
          }
        }
      }
    } catch {
      if (!controller.signal.aborted) {
        failed = true;
        setError({
          code: "UPSTREAM_ERROR",
          message: userMessageFor("UPSTREAM_ERROR"),
        });
      }
    } finally {
      const isCurrent = controllerRef.current === controller;

      if (isCurrent) {
        if (textFlushRafRef.current !== null) {
          cancelAnimationFrame(textFlushRafRef.current);
          textFlushRafRef.current = null;
        }
        controllerRef.current = null;
        setStreamingText("");
        setStreamingToolCalls([]);
        setStreamingAttachments([]);
        setIsStreaming(false);
      }

      if (
        isCurrent &&
        !failed &&
        (text.trim() || toolCalls.length > 0 || attachments.length > 0)
      ) {
        onCompleteRef.current(text, toolCalls, attachments);
      }
    }
  }, [flushStreamingText]);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    streamingText,
    streamingToolCalls,
    streamingAttachments,
    isStreaming,
    error,
    start,
    stop,
    clearError,
  };
}

function parseFrame(frame: string): ChatStreamEvent | null {
  const line = frame
    .split("\n")
    .find((candidate) => candidate.startsWith("data:"));

  if (!line) return null;

  try {
    return JSON.parse(line.slice("data:".length).trim()) as ChatStreamEvent;
  } catch {
    // 이미지 등 큰 프레임이 중간에 잘리면 다음 청크에서 완성된다.
    return null;
  }
}

async function readErrorResponse(response: Response): Promise<ChatStreamError> {
  try {
    const payload = (await response.json()) as Partial<ChatStreamError>;
    if (payload.code && payload.message) {
      return { code: payload.code, message: payload.message };
    }
  } catch {
    // 본문이 JSON이 아니면 기본 메시지로 폴백한다.
  }

  const code: ChatErrorCode =
    response.status === 429 ? "RATE_LIMITED" : "UPSTREAM_ERROR";
  return { code, message: userMessageFor(code) };
}
