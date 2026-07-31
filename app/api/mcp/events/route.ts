import { mcpManager } from "@/lib/mcp/manager";
import type { McpStatusEvent } from "@/lib/types/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 프록시·브라우저가 유휴 연결을 끊지 않도록 주기적으로 주석 프레임을 보낸다. */
const HEARTBEAT_MS = 25_000;

/**
 * 서버 프로세스가 들고 있는 MCP 연결 상태를 실시간으로 밀어준다.
 * 구독 직후 스냅샷 1건, 이후 연결/해제/기능 목록 변경 때마다 update 이벤트를 보낸다.
 */
export function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // 이미 닫힌 스트림. cleanup에서 구독을 정리한다.
        }
      };

      const send = (event: McpStatusEvent) => {
        write(`data: ${JSON.stringify(event)}\n\n`);
      };

      const unsubscribe = mcpManager.subscribe((serverId, state) => {
        send({ type: "update", serverId, state });
      });

      const heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // 이미 닫혀 있으면 무시한다.
        }
      };

      request.signal.addEventListener("abort", cleanup);
      send({ type: "snapshot", statuses: mcpManager.snapshot() });
      if (request.signal.aborted) cleanup();
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
