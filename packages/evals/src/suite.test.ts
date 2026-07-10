import { describe, expect, it } from "vitest";
import { naiveScorer, oracleScorer, runEvalSuite } from "./suite";

describe("eval suite", () => {
  // The one that matters: a scorer with no understanding must never pass.
  it("rejects a scorer with no understanding", async () => {
    expect((await runEvalSuite(naiveScorer)).passed).toBe(false);
  });

  // ...and the suite isn't just failing everything — an oracle that read the
  // answers passes clean.
  it("accepts a scorer that reads content", async () => {
    const result = await runEvalSuite(oracleScorer);
    expect(result.failures).toEqual([]);
    expect(result.passed).toBe(true);
  })  
});

