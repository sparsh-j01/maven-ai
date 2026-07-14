import {
  buildScorerPrompt,
  feedbackReport,
  feedbackResponseSchema,
  SCORER_SYSTEM,
  type FeedbackReport,
  type ScorerInput,
} from "@maven-ai/shared";
import {
  MODELS,
  SCORER_TEMPERATURE,
  SCORER_TIMEOUT_MS,
} from "@maven-ai/shared/models";

// Same structured-output grading call the async scorer runs in apps/web, minus
// the DB/Inngest plumbing — so the eval exercises the real prompt + schema, not
// a mock. Kept tiny on purpose; the interesting logic lives in shared.
// Model + temperature come from the shared config, so this grades EXACTLY what
// production ships (that's the whole point of the eval as a model gate).
const MODEL = MODELS.scorer;
// Shared with production (SCORER_TIMEOUT_MS). This was 60s while prod was 30s, so the
// eval could pass a grade that production would abort. The gate now measures the same
// budget it ships.
const TIMEOUT_MS = SCORER_TIMEOUT_MS;

// Production's grade step is an Inngest function with retries: 2 — a 429/503 blip
// costs a retry, not the interview. Without the same retries here, a Gemini "high
// demand" 503 failed the eval for a model production would have scored fine. Same
// budget, same attempt count.
const ATTEMPTS = 3;
const transient = (status: number) => status === 429 || status >= 500;

// A 400/403/404 is a bug in the request — the same call will fail the same way three
// times. Everything else that throws (a reset connection, our own abort, a truncated
// body that won't JSON.parse) is weather, and production's Inngest retry rides it out.
class PermanentError extends Error {}

// One grading call, timed. ms is the wall time of the ATTEMPT THAT SUCCEEDED, not
// of the retry chain — SCORER_TIMEOUT_MS aborts a single fetch, so a single fetch
// is what has to fit inside it.
export async function gradeTimed(
  input: ScorerInput,
): Promise<{ report: FeedbackReport; ms: number }> {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GOOGLE_API_KEY is not set — cannot grade");

  const body = {
    systemInstruction: { parts: [{ text: SCORER_SYSTEM }] },
    contents: [{ parts: [{ text: buildScorerPrompt(input) }] }],
    generationConfig: {
      // Shared with production (SCORER_TEMPERATURE, default 0): a deterministic
      // measurement, and the same number the scorer ships with.
      temperature: SCORER_TEMPERATURE,
      responseMimeType: "application/json",
      responseSchema: feedbackResponseSchema,
    },
  };

  let lastErr: Error = new Error("no attempt ran");
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const started = Date.now();
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        },
      );
      if (!res.ok) {
        const msg = `Gemini ${res.status}: ${await res.text()}`;
        throw transient(res.status) ? new Error(msg) : new PermanentError(msg);
      }
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Gemini returned no text");
      return {
        report: feedbackReport.parse(JSON.parse(text)),
        ms: Date.now() - started,
      };
    } catch (e) {
      // Everything transient lands here and spends one attempt: a 503, a dropped
      // socket, our own TIMEOUT_MS abort, a body that came back half-written. Only a
      // permanent HTTP status skips the budget — retrying a 400 just fails slower.
      if (e instanceof PermanentError) throw e;
      lastErr = e as Error;
    } finally {
      clearTimeout(timer);
    }
    // ponytail: fixed backoff, 2s then 4s. Exponential+jitter when a fleet of
    // graders is hammering the same quota; one eval run is not that.
    if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  throw lastErr;
}

export async function grade(input: ScorerInput): Promise<FeedbackReport> {
  return (await gradeTimed(input)).report;
}
