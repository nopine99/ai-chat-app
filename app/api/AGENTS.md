# app/api/ — Route Handlers

서버 전용 영역. LLM 호출과 MCP 서버 통신을 모두 여기서 프록시한다.
클라이언트가 외부 네트워크에 직접 나가는 경로는 존재해서는 안 된다.

## Tech Stack & Constraints

- Route Handler(`route.ts`)만 사용한다. Pages API(`pages/api`)를 만들지 마라.
- MCP 등 직접 HTTP 호출은 표준 `fetch`를 쓴다. `axios` 등 클라이언트 라이브러리를 추가하지 마라.
- 스트리밍은 SSE(`text/event-stream`) + `ReadableStream`으로 구현한다. WebSocket을 도입하지 마라.
- 기본 LLM은 **Gemini**이며 공식 SDK `@google/genai`(`ai.models.generateContentStream`)를 사용한다.
  REST 엔드포인트를 직접 호출하지 마라.
- 다른 프로바이더(Claude 등)는 라우트를 분기하지 말고 `lib/llm/`에 **어댑터 모듈을 추가**해 대응한다.

## Implementation Patterns

- 스트리밍 엔드포인트: `app/api/chat/stream/route.ts` (`runtime = "nodejs"`).
- 스트리밍 라우트에는 런타임을 명시하고, 정적 최적화를 막기 위해 `export const dynamic = "force-dynamic"`을 설정한다.
- 응답 헤더에 `Cache-Control: no-store`, `Connection: keep-alive`, `X-Accel-Buffering: no`를 포함한다.
- 클라이언트 연결이 끊기면 `request.signal`을 상류 호출에 전달해 함께 취소한다.
  Gemini는 `config.abortSignal`로 전달한다.
- 요청 바디는 핸들러 진입 직후 검증하고, 검증 실패는 400으로 즉시 반환한다.
- 프로바이더별 로직은 라우트 파일에 인라인하지 말고 `lib/llm/*`, `lib/mcp/*`로 분리한다.
- SSE 스트림은 두 개다. 각 스트림의 이벤트 타입은 한 곳에서 정의하고, 클라이언트도 한 훅에서만 파싱한다.
  - 채팅 토큰 스트림: `app/api/chat/stream` · 타입 `lib/llm/types.ts`의 `ChatStreamEvent`(`delta` · `tool_start` · `tool_result` · `error` · `done`) · 파서 `hooks/use-chat-stream.ts`. MCP tools 자동 호출은 `lib/llm/tool-loop.ts`가 `mcpManager`로 처리한다.
  - MCP 연결 상태 스트림: `app/api/mcp/events` · 타입 `lib/types/mcp.ts`의 `McpStatusEvent` · 파서 `hooks/use-mcp-status-stream.ts`
- 상태 폴링 엔드포인트를 새로 만들지 마라. MCP 연결 상태는 `app/api/mcp/events` 하나가 진실의 원천이다.

## Error Mapping

상류 상태 코드를 그대로 흘려보내지 말고 통일된 에러 코드로 변환한다.

| 상류 | 내부 코드 | 사용자 노출 의미 |
|---|---|---|
| 401 / 403 | `AUTH_ERROR` | 키 설정 확인 필요 |
| 429 | `RATE_LIMITED` | 잠시 후 재시도 |
| 5xx / 타임아웃 | `UPSTREAM_ERROR` | 일시적 장애, 재시도 가능 |
| 검증 실패 | `BAD_REQUEST` | 입력 확인 필요 |

- 스트림 도중 발생한 에러는 연결을 끊지 말고 에러 이벤트로 전송한 뒤 정상 종료한다.
- 응답 본문에 상류 원문 에러·스택 트레이스를 포함하지 마라.

## Local Golden Rules

### Do

- 시크릿은 `process.env`에서만 읽고, 부재 시 기동 시점에 명확한 에러를 던진다.
- MCP 서버 URL/자격증명은 요청마다 검증하고, 로그에는 마스킹한 값만 남긴다.
- 응답 스키마는 클라이언트와 공유되는 타입으로 정의해 드리프트를 막는다.

### Don't

- 시크릿이나 MCP 자격증명을 응답 본문·에러 메시지에 담지 마라.
- 사용자 입력을 그대로 외부 URL로 만들어 요청하지 마라(SSRF). 허용 목록으로 검증한다.
- 스트리밍 응답을 서버에서 전부 버퍼링한 뒤 한 번에 보내지 마라. 첫 청크 지연이 핵심 지표다.
- 라우트 안에서 채팅/MCP 영속 데이터를 쓰지 마라. 세션·MCP 설정은 클라이언트 Supabase 저장소가 담당한다.
