import {
  codeSubmissions,
  feedbackReports,
  getDb,
  interviews,
  interviewTurns,
  users,
} from "@maven-ai/db";
import {
  buildScorerPrompt,
  feedbackReport,
  feedbackSchemaFor,
  SCORER_SYSTEM,
  transcriptIsThin,
  type FeedbackReport,
  type InterviewType,
  type ScorerInput,
  type Seniority,
  type Speaker,
} from "@maven-ai/shared";
import { MODELS, SCORER_TEMPERATURE } from "@maven-ai/shared/models";
import { asc, eq } from "drizzle-orm";
import { inngest } from "./inngest";

// Model + temperature come from the shared config so this and the eval grader
// can't drift (swap via SCORER_MODEL, then `pnpm eval`). Default is flash, not
// Pro: gemini-2.5-pro is paid-tier only (free tier = 0 quota) and would 429.
const MODEL = MODELS.scorer;
const TIMEOUT_MS = 30_000;

type Loaded = { hasReport: boolean; isPro: boolean; input: ScorerInput };

async function loadInterview(interviewId: string): Promise<Loaded | null> {
  const db = getDb();
  const [iv] = await db
    .select({
      role: interviews.role,
      company: interviews.company,
      seniority: interviews.seniority,
      type: interviews.type,
      resumeText: interviews.resumeText,
      plan: users.plan,
    })
    .from(interviews)
    .leftJoin(users, eq(users.id, interviews.userId))
    .where(eq(interviews.id, interviewId));
  if (!iv) return null;

  const existing = await db
    .select({ id: feedbackReports.id })
    .from(feedbackReports)
    .where(eq(feedbackReports.interviewId, interviewId))
    .limit(1);

  // Ordered by start offset (index-covered) — the order the report renders.
  const turns = await db
    .select({ speaker: interviewTurns.speaker, text: interviewTurns.text })
    .from(interviewTurns)
    .where(eq(interviewTurns.interviewId, interviewId))
    .orderBy(asc(interviewTurns.tsStartMs));

  const code = await db
    .select({
      language: codeSubmissions.language,
      code: codeSubmissions.code,
      execPassed: codeSubmissions.execPassed,
    })
    .from(codeSubmissions)
    .where(eq(codeSubmissions.interviewId, interviewId));

  return {
    hasReport: existing.length > 0,
    isPro: iv.plan === "pro",
    input: {
      role: iv.role,
      company: iv.company,
      seniority: iv.seniority as Seniority,
      type: iv.type as InterviewType,
      resumeText: iv.resumeText,
      transcript: turns.map((t) => ({
        speaker: t.speaker as Speaker,
        text: t.text,
      })),
      code: code.map((c) => ({
        language: c.language,
        code: c.code,
        execPassed: c.execPassed,
      })),
    },
  };
}

async function gradeWithGemini(
  input: ScorerInput,
  includeStudyPlan: boolean,
): Promise<FeedbackReport> {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GOOGLE_API_KEY is not set — cannot score");

  const body = {
    systemInstruction: { parts: [{ text: SCORER_SYSTEM }] },
    contents: [
      { parts: [{ text: buildScorerPrompt(input, { includeStudyPlan }) }] },
    ],
    generationConfig: {
      temperature: SCORER_TEMPERATURE,
      responseMimeType: "application/json",
      responseSchema: feedbackSchemaFor(includeStudyPlan),
    },
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let json: unknown;
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
    json = await res.json();
  } finally {
    clearTimeout(timer);
  }

  const text = (json as GeminiResponse)?.candidates?.[0]?.content?.parts?.[0]
    ?.text;
  if (!text) throw new Error("Gemini returned no text");
  // zod is the real gate — a malformed or out-of-range score can't reach the DB.
  return feedbackReport.parse(JSON.parse(text));
}

// Below a floor of real candidate speech, flag the report so the score isn't read
// as trustworthy (checklist 4.3). transcriptIsThin lives in shared (tested there).
const LOW_QUALITY_CAVEAT =
  "⚠ Transcript quality low — this interview was very short or hard to " +
  "transcribe, so the score below may be unreliable. ";

async function writeReport(
  interviewId: string,
  report: FeedbackReport,
): Promise<void> {
  const db = getDb();
  // delete-then-insert keeps this step idempotent if Inngest retries it after a
  // partial write.
  await db
    .delete(feedbackReports)
    .where(eq(feedbackReports.interviewId, interviewId));
  await db.insert(feedbackReports).values({
    interviewId,
    overallScore: String(report.overallScore), // numeric column takes a string
    rubricScores: report.rubricScores,
    summary: report.summary,
    strengths: report.strengths,
    gaps: report.gaps,
    modelAnswers: report.modelAnswers,
    studyPlan: report.studyPlan ?? null,
  });
  await db
    .update(interviews)
    .set({ status: "ready" })
    .where(eq(interviews.id, interviewId));
}

async function markFailed(interviewId: string): Promise<void> {
  await getDb()
    .update(interviews)
    .set({ status: "failed" })
    .where(eq(interviews.id, interviewId));
}

// The durable scorer: loads the transcript, runs one structured grading call, writes
// the report. Off the request path; left `failed` (retryable from the report page)
// once retries are exhausted.
export const scoreInterview = inngest.createFunction(
  {
    id: "score-interview",
    retries: 2,
    triggers: [{ event: "interview/ended" }],
    onFailure: async ({ event }) => {
      const id = failedInterviewId(event);
      if (id) await markFailed(id);
    },
  },
  async ({ event, step }) => {
    const interviewId = String((event.data as { interviewId: string }).interviewId);

    const loaded = await step.run("load-interview", () =>
      loadInterview(interviewId),
    );
    if (!loaded) return { skipped: "interview not found" };
    if (loaded.hasReport) return { skipped: "already scored" };
    if (loaded.input.transcript.length === 0) {
      await step.run("mark-failed", () => markFailed(interviewId));
      return { skipped: "empty transcript" };
    }

    const report = await step.run("grade", () =>
      gradeWithGemini(loaded.input, loaded.isPro),
    );
    const finalReport = transcriptIsThin(loaded.input.transcript)
      ? { ...report, summary: LOW_QUALITY_CAVEAT + report.summary }
      : report;
    await step.run("persist", () => writeReport(interviewId, finalReport));
    return { ok: true, overallScore: finalReport.overallScore };
  },
);

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

// The failure event nests the original trigger under data.event; read it defensively.
function failedInterviewId(event: unknown): string | undefined {
  const original = (
    event as { data?: { event?: { data?: { interviewId?: string } } } }
  )?.data?.event?.data;
  return original?.interviewId;
}
