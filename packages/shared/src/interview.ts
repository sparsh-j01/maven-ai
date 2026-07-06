import { z } from "zod";

export const seniority = z.enum([
  "intern",
  "junior",
  "mid",
  "senior",
  "sde1",
  "sde2",
  "sde3",
]);
export type Seniority = z.infer<typeof seniority>;

export const interviewType = z.enum([
  "technical",
  "behavioral",
  "mixed",
  "system_design",
]);
export type InterviewType = z.infer<typeof interviewType>;

export const companyType = z.enum(["product", "service", "startup"]);
export type CompanyType = z.infer<typeof companyType>;

// Order matters — PHASE_ORDER depends on it.
export const phase = z.enum([
  "intro",
  "warmup",
  "technical",
  "coding",
  "behavioral",
  "wrap_up",
]);
export type Phase = z.infer<typeof phase>;
export const PHASE_ORDER: Phase[] = phase.options;

export const difficulty = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof difficulty>;

// Ascending, so a band can be shifted by integer steps.
export const DIFFICULTY_ORDER: Difficulty[] = difficulty.options;

// Clamp a difficulty by `steps`, staying within [easy, hard].
export function shiftDifficulty(d: Difficulty, steps: number): Difficulty {
  const i = DIFFICULTY_ORDER.indexOf(d) + steps;
  return DIFFICULTY_ORDER[Math.max(0, Math.min(DIFFICULTY_ORDER.length - 1, i))]!;
}

// How far a target-company type moves the difficulty band (product harder, service easier).
const COMPANY_SHIFT: Record<CompanyType, number> = {
  product: 1,
  service: -1,
  startup: 0,
};
export function companyDifficultyShift(c?: CompanyType | null): number {
  return c ? COMPANY_SHIFT[c] : 0;
}

export const speaker = z.enum(["candidate", "interviewer"]);
export type Speaker = z.infer<typeof speaker>;

export const plannedQuestion = z.object({
  id: z.string(),
  prompt: z.string(),
  competency: z.string(),
  difficulty,
  rubricHint: z.string().optional(),
});
export type PlannedQuestion = z.infer<typeof plannedQuestion>;

// The phased, adaptive question plan (plan_json).
export const interviewPlan = z.object({
  phases: z.array(
    z.object({
      phase,
      questions: z.array(plannedQuestion),
    }),
  ),
});
export type InterviewPlan = z.infer<typeof interviewPlan>;
