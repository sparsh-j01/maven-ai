# Maven AI

Real-time, voice-based mock interviews. Pick a role, talk to a low-latency voice
interviewer that takes clean turns and asks adaptive follow-ups, run a live
coding round, and get a rubric-scored feedback report with a replayable
transcript.

> **Status:** in active development. The monorepo, database schema, shared
> contracts, auth, web shell, the live turn-based voice loop, the plan-driven
> interview state machine, the async scored feedback report (rubric radar +
> transcript), and the live coding round (Monaco + Judge0 sandbox) are in place;
> resume-driven RAG personalization is next.

## Why this exists

Most "AI interview" demos are a text box wired to a chat completion. Maven AI is
built the way a production voice product actually is: a long-lived stateful voice
worker separate from the serverless web app, a turn-based audio pipeline over
WebRTC, a state machine driven by tool-use, and an async scoring job that grades
the transcript after the call. The interesting engineering is the real-time loop,
not the UI.

## Highlights

- **Turn-based voice pipeline** (VAD → STT → LLM → TTS) over LiveKit/WebRTC.
  Push-to-talk, no barge-in: clean turn ownership that stays reliable on flaky
  connections.
- **Provider adapters** for STT, LLM, and TTS. Swapping Gemini → Claude or
  Deepgram → Cartesia is a config change, not a rewrite.
- **State machine + tool-use** drives the interview through phases
  (`intro → warmup → technical → coding → behavioral → wrap_up`). The interview
  cursor is persisted, so an agent restart resumes where it left off.
- **Async scored reports.** The interview ends instantly; a durable background
  job grades each rubric competency with structured output and drafts model
  answers for weak responses.
- **RAG personalization.** Resume + role embedded and matched against a curated
  question bank (Postgres + pgvector) so questions stay grounded.
- **Evals in CI.** Golden-transcript scoring tests and an LLM-as-judge check on
  question quality, so a bad prompt change cannot merge silently.

## Architecture

Three runtimes, split on purpose: the web app is request/response and
serverless-friendly; the voice agent is a long-lived worker that holds an audio
session open for minutes.

```
        Browser (Next.js · LiveKit SDK · Monaco)
            │ HTTPS (REST)        │ WebRTC (audio + data channel)
            ▼                     ▼
   Next.js BFF / API        LiveKit SFU (media transport)
   • mint scoped tokens          │ agent joins room
   • CRUD / webhooks             ▼
   • Clerk · Stripe        Voice Agent (Python · LiveKit Agents)
            │                VAD → STT → LLM → TTS loop
            ▼                tools: next_question, score_answer,
   Postgres + pgvector             run_code, end_interview
   Inngest (async report) ◄────────┘
```

Secrets never reach the browser: it only ever gets a short-lived, room-scoped
LiveKit token. All third-party calls go through the BFF or the agent.

## Tech stack

| Layer | Choice |
| --- | --- |
| Web / BFF | Next.js 15 (App Router), React 19, TypeScript, Tailwind |
| Auth | Clerk |
| Realtime | LiveKit (WebRTC) |
| Voice agent | Python, LiveKit Agents (VAD → STT → LLM → TTS) |
| LLM / STT / TTS | Gemini Flash / Deepgram / Deepgram Aura (behind adapters) |
| Data | Postgres + pgvector, Drizzle ORM |
| Storage | Cloudflare R2 (audio + resumes) |
| Async | Inngest |
| Billing | Stripe |
| Code sandbox | Self-hosted Judge0 |
| Observability | Langfuse, Sentry, PostHog |

## Monorepo layout

```
apps/
  web/        Next.js app + BFF route handlers
  agent/      Python LiveKit Agents worker (the interviewer)
packages/
  db/         Drizzle schema + migrations (Postgres + pgvector)
  shared/     shared TypeScript types + zod schemas (rubric, interview plan)
infra/
  db/         local Postgres init (enables pgvector)
```

## Getting started

**Requirements:** Node 22.13+ (pnpm 11 needs it), pnpm 11, Docker (for local Postgres/Redis).

```bash
pnpm install
pnpm bootstrap              # create .env (linked into apps/web + packages/db)
# → open .env and fill in keys (Clerk + DATABASE_URL to start)
docker compose up -d        # local Postgres (pgvector) + Redis
pnpm db:push                # apply the schema
pnpm dev                    # run the web app
```

### Commands

| Command | What it does |
| --- | --- |
| `pnpm bootstrap` | Create `.env` and link it into `apps/web` + `packages/db` |
| `pnpm dev` | Run apps in dev (Turborepo) |
| `pnpm build` | Build all packages |
| `pnpm lint` / `pnpm typecheck` | Lint / type-check |
| `pnpm test` | Run tests (vitest) |
| `pnpm db:generate` | Generate SQL migrations from the schema |
| `pnpm db:push` | Push the schema straight to the database |

## Security

- **BFF boundary** — the browser never holds provider keys or the LiveKit
  secret, only a short-lived room-scoped token.
- **Authorization** — every interview/report query is scoped to the
  authenticated user. No cross-user reads.
- **Sandboxed code execution** — the coding round runs untrusted code in an
  isolated sandbox with no network and hard CPU/memory/wall-clock limits, never
  in the agent process.
- **Spend caps** — every interview is hard-capped at 10 minutes of wall-clock
  (the voice loop auto-ends and the room is torn down), the coding sandbox is
  bounded per submission (25 runs, 20 KB), and interview creation is rate-limited
  per user (10/hour) so one account cannot drain metered services.

## Roadmap

1. Monorepo scaffold, DB schema, auth, dashboard shell 
2. LiveKit token minting + room join + text echo agent (prove transport) 
3. Real voice loop: turn-based push-to-talk, VAD → STT → LLM → TTS, reconnect handling 
4. Interview state machine + tools + question bank + plan generation 
5. End → async feedback report + rubric radar + transcript playback 
6. Coding round (Monaco + sandbox + `run_code`) 
7. Resume upload + RAG personalization
8. Billing + entitlements, observability, evals, CI/CD
9. UI/UX polish (loading skeletons, transitions, empty/error states)
