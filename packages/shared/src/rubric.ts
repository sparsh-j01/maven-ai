import { z } from "zod";

// Locked rubric dimensions: the report radar axes and feedback_reports.rubric_scores keys.
export const RUBRIC_DIMENSIONS = [
  "communication",
  "problem_solving",
  "technical_depth",
  "code_quality",
  "culture_fit",
] as const;
export type RubricDimension = (typeof RUBRIC_DIMENSIONS)[number];

const score10 = z.number().min(0).max(10);

export const rubricScores = z.object(
  Object.fromEntries(RUBRIC_DIMENSIONS.map((d) => [d, score10])) as Record<
    RubricDimension,
    typeof score10
  >,
);
export type RubricScores = z.infer<typeof rubricScores>;

export const modelAnswer = z.object({
  question: z.string(),
  whatGreatLooksLike: z.string(),
});

// The structured-output shape the scorer must produce.
export const feedbackReport = z.object({
  overallScore: z.number().min(0).max(100),
  rubricScores,
  summary: z.string(),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  modelAnswers: z.array(modelAnswer),
});
export type FeedbackReport = z.infer<typeof feedbackReport>;
