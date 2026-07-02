import {
  buildScorerPrompt,
  feedbackReport,
  feedbackResponseSchema,
  SCORER_SYSTEM,
  type FeedbackReport,
  type ScorerInput,
} from "@maven-ai/shared";

// Same structured-output grading call the async scorer runs in apps/web, minus
// the DB/Inngest plumbing — so the eval exercises the real prompt + schema, not
// a mock. Kept tiny on purpose; the interesting logic lives in shared.
const MODEL = "gemini-2.5-flash";
const TIMEOUT_MS = 30_000;

export async function grade(input: ScorerInput): Promise<FeedbackReport> {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GOOGLE_API_KEY is not set — cannot grade");

  const body = {
    systemInstruction: { parts: [{ text: SCORER_SYSTEM }] },
    contents: [{ parts: [{ text: buildScorerPrompt(input) }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: feedbackResponseSchema,
    },
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
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
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned no text");
    return feedbackReport.parse(JSON.parse(text));
  } finally {
    clearTimeout(timer);
  }
}
