import { toChatError } from "@/lib/llm/errors";
import { ChatError } from "@/lib/llm/errors";
import { runChatToolLoop } from "@/lib/llm/tool-loop";
import type { ChatStreamEvent, ChatTurn } from "@/lib/llm/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TURNS = 40;
const MAX_CONTENT_LENGTH = 8_000;

export async function POST(request: Request) {
  let messages: ChatTurn[];

  try {
    messages = parseMessages(await readJsonBody(request));
  } catch (error) {
    const chatError = toChatError(error);
    return Response.json(
      { code: chatError.code, message: chatError.message },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        for await (const event of runChatToolLoop({
          messages,
          signal: request.signal,
        })) {
          send(event);
        }
        send({ type: "done" });
      } catch (error) {
        // 클라이언트가 끊은 경우는 정상 종료로 취급한다.
        if (!request.signal.aborted) {
          const chatError = toChatError(error);
          console.error("[chat/stream]", chatError.code, chatError.message);
          send({ type: "error", code: chatError.code, message: chatError.message });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ChatError("BAD_REQUEST", "요청 본문을 읽을 수 없습니다.");
  }
}

function parseMessages(body: unknown): ChatTurn[] {
  if (typeof body !== "object" || body === null) {
    throw new ChatError("BAD_REQUEST");
  }

  const { messages } = body as { messages?: unknown };

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new ChatError("BAD_REQUEST", "메시지가 비어 있습니다.");
  }

  if (messages.length > MAX_TURNS) {
    throw new ChatError("BAD_REQUEST", "대화가 너무 길어요. 새 채팅을 시작해주세요.");
  }

  return messages.map((turn) => {
    if (typeof turn !== "object" || turn === null) {
      throw new ChatError("BAD_REQUEST");
    }

    const { role, content } = turn as { role?: unknown; content?: unknown };

    if (role !== "user" && role !== "assistant") {
      throw new ChatError("BAD_REQUEST", "role 값이 올바르지 않습니다.");
    }

    if (typeof content !== "string" || content.trim().length === 0) {
      throw new ChatError("BAD_REQUEST", "메시지 내용이 비어 있습니다.");
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      throw new ChatError("BAD_REQUEST", "메시지가 너무 길어요.");
    }

    return { role, content };
  });
}
