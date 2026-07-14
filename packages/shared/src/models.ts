// Central AI model config — the single source of truth for the TS side (the
// Python agent mirrors these via the same env vars; see apps/agent/models.py).
//
// Swap a model by setting its env var (no code change), then run `pnpm eval` to
// prove the new model is good enough before shipping it (see README → "Swapping a
// model"). Because the scorer id + temperature below feed BOTH the production
// score path (apps/web/lib/score-interview.ts) AND the eval grader
// (packages/evals/src/grade.ts), the eval always measures exactly what ships.
//
// Server-only: reads process.env. Imported via the "@maven-ai/shared/models"
// subpath so it never lands in a client bundle.

const env = (key: string, fallback: string): string =>
  process.env[key]?.trim() || fallback;

export const MODELS = {
  // Grades interviews (the async scorer) and the eval grader — one value so the
  // eval can never grade a model you don't ship.
  scorer: env("SCORER_MODEL", "gemini-2.5-flash"),
  // Personalizes the phased question plan from résumé/JD.
  plan: env("PLAN_MODEL", "gemini-2.5-flash"),
  // Structures a pasted/uploaded résumé into skills/experience.
  resume: env("RESUME_MODEL", "gemini-2.5-flash"),
} as const;

// The scorer must be deterministic — checklist 1.4 saw temperature 0.2 swing
// correctness ±18. Production scoring and the eval both read this, so they can't
// diverge. Override with SCORER_TEMPERATURE only if you know why.
const rawTemp = Number(env("SCORER_TEMPERATURE", "0"));
export const SCORER_TEMPERATURE = Number.isFinite(rawTemp) ? rawTemp : 0;

// How long one grading call may take. Checklist 1.1: this was 30s in production and
// 60s in the eval, so the eval was measuring a model with twice the budget prod gave
// it — a grade taking 40s passed the eval and failed the customer. One number now,
// read by both.
//
// 45s, not 60s: the Vercel function that runs the scorer is capped at 60s
// (maxDuration in api/inngest), and the abort must fire BEFORE the platform kills the
// invocation — otherwise there's no clean error to retry, just a dead request. 45s
// leaves room for the DB write after the call returns.
//
// It is still a guess, not a measurement. `pnpm eval:live --runs=3` prints the real
// duration: once you have it, set this from that number.
//
// The override is clamped, not trusted: SCORER_TIMEOUT_MS=90000 would let the abort
// fire AFTER Vercel has already killed the 60s invocation (maxDuration in
// api/inngest/route.ts) — no clean error to retry, just a dead request. The ceiling is
// the thing this timeout exists to stay under.
const ROUTE_LIMIT_MS = 60_000; // maxDuration in apps/web/app/api/inngest/route.ts
const CEILING_MS = 50_000; // leaves ~10s for the DB write after the call returns
const rawTimeout = Number(env("SCORER_TIMEOUT_MS", "45000"));
export const SCORER_TIMEOUT_MS =
  Number.isFinite(rawTimeout) && rawTimeout > 0
    ? Math.min(rawTimeout, CEILING_MS)
    : 45_000;
if (rawTimeout > CEILING_MS) {
  console.warn(
    `SCORER_TIMEOUT_MS=${rawTimeout} exceeds the ${ROUTE_LIMIT_MS}ms route limit — clamped to ${CEILING_MS}`,
  );
}
