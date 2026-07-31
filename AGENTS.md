# AGENTS.md

AI 채팅 애플리케이션(MCP Host & Client). 이 문서는 에이전트 전용 운영 규칙이다.

## Operational Commands

패키지 매니저는 **`pnpm` 고정**이다. `npm` / `yarn` / `bun` 사용 금지.

| 목적 | 명령어 |
|---|---|
| 의존성 설치 | `pnpm install` |
| 개발 서버 | `pnpm dev` |
| 프로덕션 빌드 | `pnpm build` |
| 린트 | `pnpm lint` |
| 타입 체크 | `pnpm exec tsc --noEmit` |
| 패키지 추가 | `pnpm add <pkg>` / `pnpm add -D <pkg>` |

미구성 스크립트: `typecheck`, `format`, `test`. 위 표의 `pnpm exec` 형태로 대체하거나,
스크립트를 추가할 때 이 문서를 함께 갱신하라.

환경 변수는 `.env.local`에만 둔다: `GEMINI_API_KEY`, `GEMINI_LLM_MODEL`.

## Golden Rules

### Immutable (타협 불가)

- 외부 API(Gemini, MCP 서버)를 **클라이언트에서 직접 호출하지 마라.** 반드시 Route Handler를 경유한다.
- API 키/시크릿을 코드, 커밋, 클라이언트 번들에 **절대 포함하지 마라.** `.env.local`만 사용한다.
- `NEXT_PUBLIC_` 접두사를 시크릿에 붙이지 마라.
- 에이전트는 환경변수·시크릿 파일을 **절대 읽지 마라.** 대상: `.env`, `.env.*`(`.env.local`, `.env.production` 등), `*.pem`, `*.key`, `id_rsa`/`id_ed25519` 등 SSH 키, `credentials.json`, `*.p12`/`*.pfx`, 클라우드 자격증명 파일(`.aws/credentials` 등). 내용 확인이 필요하면 파일을 열람하지 말고 사용자에게 값 존재 여부·형식만 질문하라.
- 위 파일들을 검색(grep/glob)·요약·인용·로그 출력하지 마라. 필요 시 파일명 존재 여부만 확인한다.
- **DB 스키마/데이터 변경 권한이 없다.** 마이그레이션·데이터 조작은 제안만 하고 실행은 사용자가 한다.
- 모든 소스 파일은 **500 LOC 이하**로 유지한다. 초과 시 훅/유틸/컴포넌트로 분리한다.

### Do

- 요구된 범위(MVP)만 정확히 구현한다. 요청되지 않은 기능·추상화·설정을 추가하지 마라.
- 새 의존성은 도입 전에 필요성을 근거로 밝히고, 가능하면 표준 웹 API(`fetch`, `AbortController`, `ReadableStream`)로 해결한다.
- 로그에 사용자 입력·API 키·MCP 자격증명이 포함되면 마스킹한다.
- 에러는 사용자 친화 문구 + 재시도 경로를 함께 제공한다.

### Don't

- 전역 상태 스토어(Redux/Zustand 등)를 임의로 도입하지 마라. React state + 로컬 훅으로 먼저 해결한다.
- 서버 DB/ORM을 도입하지 마라. MVP 저장소는 `localStorage`다.
- 기존 컨벤션과 다른 스타일(styled-components, CSS Modules 등)을 섞지 마라. Tailwind만 쓴다.
- 요청 없이 README, 설정 파일, 스캐폴드 파일을 리팩터링하지 마라.

## Project Context

MCP 서버에 연결해 도구를 호출하고, LLM 응답을 스트리밍으로 보여주는 채팅 앱.
MVP 범위: 다중 세션(사이드바 대화 목록), 로컬 저장, Gemini 단일 프로바이더.

**Tech Stack:** Next.js 16 (App Router) / React 19 / TypeScript (strict) / Tailwind CSS v4 / shadcn/ui / Lucide / Gemini API (`@google/genai`) / Vercel

Tailwind v4는 설정 파일 없이 `app/globals.css`에서 CSS-first로 구성한다. `tailwind.config.*`를 만들지 마라.

## Standards & References

- **Import 별칭:** `@/*` → 리포지토리 루트. 상대 경로 `../../`를 2단계 이상 쓰지 마라.
- **TypeScript:** `strict: true`. `any` 금지, 불가피하면 `unknown` + 타입 가드.
- **네이밍:** 컴포넌트 파일 `PascalCase.tsx`, 훅 `use-*.ts`, 유틸 `kebab-case.ts`.
- **커밋:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`). 제목은 한 줄 요약.
- **응답 스타일:** 결론 먼저, 대안·트레이드오프는 뒤에. 가정과 제약을 명시한다.

### Maintenance Policy

규칙과 실제 코드가 어긋나면(예: 스크립트 부재, 스택 변경, 디렉토리 신설)
작업을 멈추고 해당 `AGENTS.md` 갱신을 먼저 제안하라. 규칙을 무시하고 진행하지 마라.

## Context Map

- **[서버 로직 / API Route / SSE 스트리밍](./app/api/AGENTS.md)** — LLM 호출, MCP 프록시, 에러 매핑 작업 시.
- **[App Router / UI / 클라이언트 상태](./app/AGENTS.md)** — 페이지, 레이아웃, 컴포넌트, localStorage 작업 시.
