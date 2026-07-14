import { RUBRIC_DIMENSIONS } from "@maven-ai/shared";
import { SCORER_TIMEOUT_MS } from "@maven-ai/shared/models";
import { geminiScorer, runEvalSuite, type SuiteResult } from "./suite";

// pnpm eval:live — the real Gemini grader through the real assertions.
// 5 API calls per run, ~₹1.50. This is the only command that guards production code.
//
//   pnpm eval:live            # one run — pass/fail gate
//   pnpm eval:live --runs=3   # 3 runs — also measures latency and score drift
//
// --runs=N exists because two numbers here were guesses, not measurements:
// SCORER_TIMEOUT_MS (how long a grade actually takes) and the stability of the
// LLM's own scores. One run can't tell you either. Re-run it after any change to
// the scorer prompt, model, or temperature.

const AXES = ["correctness", "completeness", "communication"] as const;
const s = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

async function main() {
  if (!process.env.GOOGLE_API_KEY) {
    console.error("No GOOGLE_API_KEY.\n  set -a && source ../../.env && set +a");
    process.exit(1);
  }

  // Validate, don't coerce: Math.max(1, Number("thre")) is NaN, which runs the loop
  // ZERO times — and an empty results array makes every().passed vacuously true. A
  // typo would have printed "passes all checks" without grading anything. A gate that
  // can pass without running is worse than no gate.
  const raw = process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1];
  const runs = raw === undefined ? 1 : Number(raw);
  if (!Number.isInteger(runs) || runs < 1) {
    console.error(`--runs must be a positive integer (got "${raw}")`);
    process.exit(1);
  }

  console.log(
    `Running the real grader through the suite ${runs}× (${runs * 5} API calls)...\n`,
  );

  const results: SuiteResult[] = [];
  const timings = (r: SuiteResult) =>
    [...r.scores.values()].map((v) => v.ms).filter((ms): ms is number => ms !== undefined);

  for (let i = 0; i < runs; i++) {
    const r = await runEvalSuite(geminiScorer);
    results.push(r);
    const t = timings(r);
    console.log(
      `run ${i + 1}: ${r.passed ? "✓ passed" : `✗ ${r.failures.length} failure(s)`}` +
        (t.length ? `  (slowest grade ${s(Math.max(...t))})` : ""),
    );
    for (const f of r.failures) console.log(`   ✗ ${f}`);
  }

  // ── S6: what does a grade actually cost in wall time? ────────────────────
  // Successful calls only — a 503 comes back in ~1s and would flatter the median.
  const all = results.flatMap(timings).sort((a, b) => a - b);
  if (all.length) {
    const median = all[Math.floor(all.length / 2)]!;
    const max = all[all.length - 1]!;
    console.log(
      `\nlatency   n=${all.length}  median ${s(median)}  max ${s(max)}` +
        `\n          SCORER_TIMEOUT_MS=${SCORER_TIMEOUT_MS} → ${(SCORER_TIMEOUT_MS / max).toFixed(1)}× the slowest grade observed`,
    );
  }

  // ── S7: do the scores hold still across identical runs? ──────────────────
  // Anchored scores (correctness = 100 − 20×false_claims) are flat by construction.
  // Everything else has to be shown, not assumed — including overallScore and the
  // rubric dims, which is what the CANDIDATE reads. A number that swings 40 points on
  // identical input isn't a score, it's a coin flip with a decimal point.
  if (runs > 1) {
    const spread = (vals: number[]) => {
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      return { lo, hi, moved: lo !== hi, text: lo === hi ? `${lo}` : `${lo}–${hi} ⚠` };
    };
    const at = (i: number, name: string) => results[i]!.scores.get(name)!;

    console.log(`\nstability (min–max over ${runs} runs, ⚠ = moved on identical input)`);
    let worstOverall = 0;
    let movedOverall = 0;

    for (const name of results[0]!.scores.keys()) {
      const idx = results.map((_, i) => i);
      const overall = spread(idx.map((i) => at(i, name).overall ?? -1));
      if (overall.moved) movedOverall++;
      worstOverall = Math.max(worstOverall, overall.hi - overall.lo);

      const axes = AXES.map((axis) =>
        `${axis} ${spread(idx.map((i) => at(i, name)[axis])).text}`.padEnd(23),
      );
      console.log(
        `  ${name.padEnd(26)}OVERALL ${overall.text.padEnd(12)}${axes.join("")}`,
      );

      const drifted = RUBRIC_DIMENSIONS.map((d) => ({
        d,
        s: spread(idx.map((i) => at(i, name).rubric?.[d] ?? -1)),
      })).filter((x) => x.s.moved);
      console.log(
        drifted.length
          ? `  ${" ".repeat(26)}rubric drift: ${drifted.map((x) => `${x.d} ${x.s.text}`).join(", ")}`
          : `  ${" ".repeat(26)}rubric: flat`,
      );
    }

    // The headline: the score on the report is the product. Everything else is
    // diagnostics for why it moved.
    console.log(
      `\noverallScore moved on ${movedOverall}/${results[0]!.scores.size} cases` +
        `, worst swing ${worstOverall} points on identical input`,
    );
  }

  // results.length > 0 is belt-and-braces on the same failure: never exit 0 without
  // having actually graded something.
  const passed = results.length > 0 && results.every((r) => r.passed);
  console.log(
    passed
      ? `\n✓ real grader passes all checks${runs > 1 ? ` in all ${runs} runs` : ""}`
      : `\n✗ ${results.filter((r) => !r.passed).length}/${runs} run(s) failed`,
  );
  process.exit(passed ? 0 : 1);
}

main();
