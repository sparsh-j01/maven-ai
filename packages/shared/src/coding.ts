import {
  companyDifficultyShift,
  type CompanyType,
  type Difficulty,
  type Seniority,
  shiftDifficulty,
} from "./interview";

// Milestone 6: the live coding round. Each problem is a classic stdin → stdout
// task so the sandbox (Judge0, §8) can grade it by comparing program output to an
// expected output — no per-language test harness needed. The PUBLIC half lives
// here: the statement the agent reads aloud + the browser shows, and the starter
// code Monaco loads. The SECRET half (the exact stdin + the reference solver that
// derives the expected stdout) lives only with the grader — the agent's
// apps/agent/coding.py — so the answer never rides to the browser in room
// metadata where a candidate could read it and hard-code it (F1, §8.1). The two
// halves are linked by problem `id`: every id below MUST have a grader in
// coding.py (a pytest enforces that contract).

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

// The bank. ~12 per difficulty, spanning the classic categories (arrays, strings,
// hashing, two-pointer, sliding window, stack, sorting, math, recursion, DP,
// greedy) so a randomly-drawn pair feels fresh and covers the ground. Grow toward
// ~50 per band by appending here AND adding the matching grader in coding.py.
export const CODING_PROBLEMS: CodingProblem[] = [
  // ─────────────── easy ───────────────
  {
    id: "c-fizzbuzz",
    title: "FizzBuzz",
    difficulty: "easy",
    prompt:
      "Read an integer N from input, then print the numbers 1 to N, one per line. " +
      'For multiples of 3 print "Fizz" instead of the number, for multiples of 5 ' +
      'print "Buzz", and for multiples of both print "FizzBuzz".',
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
    id: "c-sum-n",
    title: "Sum to N",
    difficulty: "easy",
    prompt:
      "Read an integer N. Print the sum of all integers from 1 to N inclusive.",
  },
  {
    id: "c-reverse-string",
    title: "Reverse a string",
    difficulty: "easy",
    prompt: "Read a single line. Print the line reversed.",
  },
  {
    id: "c-max-of-list",
    title: "Maximum of a list",
    difficulty: "easy",
    prompt:
      "The first line contains an integer N. The second line contains N " +
      "space-separated integers. Print the largest of them.",
  },
  {
    id: "c-count-evens",
    title: "Count even numbers",
    difficulty: "easy",
    prompt:
      "The first line contains an integer N. The second line contains N " +
      "space-separated integers. Print how many of them are even.",
  },
  {
    id: "c-factorial",
    title: "Factorial",
    difficulty: "easy",
    prompt: "Read an integer N (0 ≤ N ≤ 12). Print N! (N factorial).",
  },
  {
    id: "c-palindrome-check",
    title: "Palindrome check",
    difficulty: "easy",
    prompt:
      'Read a single line. Print "YES" if it reads the same forwards and ' +
      'backwards, otherwise print "NO".',
  },
  {
    id: "c-count-words",
    title: "Count words",
    difficulty: "easy",
    prompt:
      "Read a single line. Print the number of words in it (words are separated " +
      "by whitespace).",
  },
  {
    id: "c-second-largest",
    title: "Second largest",
    difficulty: "easy",
    prompt:
      "The first line contains an integer N (N ≥ 2). The second line contains N " +
      "space-separated distinct integers. Print the second largest value.",
  },
  {
    id: "c-gcd",
    title: "Greatest common divisor",
    difficulty: "easy",
    prompt:
      "Read two space-separated positive integers A and B on one line. Print " +
      "their greatest common divisor.",
  },
  {
    id: "c-digit-sum",
    title: "Digit sum",
    difficulty: "easy",
    prompt:
      "Read a non-negative integer N. Print the sum of its digits.",
  },

  // ─────────────── medium ───────────────
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
    id: "c-two-sum",
    title: "Two sum exists",
    difficulty: "medium",
    prompt:
      "The first line contains an integer N. The second line contains N " +
      "space-separated integers. The third line contains a target integer. Print " +
      '"YES" if any two distinct elements sum to the target, otherwise "NO".',
  },
  {
    id: "c-binary-search",
    title: "Binary search",
    difficulty: "medium",
    prompt:
      "The first line contains an integer N. The second line contains N " +
      "space-separated integers in ascending order. The third line contains a " +
      "target X. Print the 0-based index of X in the array, or -1 if it is absent.",
  },
  {
    id: "c-anagram",
    title: "Anagram check",
    difficulty: "medium",
    prompt:
      'Read two lines, each containing a string. Print "YES" if the two strings ' +
      'are anagrams of each other, otherwise print "NO".',
  },
  {
    id: "c-fibonacci",
    title: "Nth Fibonacci",
    difficulty: "medium",
    prompt:
      "Read an integer N (N ≥ 0). Print the Nth Fibonacci number, where F(0) = 0 " +
      "and F(1) = 1.",
  },
  {
    id: "c-count-primes",
    title: "Count primes",
    difficulty: "medium",
    prompt:
      "Read an integer N. Print how many prime numbers are strictly less than N.",
  },
  {
    id: "c-first-unique-char",
    title: "First unique character",
    difficulty: "medium",
    prompt:
      "Read a single line containing a string. Print the 0-based index of the " +
      "first character that does not repeat, or -1 if every character repeats.",
  },
  {
    id: "c-valid-parentheses",
    title: "Valid parentheses",
    difficulty: "medium",
    prompt:
      "Read a single line containing only the characters ()[]{}. Print \"YES\" if " +
      'the brackets are balanced and correctly nested, otherwise print "NO".',
  },
  {
    id: "c-missing-number",
    title: "Missing number",
    difficulty: "medium",
    prompt:
      "The first line contains an integer N. The second line contains N distinct " +
      "integers drawn from the range 0 to N inclusive (so exactly one value in " +
      "that range is missing). Print the missing value.",
  },
  {
    id: "c-majority-element",
    title: "Majority element",
    difficulty: "medium",
    prompt:
      "The first line contains an integer N. The second line contains N " +
      "space-separated integers, one of which appears more than N/2 times. Print " +
      "that value.",
  },
  {
    id: "c-move-zeroes",
    title: "Move zeroes",
    difficulty: "medium",
    prompt:
      "The first line contains an integer N. The second line contains N " +
      "space-separated integers. Print the integers with every zero moved to the " +
      "end, the order of the non-zero values preserved, space-separated on one line.",
  },
  {
    id: "c-power",
    title: "Integer power",
    difficulty: "medium",
    prompt:
      "Read two space-separated integers B and E (E ≥ 0) on one line. Print B " +
      "raised to the power E.",
  },

  // ─────────────── hard ───────────────
  {
    id: "c-longest-unique",
    title: "Longest substring without repeating characters",
    difficulty: "hard",
    prompt:
      "Read a single line containing a string. Print the length of the longest " +
      "substring that contains no repeating characters.",
  },
  {
    id: "c-lcs",
    title: "Longest common subsequence",
    difficulty: "hard",
    prompt:
      "Read two lines, each containing a string. Print the length of the longest " +
      "common subsequence of the two strings.",
  },
  {
    id: "c-edit-distance",
    title: "Edit distance",
    difficulty: "hard",
    prompt:
      "Read two lines, each containing a string. Print the minimum number of " +
      "single-character insertions, deletions, or substitutions needed to turn " +
      "the first string into the second (Levenshtein distance).",
  },
  {
    id: "c-coin-change",
    title: "Coin change",
    difficulty: "hard",
    prompt:
      "The first line contains an integer N. The second line contains N " +
      "space-separated positive coin denominations. The third line contains a " +
      "target amount. Print the minimum number of coins (each usable any number " +
      "of times) that sum to the amount, or -1 if it cannot be made.",
  },
  {
    id: "c-lis",
    title: "Longest increasing subsequence",
    difficulty: "hard",
    prompt:
      "The first line contains an integer N. The second line contains N " +
      "space-separated integers. Print the length of the longest strictly " +
      "increasing subsequence.",
  },
  {
    id: "c-trapping-rain",
    title: "Trapping rain water",
    difficulty: "hard",
    prompt:
      "The first line contains an integer N. The second line contains N " +
      "space-separated non-negative integers representing an elevation map where " +
      "each bar has width 1. Print the total units of water that can be trapped.",
  },
  {
    id: "c-min-path-sum",
    title: "Minimum path sum",
    difficulty: "hard",
    prompt:
      "The first line contains two integers R and C. The next R lines each " +
      "contain C space-separated non-negative integers forming a grid. Print the " +
      "minimum sum of a path from the top-left to the bottom-right cell, moving " +
      "only right or down.",
  },
  {
    id: "c-house-robber",
    title: "House robber",
    difficulty: "hard",
    prompt:
      "The first line contains an integer N. The second line contains N " +
      "space-separated non-negative integers. Print the maximum sum obtainable " +
      "by choosing a subset with no two adjacent elements.",
  },
  {
    id: "c-knapsack",
    title: "0/1 knapsack",
    difficulty: "hard",
    prompt:
      "The first line contains two integers N and W (item count and capacity). " +
      "The second line contains N space-separated item weights. The third line " +
      "contains N space-separated item values. Print the maximum total value of " +
      "items whose total weight does not exceed W (each item used at most once).",
  },
  {
    id: "c-longest-palindrome-substr",
    title: "Longest palindromic substring",
    difficulty: "hard",
    prompt:
      "Read a single line containing a string. Print the length of the longest " +
      "contiguous substring that is a palindrome.",
  },
  {
    id: "c-num-islands",
    title: "Number of islands",
    difficulty: "hard",
    prompt:
      "The first line contains two integers R and C. The next R lines each " +
      "contain a string of C characters that is the grid (1 = land, 0 = water, " +
      "no spaces). Print the number of islands (groups of 1s connected " +
      "horizontally or vertically).",
  },
  {
    id: "c-jump-game",
    title: "Jump game",
    difficulty: "hard",
    prompt:
      "The first line contains an integer N. The second line contains N " +
      "space-separated non-negative integers, where each value is the maximum " +
      "forward jump from that index. Starting at index 0 (the last index is " +
      "reachable), print the minimum number of jumps needed to reach the last index.",
  },
];

// Every coding round is exactly two problems (architecture §4.2); seniority +
// company flavour set their difficulty, not their count.
export const CODING_COUNT = 2;

export function getCodingProblem(id: string): CodingProblem | undefined {
  return CODING_PROBLEMS.find((p) => p.id === id);
}

// Seniority sets the base coding difficulty (mirrors the headline difficulty used
// for the spoken technical phase, so the two can't feel out of step).
const DIFFICULTY_FOR: Record<Seniority, Difficulty> = {
  intern: "easy",
  junior: "easy",
  sde1: "easy",
  mid: "medium",
  sde2: "medium",
  senior: "hard",
  sde3: "hard",
};

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// The two problems for a coding round: both at the (company-adjusted) seniority
// difficulty, drawn at RANDOM from that band so a given level isn't the same two
// every interview. Topped up from the rest of the bank only if a band ever holds
// fewer than two. Random — but the plan is built once at interview creation and
// persisted, so a single draw is what the agent and editor both see.
export function selectCodingProblems(
  seniority: Seniority,
  companyType?: CompanyType | null,
): CodingProblem[] {
  const want = shiftDifficulty(
    DIFFICULTY_FOR[seniority],
    companyDifficultyShift(companyType),
  );
  const matching = shuffled(CODING_PROBLEMS.filter((p) => p.difficulty === want));
  const rest = shuffled(CODING_PROBLEMS.filter((p) => p.difficulty !== want));
  return [...matching, ...rest].slice(0, CODING_COUNT);
}
