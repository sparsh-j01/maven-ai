import type { ScorerInput } from "@maven-ai/shared";
import { CASES, byName, candidateText } from "./fixtures";


export type ScoreOutput = {
  correctness: number; // 0–100: were the claims TRUE? Saying nothing scores 100.
  completeness: number; // 0–100: did they REACH the answer? Catches case 2.
  communication: number; // 0–100: how clearly delivered, independent of both.
  evidence: string; // must be a verbatim span from the candidate's transcript
};

export type Scorer = (input: ScorerInput) => ScoreOutput | Promise<ScoreOutput>;
export type SuiteResult = { passed: boolean; failures: string[] };


export async function runEvalSuite(scorer: Scorer): Promise<SuiteResult> {
  const out = new Map<string, ScoreOutput>();
  for (const c of CASES) {
    try {
      out.set(c.name, await scorer(c.input));
    } catch (e) {
      // One failed grade must not crash the whole run. Sentinel -1s make this
      // case fail its assertions loudly instead of throwing.
      out.set(c.name, {
        correctness: -1,
        completeness: -1,
        communication: -1,
        evidence: "",
      });
      console.error(`${c.name}: grade failed — ${(e as Error).message}`);
    }
  }
  const g = (n: string) => out.get(n)!;

  const c1 = g("strong-senior-technical");
  const c2 = g("weak-junior-technical");
  const c4 = g("long-confident-wrong");
  const c5 = g("short-hesitant-right");

  const failures: string[] = [];
  const check = (ok: boolean, msg: string) => {
    if (!ok) failures.push(msg);
  };

  // Case 4 is the LONGEST transcript and must score lowest on truth.
  // Observed live: c4=20, c1=100.
  check(
    c4.correctness < c1.correctness - 30,
    `case4 correctness ${c4.correctness} not far below case1 ${c1.correctness}`,
  );

  // Cases 2 and 5 BOTH say only true things — correctness cannot separate them.
  // Completeness must: case 5 reaches the Set solution, case 2 stops at brute
  // force. Observed live: c5=80, c2=30.
  check(
    c5.completeness > c2.completeness + 20,
    `case5 completeness ${c5.completeness} not clearly above case2 ${c2.completeness}`,
  );
  check(
    c5.correctness >= c2.correctness,
    `case5 correctness ${c5.correctness} below case2 ${c2.correctness} — hedging punished as error`,
  );

  // The axes must move independently. Observed live: c4 = 20/85, c5 = 100/60.
  check(
    c4.correctness <= 40 && c4.communication > 70,
    `case4 must be wrong-but-fluent (correctness ${c4.correctness}, communication ${c4.communication})`,
  );
  check(
    c5.correctness > 70 && c5.communication < c1.communication - 20,
    `case5 must be right-but-hesitant (correctness ${c5.correctness}, communication ${c5.communication} vs case1 ${c1.communication})`,
  );

  // Doesn't fabricate. "".includes("") is true, so the length guard is load-bearing.
  for (const c of CASES) {
    const said = candidateText(c.input);
    const e = g(c.name).evidence;
    check(
      e.length > 0 && said.includes(e),
      `${c.name}: evidence not a verbatim candidate span: ${JSON.stringify(e)}`,
    );
  }

  return { passed: failures.length === 0, failures };
}
// ── Scorers under test ──────────────────────────────────────────────────────

const HEDGES = /\b(?:um+|uh+|maybe|i think|i guess|probably|not sure|kind of|sort of)\b/gi;

function longestCandidateTurn(input: ScorerInput): string {
  return input.transcript
    .filter((t) => t.speaker === "candidate")
    .map((t) => t.text)
    .reduce((a, b) => (b.length > a.length ? b : a), "");
}

// No understanding: correctness ≈ how much they said, communication ≈ how few
// hedges. Quotes a real span, so it fails ONLY on reading content — the whole
// point. There is no length/hedge tuning that satisfies case 4 and case 5 at once.
export const naiveScorer: Scorer = (input) => {
  const said = candidateText(input);
  const words = said.trim().split(/\s+/).filter(Boolean).length;
  const hedges = said.match(HEDGES)?.length ?? 0;
  return {
    correctness: Math.min(words, 100),
    completeness: Math.min(words, 100),
    communication: Math.max(0, 100 - hedges * 20),
    evidence: longestCandidateTurn(input),
  };
};

// An oracle that actually read each answer — proves the suite can PASS, so the
// reject test isn't just a suite that fails everything. Hand-scored to ground
// truth, quoting a real span.
const ORACLE: Record<string, ScoreOutput> = {
  "strong-senior-technical": {
    correctness: 88,
    completeness: 90,
    communication: 85,
    evidence: "token bucket in Redis with atomic Lua",
  },
  "weak-junior-technical": {
    correctness: 48,
    completeness: 30,
    communication: 32,
    evidence: "two for loops and check every pair",
  },
  "mixed-mid-behavioral": {
    correctness: 74,
    completeness: 75,
    communication: 80,
    evidence: "I pulled the error rates",
  },
  "long-confident-wrong": {
    correctness: 25,
    completeness: 40,
    communication: 82,
    evidence: "sliding-window counter in Redis",
  },
"short-hesitant-right": {
    correctness: 85,
    completeness: 80,
    communication: 40,
    evidence: "Or a Set — one pass, n time, n space",
  },
};

export const oracleScorer: Scorer = (input) => {
  const hit = CASES.find((c) => c.input === input);
  if (!hit) throw new Error("oracle only scores the bundled fixtures");
  return ORACLE[hit.name]!;
};
// ── The real thing ──────────────────────────────────────────────────────────

// The production grader, adapted to the suite's contract. Async, unlike the
// fakes — so runEvalSuite needs an async path. Fails loudly on a missing field
// rather than letting `undefined < 40` fail three assertions later.
export async function geminiScorer(input: ScorerInput): Promise<ScoreOutput> {
  const { grade } = await import("./grade");
  const r = await grade(input);
  if (
    r.correctness === undefined ||
    r.completeness === undefined ||
    r.deliveryScore === undefined ||
    r.evidence === undefined
  ) {
    throw new Error(
      "grader returned no correctness/completeness/deliveryScore/evidence — prompt or schema not wired",
    );
  }
  return {
    correctness: r.correctness,
    completeness: r.completeness,
    communication: r.deliveryScore,
    evidence: r.evidence,
  };
}