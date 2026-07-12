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
