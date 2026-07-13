# Changelog

All notable changes to this project. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The project is
pre-1.0 and has not cut a tagged release yet, so everything below sits under
Unreleased, grouped by the milestone it shipped in.

## [Unreleased]

### Launch hardening — 2026-07-12

- **Razorpay is the only payment gateway.** Stripe removed (library, webhook,
  dependency, env). The Razorpay path was previously unreachable: checkout only
  took it when its env keys were set, so it always fell through to Stripe. Every
  region now checks out via Razorpay. The `stripe*` subscription columns are kept
  as generic gateway ids, so no migration.
- **Interviews are request-gated.** An interview is created as `requested`. The
  `/token` route (the costly LiveKit + STT + LLM + TTS path) returns 403 until an
  admin approves it from `/admin` (allowlisted by Clerk user id via
  `ADMIN_USER_IDS`). Candidates can set up an interview and generate its question
  plan for free; only starting the live session is gated.
- **Admin operations dashboard.** `/admin` shows pending, in-flight and completed
  counts plus the last 7 days' average score across all users, the approval queue,
  and a live activity feed.
- **One source of truth for models.** Every model id comes from env vars, read by
  `packages/shared/src/models.ts` (TypeScript) and `apps/agent/models.py` (agent).
  The scorer model *and* its temperature feed both production and the eval, so
  `pnpm eval:live` measures exactly what ships, and swapping a model is a config
  change proven by the eval. Fixes a scorer temperature mismatch (0.2 in
  production vs 0 in the eval).
- **Coding submissions grade against multiple hidden test cases.** Passing the one
  visible example is no longer passing; the candidate must pass every hidden case.
- **Transcript-quality floor.** `transcriptIsThin` flags reports built on too
  little signal instead of inventing a confident score.
- **Deploy artifacts.** Agent `Dockerfile` (Python 3.12) + `fly.toml`; Judge0
  hosted CE (RapidAPI) support in the sandbox client; CI builds the web app and
  runs the Python grader tests.
- **Link previews.** Generated Open Graph card (`app/opengraph-image.tsx`) plus
  `openGraph` metadata, so a shared link renders a real card.
- Dropped unused Upstash env and the unused Redis container from
  `docker-compose.yml`. Rate limiting is a Postgres `COUNT` (10 interviews/hour
  per user), not Redis.
- Added `pnpm eval:sanity` and `pnpm eval:live` to the root scripts. Both were
  documented in the README but only existed in the evals package, so neither ran
  from the repo root.

### Design pass — 2026-07-09

- "Viva Glass" design system across the whole app: glass surfaces, animated
  landing hero, loading skeletons, empty / error / not-found states, legal pages,
  geo-based pricing display, enforced Content-Security-Policy.

### Billing, entitlements, observability, evals, CI — 2026-07-02

- Plans and entitlements: free (3 fully-tailored interviews/month) vs Pro
  (unlimited), monthly or annual.
- Scorer eval harness (`packages/evals`) with golden transcripts, including the
  adversarial `long-confident-wrong` and `short-hesitant-right` cases that a
  word-count scorer cannot pass. `pnpm eval:sanity` asserts a deliberately dumb
  word-count scorer is *rejected*, so the suite can never silently degrade into
  one that measures verbosity.
- Langfuse (LLM traces), Sentry, and PostHog wired. GitHub Actions CI.

### Resume upload + RAG personalization — 2026-07-01

- PDF resume upload, text extraction, and storage on Cloudflare R2.
- Resume and role embedded and matched against the curated question bank
  (Postgres + pgvector), so generated questions stay grounded.

### Coding round — 2026-06-30

- Monaco editor in the browser, code executed in a sandboxed Judge0 runner with no
  network and hard CPU / memory / wall-clock limits.
- The agent drives it with a `run_code` tool mid-conversation; every coding round
  is two problems, leveled by seniority, and the editor switches when the agent
  signals which problem is active.

### Async scored feedback report — 2026-06-29

- Interviews end instantly; a durable Inngest job grades the transcript against the
  rubric with structured output and drafts model answers for weak responses.
- Rubric radar chart, full replayable transcript, report screen.

### Interview state machine — 2026-06-28

- Plan-driven interview: `intro → warmup → technical → coding → behavioral → wrap_up`,
  driven by tool-use. The plan cursor is persisted, so an agent restart resumes where
  it left off.
- Curated question bank and personalized plan generation; each turn persisted to the
  transcript.

### Voice loop — 2026-06-27

- Turn-based STT → LLM → TTS pipeline over LiveKit/WebRTC with push-to-talk and
  manual turn control (no barge-in), so pausing mid-answer to think never cuts the
  candidate off. Reconnect handling.
- The browser only ever receives a short-lived, microphone-scoped LiveKit token.

### Scaffold — 2026-06-26

- pnpm + Turborepo monorepo: Next.js 15 web app / BFF, Python LiveKit Agents worker,
  Drizzle schema on Postgres + pgvector, shared TypeScript contracts.
- Clerk auth, baseline security headers.
