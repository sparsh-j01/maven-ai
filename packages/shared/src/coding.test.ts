import { describe, expect, it } from "vitest";
import { seniority as seniorityEnum } from "./interview";
import {
  CODING_PROBLEMS,
  getCodingProblem,
  LANGUAGES,
  selectCodingProblem,
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

  it("selects a problem for every seniority, matching the difficulty band", () => {
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
      const p = selectCodingProblem(s);
      expect(getCodingProblem(p.id)).toBeDefined();
      expect(p.difficulty).toBe(wanted[s]);
    }
  });

  it("is deterministic — same seniority, same problem", () => {
    expect(selectCodingProblem("mid").id).toBe(selectCodingProblem("mid").id);
  });
});
