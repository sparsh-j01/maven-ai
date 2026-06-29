import { describe, expect, it } from "vitest";
import { interviewPlan, interviewType } from "./interview";
import {
  assemblePlan,
  buildPlan,
  planCandidates,
  seniorityDifficulty,
} from "./plan";

const phasesOf = (p: ReturnType<typeof buildPlan>) =>
  p.phases.map((ph) => ph.phase);
const phase = (p: ReturnType<typeof buildPlan>, name: string) =>
  p.phases.find((ph) => ph.phase === name);

describe("buildPlan", () => {
  it("produces a schema-valid plan for every interview type", () => {
    for (const type of interviewType.options) {
      const plan = buildPlan({ role: "Software Engineer", seniority: "mid", type });
      expect(interviewPlan.safeParse(plan).success).toBe(true);
      // intro + wrap_up always bracket the interview, and carry no bank question.
      expect(phasesOf(plan).at(0)).toBe("intro");
      expect(phasesOf(plan).at(-1)).toBe("wrap_up");
      expect(phase(plan, "intro")!.questions).toHaveLength(0);
      expect(phase(plan, "wrap_up")!.questions).toHaveLength(0);
    }
  });

  it("includes phases matching the type (mixed has both technical and behavioral)", () => {
    expect(phasesOf(buildPlan({ role: "X", seniority: "mid", type: "behavioral" }))).not.toContain("technical");
    const mixed = buildPlan({ role: "X", seniority: "mid", type: "mixed" });
    expect(phase(mixed, "technical")!.questions.length).toBeGreaterThan(0);
    expect(phase(mixed, "behavioral")!.questions.length).toBeGreaterThan(0);
  });

  it("adds a coding round for technical/mixed but not behavioral/system_design", () => {
    for (const type of ["technical", "mixed"] as const) {
      const coding = phase(buildPlan({ role: "X", seniority: "mid", type }), "coding");
      expect(coding!.questions).toHaveLength(1);
      // the coding question references a real coding problem by id
      expect(coding!.questions[0]!.id).toBe("c-max-subarray");
    }
    expect(phasesOf(buildPlan({ role: "X", seniority: "mid", type: "behavioral" }))).not.toContain("coding");
    expect(phasesOf(buildPlan({ role: "X", seniority: "mid", type: "system_design" }))).not.toContain("coding");
  });

  it("draws system-design questions only for the system_design type", () => {
    const sd = buildPlan({ role: "X", seniority: "senior", type: "system_design" });
    expect(phase(sd, "technical")!.questions.every((q) => /system design/i.test(q.competency))).toBe(true);
    const tech = buildPlan({ role: "X", seniority: "senior", type: "technical" });
    expect(phase(tech, "technical")!.questions.some((q) => /system design/i.test(q.competency))).toBe(false);
  });

  it("scales technical difficulty with seniority", () => {
    const intern = buildPlan({ role: "X", seniority: "intern", type: "technical" });
    expect(phase(intern, "technical")!.questions.every((q) => q.difficulty === "easy")).toBe(true);
    const senior = buildPlan({ role: "X", seniority: "senior", type: "technical" });
    expect(phase(senior, "technical")!.questions.some((q) => q.difficulty === "hard")).toBe(true);
  });

  it("surfaces a role-specific question for a matching role", () => {
    const fe = buildPlan({ role: "Frontend Engineer", seniority: "mid", type: "technical" });
    expect(phase(fe, "technical")!.questions.some((q) => q.id === "t-fe-render")).toBe(true);
    // a non-matching role never sees the frontend-specific question
    const be = buildPlan({ role: "Backend Engineer", seniority: "mid", type: "technical" });
    expect(phase(be, "technical")!.questions.some((q) => q.id === "t-fe-render")).toBe(false);
  });

  it("never repeats a question within a plan", () => {
    const plan = buildPlan({ role: "Full Stack Engineer", seniority: "mid", type: "mixed" });
    const ids = plan.phases.flatMap((ph) => ph.questions.map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("maps SDE 1/2/3 to escalating headline difficulty", () => {
    expect(seniorityDifficulty("sde1")).toBe("easy");
    expect(seniorityDifficulty("sde2")).toBe("medium");
    expect(seniorityDifficulty("sde3")).toBe("hard");
    // and SDE 3 actually pulls a hard technical question
    const p = buildPlan({ role: "X", seniority: "sde3", type: "technical" });
    expect(
      phase(p, "technical")!.questions.some((q) => q.difficulty === "hard"),
    ).toBe(true);
  });
});

describe("assemblePlan / planCandidates (tier B personalization)", () => {
  const input = { role: "Backend Engineer", seniority: "mid", type: "mixed" } as const;

  it("with no choices, equals the deterministic plan", () => {
    expect(assemblePlan(input, {})).toEqual(buildPlan(input));
  });

  it("honors a valid chosen order, capped at the phase count", () => {
    const tech = planCandidates(input).find((c) => c.phase === "technical")!;
    const last = tech.options.at(-1)!.id; // not normally first → proves reordering
    const techQs = phase(assemblePlan(input, { technical: [last] }), "technical")!
      .questions;
    expect(techQs[0]!.id).toBe(last);
    expect(techQs).toHaveLength(tech.count);
  });

  it("drops unknown / foreign-phase ids and stays grounded in the bank", () => {
    const tech = planCandidates(input).find((c) => c.phase === "technical")!;
    const validIds = new Set(tech.options.map((o) => o.id));
    // "nope" doesn't exist; "b-conflict" is a behavioral id — both must be ignored.
    const techQs = phase(
      assemblePlan(input, { technical: ["nope", "b-conflict"] }),
      "technical",
    )!.questions;
    expect(techQs.every((q) => validIds.has(q.id))).toBe(true);
    expect(techQs).toHaveLength(tech.count);
  });

  it("exposes only selectable phases, each with bank-drawn options", () => {
    const cands = planCandidates(input);
    expect(cands.map((c) => c.phase)).toEqual(["warmup", "technical", "behavioral"]);
    for (const c of cands) {
      expect(c.options.length).toBeGreaterThanOrEqual(1);
      expect(c.count).toBeGreaterThanOrEqual(1);
    }
  });
});
