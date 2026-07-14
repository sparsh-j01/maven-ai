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

  const runs = Math.max(
    1,
    Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 1),
  );

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
  // Anchored scores (correctness = 100 − 20×false_claims) should be flat by
  // construction; vibe scores (completeness) are the ones that drift. A spread
  // wide enough to cross an assertion margin shows up as a run that fails above.
  if (runs > 1) {
    console.log(`\nstability (min–max over ${runs} runs)`);
    for (const name of results[0]!.scores.keys()) {
      const cols = AXES.map((axis) => {
        const vals = results.map((r) => r.scores.get(name)![axis]);
        const lo = Math.min(...vals);
        const hi = Math.max(...vals);
        return `${axis} ${lo === hi ? `${lo}` : `${lo}–${hi} ⚠`}`.padEnd(24);
      });
      console.log(`  ${name.padEnd(26)}${cols.join("")}`);
    }
    console.log("  (⚠ = moved between identical runs)");
  }

  const passed = results.every((r) => r.passed);
  console.log(
    passed
      ? `\n✓ real grader passes all checks${runs > 1 ? ` in all ${runs} runs` : ""}`
      : `\n✗ ${results.filter((r) => !r.passed).length}/${runs} run(s) failed`,
  );
  process.exit(passed ? 0 : 1);
}

main();
