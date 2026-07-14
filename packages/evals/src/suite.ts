import type { RubricDimension, ScorerInput } from "@maven-ai/shared";
import { CASES, byName, candidateText } from "./fixtures";


export type ScoreOutput = {
  correctness: number; // 0–100: were the claims TRUE? Saying nothing scores 100.
  completeness: number; // 0–100: did they REACH the answer? Catches case 2.
  communication: number; // 0–100: how clearly delivered, independent of both.
  evidence: string; // must be a verbatim span from the candidate's transcript
  claimAudit: { claim: string; verdict: "true" | "false"; why: string }[];
  ms?: number; // wall time of the real grading call; unset for the offline fakes
  // The numbers the CANDIDATE actually reads. They aren't derived from the three
  // axes above — the model emits them free-form — so their stability is a separate
  // question, and it's the one that decides whether a report can be trusted.
  overall?: number; // 0–100, the headline score on the report
  rubric?: Partial<Record<RubricDimension, number>>; // 0–10, the radar axes
};

export type Scorer = (input: ScorerInput) => ScoreOutput | Promise<ScoreOutput>;
export type SuiteResult = {
  passed: boolean;
  failures: string[];
  // The scores behind the verdict, so `eval:live --runs=N` can show the real
  // grade latency (ScoreOutput.ms — SCORER_TIMEOUT_MS was a guess) and the
  // run-to-run drift of the numbers the assertions rely on.
  scores: Map<string, ScoreOutput>;
};


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
        claimAudit: [],
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

// Case 4 caught the PLANTED errors, not invented ones. It reliably finds 3 of
  // 4 at temp 0 (misses the fail-closed/availability framing), so assert >= 3.
  const c4False = c4.claimAudit.filter((a) => a.verdict === "false").length;
  check(c4False >= 3, `case4: expected >=3 false claims, got ${c4False}`);

  // Overcorrection guard — case1 is entirely true, including "fail open protects
  // availability" (same jargon shape as case4's false "fail closed"). A false
  // positive here means the grader distrusts vocabulary instead of judging claims.
  check(
    c1.claimAudit.every((a) => a.verdict === "true"),
    `case1 false positives: ${c1.claimAudit.filter((a) => a.verdict === "false").map((a) => a.claim).join(" | ")}`,
  );

  // No fabricated claims — every audited claim must be verbatim candidate speech.
  // Worse than a bad score: a made-up claim penalizes a candidate for words they
  // never said.
  for (const c of CASES) {
    const said = candidateText(c.input);
    for (const a of g(c.name).claimAudit) {
      check(
        a.claim.length > 0 && said.includes(a.claim),
        `${c.name}: fabricated claim not in transcript: ${JSON.stringify(a.claim)}`,
      );
    }
  }
    for (const c of CASES) {
    const said = candidateText(c.input);
    const e = g(c.name).evidence;
    check(
      e.length > 0 && said.includes(e),
      `${c.name}: evidence not a verbatim candidate span: ${JSON.stringify(e)}`,
    );
  }

  return { passed: failures.length === 0, failures, scores: out };
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
    claimAudit: [],
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
    claimAudit: [
      { claim: "token bucket in Redis with atomic Lua", verdict: "true", why: "correct" },
    ],
    evidence: "token bucket in Redis with atomic Lua",
  },
  "weak-junior-technical": {
    correctness: 48,
    completeness: 30,
    claimAudit: [
      { claim: "two for loops and check every pair", verdict: "true", why: "brute force works" },
    ],
    communication: 32,
    evidence: "two for loops and check every pair",
  },
  "mixed-mid-behavioral": {
    correctness: 74,
    completeness: 75,
    claimAudit: [],
    communication: 80,
    evidence: "I pulled the error rates",
  },
  "long-confident-wrong": {
    correctness: 25,
    completeness: 40,
    claimAudit: [
      { claim: "Redis is single-threaded, so INCR and EXPIRE execute as one atomic unit", verdict: "false", why: "sequence isn't atomic" },
      { claim: "The sliding window gives exact enforcement", verdict: "false", why: "counter approximates" },
      { claim: "raise the TTL on that key", verdict: "false", why: "TTL doesn't cut writes" },
      { claim: "fail closed and reject every request; that protects availability", verdict: "false", why: "fail-closed reduces availability" },
    ],
    communication: 82,
    evidence: "sliding-window counter in Redis",
  },
"short-hesitant-right": {
    correctness: 85,
    completeness: 80,
    claimAudit: [
      { claim: "two loops, n squared", verdict: "true", why: "correct" },
      { claim: "Or a Set — one pass, n time, n space", verdict: "true", why: "correct optimal" },
    ],
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
  const { gradeTimed } = await import("./grade");
  const { report: r, ms } = await gradeTimed(input);
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
    claimAudit: r.claimAudit ?? [],
    ms,
    overall: r.overallScore,
    rubric: r.rubricScores,
  };
}