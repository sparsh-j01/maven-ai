import { describe, expect, it } from "vitest";
import { seniority as seniorityEnum } from "./interview";
import {
  CODING_COUNT,
  CODING_PROBLEMS,
  getCodingProblem,
  LANGUAGES,
  selectCodingProblems,
  STARTER_BY_LANGUAGE,
} from "./coding";

describe("coding bank", () => {
  it("has unique problem ids and a starter for every language", () => {
    const ids = CODING_PROBLEMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const lang of LANGUAGES) {
      expect(STARTER_BY_LANGUAGE[lang]).toBeTruthy();
    }
  });

  it("has at least CODING_COUNT problems in every difficulty band", () => {
    for (const d of ["easy", "medium", "hard"] as const) {
      expect(
        CODING_PROBLEMS.filter((p) => p.difficulty === d).length,
      ).toBeGreaterThanOrEqual(CODING_COUNT);
    }
  });

  it("looks a problem up by id, and returns undefined for an unknown id", () => {
    expect(getCodingProblem("c-fizzbuzz")?.title).toBe("FizzBuzz");
    expect(getCodingProblem("nope")).toBeUndefined();
  });

  it("always picks two distinct problems, leveled by seniority", () => {
    const wanted: Record<string, string> = {
      intern: "easy",
      junior: "easy",
      sde1: "easy",
      mid: "medium",
      sde2: "medium",
      senior: "hard",
      sde3: "hard",
    };
    for (const s of seniorityEnum.options) {
      const picked = selectCodingProblems(s);
      // count is fixed (never scaled by seniority), and the two are distinct
      expect(picked).toHaveLength(CODING_COUNT);
      expect(new Set(picked.map((p) => p.id)).size).toBe(picked.length);
      // both sit at the seniority's difficulty band
      expect(picked.every((p) => p.difficulty === wanted[s])).toBe(true);
    }
  });

  it("shifts the band by company type (product harder, service easier)", () => {
    // mid seniority is medium; product bumps it up, service down.
    expect(
      selectCodingProblems("mid", "product").every((p) => p.difficulty === "hard"),
    ).toBe(true);
    expect(
      selectCodingProblems("mid", "service").every((p) => p.difficulty === "easy"),
    ).toBe(true);
    expect(
      selectCodingProblems("mid", "startup").every((p) => p.difficulty === "medium"),
    ).toBe(true);
  });

  it("draws at random from the band — not the same two every time", () => {
    // Over many draws the picks vary (band has > 2 problems), while every pick
    // stays a valid distinct pair in the right band.
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const picked = selectCodingProblems("mid");
      expect(picked.every((p) => p.difficulty === "medium")).toBe(true);
      seen.add(picked.map((p) => p.id).sort().join(","));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
