import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { backstopStuckScoring, scoreInterview } from "@/lib/score-interview";

// Inngest reaches the durable functions through this endpoint (§10). The local
// dev server discovers it at /api/inngest; in prod Inngest Cloud calls it.

// Inngest invokes this endpoint once PER STEP, so the `grade` step is a single
// request that must outlive one Gemini call (SCORER_TIMEOUT_MS, 45s). Vercel's
// default is 10s, which killed it, retried twice, and marked the interview `failed`
// — invisible locally, where `next dev` has no timeout. 60s is the Hobby ceiling.
export const maxDuration = 60;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scoreInterview, backstopStuckScoring],
});
