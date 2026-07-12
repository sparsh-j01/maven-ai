import { transcriptIsThin } from "@maven-ai/shared";
import { describe, expect, it } from "vitest";
import { GARBLED_STT_CASE } from "./fixtures";
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

// Checklist 4.4: the real garbled transcript that production scored 15/100. The
// grader can't recover signal that STT destroyed, so the mitigation is the
// production floor flagging the report — assert it catches this exact case.
describe("garbage-input floor", () => {
  it("flags the real garbled transcript as thin", () => {
    expect(transcriptIsThin(GARBLED_STT_CASE.input.transcript)).toBe(true);
  });
});

