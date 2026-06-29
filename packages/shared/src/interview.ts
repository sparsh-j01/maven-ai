import { z } from "zod";

// Locked enums — mirror the data model in docs/architecture.md §3.
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

// Optional target-company flavour. It shifts the difficulty band on top of
// seniority (and colours the agent's tone): a product-based bar runs a notch
// harder, a service-based bar a notch easier, a startup stays neutral.
export const companyType = z.enum(["product", "service", "startup"]);
export type CompanyType = z.infer<typeof companyType>;

export const interviewStatus = z.enum([
  "provisioning",
  "live",
  "processing",
  "ready",
  "failed",
]);
export type InterviewStatus = z.infer<typeof interviewStatus>;

// The interview state machine's phases (§2.3). Order matters.
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

// Ascending difficulty, so a band can be shifted by integer steps.
export const DIFFICULTY_ORDER: Difficulty[] = difficulty.options;

// Clamp a difficulty up/down by `steps` (e.g. company flavour: +1 product,
// −1 service). Stays within [easy, hard].
export function shiftDifficulty(d: Difficulty, steps: number): Difficulty {
  const i = DIFFICULTY_ORDER.indexOf(d) + steps;
  return DIFFICULTY_ORDER[Math.max(0, Math.min(DIFFICULTY_ORDER.length - 1, i))]!;
}

// How far a target-company type moves the difficulty band. Undefined → no shift.
const COMPANY_SHIFT: Record<CompanyType, number> = {
  product: 1, // product-based: a higher technical bar
  service: -1, // service-based: fundamentals and breadth, gentler bar
  startup: 0, // pragmatic, middle of the road
};
export function companyDifficultyShift(c?: CompanyType | null): number {
  return c ? COMPANY_SHIFT[c] : 0;
}

export const speaker = z.enum(["candidate", "interviewer"]);
export type Speaker = z.infer<typeof speaker>;

// A single planned question the agent can ask.
export const plannedQuestion = z.object({
  id: z.string(),
  prompt: z.string(),
  competency: z.string(),
  difficulty,
  rubricHint: z.string().optional(),
});
export type PlannedQuestion = z.infer<typeof plannedQuestion>;

// plan_json: the phased, adaptive question plan generated up front (§5).
export const interviewPlan = z.object({
  phases: z.array(
    z.object({
      phase,
      questions: z.array(plannedQuestion),
    }),
  ),
});
export type InterviewPlan = z.infer<typeof interviewPlan>;
