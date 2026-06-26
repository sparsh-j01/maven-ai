import { describe, expect, it } from "vitest";
import { PHASE_ORDER, interviewPlan } from "./interview";
import { RUBRIC_DIMENSIONS, feedbackReport, rubricScores } from "./rubric";

describe("rubric", () => {
  it("rubricScores requires every dimension in 0..10", () => {
    const ok = Object.fromEntries(RUBRIC_DIMENSIONS.map((d) => [d, 7]));
    expect(rubricScores.parse(ok)).toEqual(ok);
    // missing a dimension fails
    const { communication: _omit, ...partial } = ok;
    expect(rubricScores.safeParse(partial).success).toBe(false);
    // out of range fails
    expect(rubricScores.safeParse({ ...ok, communication: 11 }).success).toBe(
      false,
    );
  });

  it("feedbackReport validates the async scorer output", () => {
    const report = feedbackReport.parse({
      overallScore: 82,
      rubricScores: Object.fromEntries(RUBRIC_DIMENSIONS.map((d) => [d, 8])),
      summary: "Strong communicator.",
      strengths: ["clear structure"],
      gaps: ["deepen system design"],
      modelAnswers: [{ question: "scale a feed", whatGreatLooksLike: "..." }],
    });
    expect(report.overallScore).toBe(82);
  });
});

describe("interview", () => {
  it("PHASE_ORDER runs intro → wrap_up", () => {
    expect(PHASE_ORDER[0]).toBe("intro");
    expect(PHASE_ORDER.at(-1)).toBe("wrap_up");
  });

  it("interviewPlan parses a phased plan", () => {
    const plan = interviewPlan.parse({
      phases: [
        {
          phase: "warmup",
          questions: [
            { id: "q1", prompt: "Tell me about yourself", competency: "comm", difficulty: "easy" },
          ],
        },
      ],
    });
    expect(plan.phases[0]?.questions[0]?.id).toBe("q1");
  });
});
