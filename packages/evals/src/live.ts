import { geminiScorer, runEvalSuite } from "./suite";

// pnpm eval:live — the real Gemini grader through the real assertions.
// 5 API calls, ~₹1.50. This is the only command that guards production code.
async function main() {
  if (!process.env.GOOGLE_API_KEY) {
    console.error("No GOOGLE_API_KEY.\n  set -a && source ../../.env && set +a");
    process.exit(1);
  }

  console.log("Running the real grader through the suite (5 API calls)...\n");
  const { passed, failures } = await runEvalSuite(geminiScorer);

  for (const f of failures) console.log(`✗ ${f}`);
  console.log(
    passed
      ? "\n✓ real grader passes all checks"
      : `\n${failures.length} failure(s)`,
  );
  process.exit(passed ? 0 : 1);
}

main();