import { describe, expect, it } from "vitest";
import { CASES } from "./fixtures";
import { judge } from "./judge";

// Offline check (runs in CI): every bundled sampleReport must satisfy its own
// expectation, and the judge must actually fail when a band is violated. This
// keeps the fixtures honest without spending an API call.
describe("judge", () => {
  it("passes each fixture's sample report against its expectation", () => {
    for (const c of CASES) {
      const result = judge(c.sampleReport, c.expect);
      expect(result.failures, `${c.name}: ${result.failures.join("; ")}`).toEqual([]);
    }
  });

  it("fails when the overall score is out of band", () => {
    const c = CASES[0]!;
    const result = judge(
      { ...c.sampleReport, overallScore: 10 },
      c.expect,
    );
    expect(result.pass).toBe(false);
  });

  it("fails when an expected keyword is missing", () => {
    const result = judge(CASES[0]!.sampleReport, {
      minScore: 0,
      maxScore: 100,
      gapsInclude: ["kubernetes"],
    });
    expect(result.pass).toBe(false);
  });
});
