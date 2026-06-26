import { z } from "zod";

// Locked enums — mirror the data model in docs/architecture.md §3.
export const seniority = z.enum(["intern", "junior", "mid", "senior"]);
export type Seniority = z.infer<typeof seniority>;

export const interviewType = z.enum([
  "technical",
  "behavioral",
  "mixed",
  "system_design",
]);
export type InterviewType = z.infer<typeof interviewType>;

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
