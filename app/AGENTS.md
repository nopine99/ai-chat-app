# app/ — App Router & UI

Next.js App Router 영역. 페이지·레이아웃·클라이언트 컴포넌트와 Supabase 영속화를 담당한다.
서버 로직은 `app/api/`로 위임한다.

## Tech Stack & Constraints

- UI 컴포넌트는 **shadcn/ui**만 사용한다. 직접 만들기 전에 `pnpm dlx shadcn@latest add <component>`로 추가할 수 있는지 먼저 확인하라.
- 아이콘은 **Lucide**(`lucide-react`)만 사용한다. 인라인 SVG나 다른 아이콘 팩을 섞지 마라.
- 스타일은 **Tailwind 유틸리티 클래스**로만 작성한다. 인라인 `style` 속성은 동적 계산값에만 허용.
- 디자인 토큰(색상, 폰트 변수)은 `globals.css`의 CSS 변수를 참조한다. 하드코딩된 hex 값을 쓰지 마라.

## Implementation Patterns

- 기본은 **서버 컴포넌트**다. `"use client"`는 상태·이벤트·브라우저 API가 필요한 최말단 컴포넌트에만 붙인다.
- 공용 컴포넌트는 `components/ui/`(shadcn 생성물)와 `components/`(도메인 컴포넌트)로 나눈다.
- 스트리밍 소비는 커스텀 훅(`hooks/use-chat-stream.ts` 형태)으로 분리하고, 컴포넌트에는 렌더링만 남긴다.
- 레이아웃 골격: 상단 = 모델/MCP 서버 관리 진입, 본문 = 채팅 타임라인(유저·AI 버블 + MCP 결과 카드), 하단 = 입력창.
- 입력창의 `/`는 **Prompt 전용 트리거**다. 다른 용도로 재사용하지 마라.

## Storage (Supabase)

- 저장 항목은 MCP 서버 메타데이터(`mcp_servers`)와 **채팅 세션 목록**(`chat_sessions`)으로 제한한다. 세션은 저장 시점에 `updatedAt` 기준 **최근 30개**만 남기고 오래된 것부터 버린다.
- 활성 세션 식별자(`activeChatId`)는 `app_settings`에 저장해, 새로고침 후 마지막으로 보던 대화를 그대로 연다.
- 도메인 타입(`ChatSession`, `McpServerConfig`)은 `lib/types/*`를 유지하고, DB 컬럼은 그 필드에 1:1로 맞춘다(`messages`/`stdio`/`http`는 jsonb).
- 읽기/쓰기는 `lib/storage/*` + `lib/supabase/client.ts`로 감싼다. 브라우저 클라이언트는 `NEXT_PUBLIC_SUPABASE_*`만 사용한다.
- 토큰·비밀번호 등 민감값은 저장하지 않는 것을 기본으로 하고, 저장이 불가피하면 보안 경고 배너를 함께 노출한다.
- 파싱·조회 실패 시 예외를 던지지 말고 기본값(빈 스냅샷)으로 복구한다. 쓰기는 디바운스한다.

## UX Rules

- **스트리밍 체감이 최우선**이다. 첫 청크가 도착하기 전에도 로딩 상태를 즉시 표시한다.
- 진행 중 요청은 사용자가 취소할 수 있어야 한다(`AbortController`를 훅에서 노출).
- 에러 상태는 친절한 문구와 **재시도 버튼**을 함께 렌더링한다. 원시 에러 메시지를 그대로 노출하지 마라.
- 시맨틱 마크업과 키보드 네비게이션을 지킨다. 클릭 핸들러를 `div`에 붙이지 말고 `button`을 쓴다.

## Local Golden Rules

### Do

- 상태는 컴포넌트 지역 state로 시작하고, 공유가 필요해지면 훅으로 끌어올린다.
- 긴 타임라인은 리스트 아이템 컴포넌트로 분리해 리렌더 범위를 좁힌다.

### Don't

- 클라이언트에서 `GEMINI_API_KEY`나 MCP 자격증명을 읽지 마라. 서버 라우트만 접근한다.
- `"use client"`를 `layout.tsx`나 페이지 최상단에 붙이지 마라. 트리 전체가 클라이언트로 전환된다.
- 전역 스토어를 새로 도입하지 마라. 필요하다고 판단되면 먼저 근거를 제시하고 승인받아라.
