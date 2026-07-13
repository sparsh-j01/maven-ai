# Contributing

The README covers what Maven is and how to install it. This covers what you need
to know once the app is running: how the four processes fit together, what has to
be green before you push, and where to add things.

## Running the whole thing

Maven is not one process. In development it is four, and a change to the voice
loop is only real once you have all of them up:

| Process | Command | Why it's separate |
| --- | --- | --- |
| Postgres (pgvector) | `docker compose up -d` | The question bank uses vector search. |
| Web / BFF | `pnpm dev` | Request/response, serverless-friendly. |
| Voice agent | `cd apps/agent && .venv/bin/python main.py dev` | A long-lived worker that holds an audio session open for minutes. It dials out to LiveKit and never accepts inbound HTTP, so it cannot run on Vercel. |
| Async jobs | `INNGEST_DEV=1 npx inngest-cli@latest dev -u http://localhost:3000/api/inngest` | Scoring happens after the call ends, durably. |

`pnpm bootstrap` creates `.env` and symlinks it into `apps/web` and `packages/db`.
Point the Inngest `-u` flag at whatever port `next dev` actually chose.

You can get a long way with just Postgres + the web app: everything except the
live interview itself (setup, plan generation, dashboard, reports on existing
data) works without the agent running.

## Before you push

All four must be green:

```bash
pnpm typecheck
pnpm lint
pnpm test        # vitest, no API calls
pnpm eval:sanity # asserts a word-count scorer is REJECTED by the eval suite
```

`pnpm eval:sanity` needs no API key and takes seconds. Run it. It is the check that
stops the eval suite from silently degrading into one that rewards whoever talked
the most.

**If you changed the scorer, its prompt, its model, or its temperature**, that is
not enough. Run the real gate:

```bash
pnpm eval:live   # the actual grader against every assertion (~5 API calls)
```

It reads the same `SCORER_MODEL` and `SCORER_TEMPERATURE` the app does, so a green
run means the model you are about to ship grades the golden transcripts correctly.
Run it more than once. An LLM number is only trustworthy once it is stable across
runs.

## Where things live

- **A new interview question** → the `BANK` array in `packages/shared/src/plan.ts`.
  Every question is human-written and selected deterministically by phase and
  seniority. The model never invents one: personalization (RAG) only reorders and
  sub-selects from this same bank, which is what keeps a generated plan grounded.
- **A new coding problem** → `packages/shared/src/coding.ts`. Every problem needs at
  least two *hidden* test cases whose expected answers differ from each other, and
  `apps/agent/test_coding_contract.py` enforces that. A problem that can be passed by
  hardcoding the visible example is not a problem.
- **A rubric change** → `packages/shared/src/rubric.ts`, and expect to update the eval
  fixtures in `packages/evals` with it.
- **Anything the model reads** → keep candidate résumé and job-description text as
  clearly delimited *data*, never as instructions. The generated plan is grounded to
  the curated bank so a hijacked or malformed model response degrades to the
  deterministic plan rather than doing whatever the résumé said.

## Rules that are not negotiable

- **No provider keys in the browser.** The client gets a short-lived, room-scoped
  LiveKit token and nothing else. Every third-party call goes through the BFF or the
  agent.
- **Every interview and report query is scoped to the authenticated user.** No
  cross-user reads, ever.
- **Untrusted code runs in the sandbox, never in the agent process.**
- **Never widen a spend gate casually.** The live voice session is the expensive path
  (LiveKit + STT + LLM + TTS). It starts only after an admin approves the request,
  interviews are hard-capped at 10 minutes of wall clock, and interview creation is
  rate-limited per user. Those numbers are the cost model, not decoration.

## Commits

Conventional and focused: `feat:`, `fix:`, `chore:`, `docs:`, `harden:`. One logical
change per commit, and each commit should build on its own. Prefer several honest
atomic commits over one squashed blob, but never pad the count with filler.
