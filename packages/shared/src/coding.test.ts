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
      // both sit at the seniority's difficulty band (the bank has two each)
      expect(picked.every((p) => p.difficulty === wanted[s])).toBe(true);
    }
  });

  it("is deterministic — same seniority, same problems", () => {
    expect(selectCodingProblems("mid").map((p) => p.id)).toEqual(
      selectCodingProblems("mid").map((p) => p.id),
    );
  });
});
