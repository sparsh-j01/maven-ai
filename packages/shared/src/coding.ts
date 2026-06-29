import type { Difficulty, Seniority } from "./interview";

// Milestone 6: the live coding round. Each problem is a classic stdin → stdout
// task so the sandbox (Judge0, §8) can grade it by comparing program output to an
// expected output — no per-language test harness needed. The PUBLIC half lives
// here: the statement the agent reads aloud + the browser shows, and the starter
// code Monaco loads. The SECRET half (the exact stdin + expected stdout used to
// grade) lives only with the grader — the agent's apps/agent/coding.py — so it
// never rides to the browser in room metadata where a candidate could read it and
// hard-code the answer (F1, §8.1). The two halves are linked by problem `id`.

export const LANGUAGES = ["python", "javascript"] as const;
export type Language = (typeof LANGUAGES)[number];

// Generic starter per language: read all of stdin into `data`, print the answer.
// ponytail: one stub per language, shared across problems. Per-problem signatures
// (parsing scaffolded for the candidate) are a nicety to add when a problem needs it.
export const STARTER_BY_LANGUAGE: Record<Language, string> = {
  python: `import sys

data = sys.stdin.read()
# Read your input from \`data\`, then print the answer.
# TODO: implement your solution
`,
  javascript: `const data = require("fs").readFileSync(0, "utf8");
// Read your input from \`data\`, then console.log the answer.
// TODO: implement your solution
`,
};

export interface CodingProblem {
  id: string;
  title: string;
  // Statement, including the exact input/output format (the grader matches stdout).
  prompt: string;
  difficulty: Difficulty;
}

export const CODING_PROBLEMS: CodingProblem[] = [
  {
    id: "c-fizzbuzz",
    title: "FizzBuzz",
    difficulty: "easy",
    prompt:
      "Read an integer N from input, then print the numbers 1 to N, one per line. " +
      "For multiples of 3 print \"Fizz\" instead of the number, for multiples of 5 " +
      "print \"Buzz\", and for multiples of both print \"FizzBuzz\".",
  },
  {
    id: "c-max-subarray",
    title: "Maximum subarray sum",
    difficulty: "medium",
    prompt:
      "The first line of input contains an integer N. The second line contains N " +
      "space-separated integers (which may be negative). Print the largest sum " +
      "obtainable from any single contiguous subarray.",
  },
  {
    id: "c-longest-unique",
    title: "Longest substring without repeating characters",
    difficulty: "hard",
    prompt:
      "Read a single line containing a string. Print the length of the longest " +
      "substring that contains no repeating characters.",
  },
  {
    id: "c-vowel-count",
    title: "Count the vowels",
    difficulty: "easy",
    prompt:
      "Read a single line of text. Print the number of vowels (a, e, i, o, u, " +
      "case-insensitive) it contains.",
  },
  {
    id: "c-two-sum",
    title: "Two sum exists",
    difficulty: "medium",
    prompt:
      "The first line contains an integer N. The second line contains N " +
      "space-separated integers. The third line contains a target integer. Print " +
      "\"YES\" if any two distinct elements sum to the target, otherwise \"NO\".",
  },
  {
    id: "c-lcs",
    title: "Longest common subsequence",
    difficulty: "hard",
    prompt:
      "Read two lines, each containing a string. Print the length of the longest " +
      "common subsequence of the two strings.",
  },
];

// Every coding round is exactly two problems (architecture §4.2); seniority sets
// their difficulty, not their count.
export const CODING_COUNT = 2;

export function getCodingProblem(id: string): CodingProblem | undefined {
  return CODING_PROBLEMS.find((p) => p.id === id);
}

// Seniority raises the LEVEL of the coding round, not its size: the two problems
// are drawn from this difficulty band. Mirrors the headline difficulty used for
// the technical phase, so the coding round can't feel out of step with it.
const DIFFICULTY_FOR: Record<Seniority, Difficulty> = {
  intern: "easy",
  junior: "easy",
  sde1: "easy",
  mid: "medium",
  sde2: "medium",
  senior: "hard",
  sde3: "hard",
};

// The two problems for a coding round: both at the seniority's difficulty, topped
// up from the rest of the bank only if that band ever holds fewer than two.
// Deterministic — buildPlan and assemblePlan both rely on the same result.
export function selectCodingProblems(seniority: Seniority): CodingProblem[] {
  const want = DIFFICULTY_FOR[seniority];
  const matching = CODING_PROBLEMS.filter((p) => p.difficulty === want);
  const rest = CODING_PROBLEMS.filter((p) => p.difficulty !== want);
  return [...matching, ...rest].slice(0, CODING_COUNT);
}
