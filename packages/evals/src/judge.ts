import { RUBRIC_DIMENSIONS, type FeedbackReport } from "@maven-ai/shared";

// What we assert about a graded report. Deliberately band-based, not exact:
// an LLM grader is non-deterministic, so we check the score lands in a sane
// range and that it names the weaknesses/strengths we planted in the transcript
// — never that it produced a specific number or wording.
export type Expectation = {
  minScore: number;
  maxScore: number;
  // Keyword must appear (case-insensitive) somewhere in gaps + summary.
  gapsInclude?: string[];
  // Keyword must appear (case-insensitive) somewhere in strengths + summary.
  strengthsInclude?: string[];
};

export type JudgeResult = { pass: boolean; failures: string[] };

// Pure, deterministic judge. `feedbackReport.parse` already guarantees the shape
// and 0–10 / 0–100 ranges upstream; this layer checks the *quality* bands the
// fixture expects.
export function judge(
  report: FeedbackReport,
  expect: Expectation,
): JudgeResult {
  const failures: string[] = [];

  if (report.overallScore < expect.minScore)
    failures.push(
      `overallScore ${report.overallScore} below expected min ${expect.minScore}`,
    );
  if (report.overallScore > expect.maxScore)
    failures.push(
      `overallScore ${report.overallScore} above expected max ${expect.maxScore}`,
    );

  for (const d of RUBRIC_DIMENSIONS) {
    const v = report.rubricScores[d];
    if (typeof v !== "number" || v < 0 || v > 10)
      failures.push(`rubric "${d}" = ${v} is not a 0–10 score`);
  }

  const gapsBlob = `${report.gaps.join(" ")} ${report.summary}`.toLowerCase();
  for (const kw of expect.gapsInclude ?? [])
    if (!gapsBlob.includes(kw.toLowerCase()))
      failures.push(`expected gap keyword "${kw}" not surfaced`);

  const strBlob =
    `${report.strengths.join(" ")} ${report.summary}`.toLowerCase();
  for (const kw of expect.strengthsInclude ?? [])
    if (!strBlob.includes(kw.toLowerCase()))
      failures.push(`expected strength keyword "${kw}" not surfaced`);

  return { pass: failures.length === 0, failures };
}
