import { CASES } from "./fixtures";
import { grade } from "./grade";

// pnpm eval — live spot-check of the real Gemini grader against the golden
// transcripts. Prints correctness / deliveryScore / evidence so you can see
// whether the grader separates substance from delivery on case 4 and case 5.
//
//   pnpm eval                              # all five cases (5 API calls)
//   pnpm eval --case=long-confident-wrong  # one case (1 API call)
//
// The automated grading-QUALITY gate is the offline suite (pnpm eval:sanity +
// pnpm test); this proves the live model emits the fields and ranks sanely.
async function main() {
  if (!process.env.GOOGLE_API_KEY) {
    console.error(
      "No GOOGLE_API_KEY — cannot run the live grader.\n" +
        "  set -a && source ../../.env && set +a",
    );
    process.exit(1);
  }

  const only = process.argv.find((a) => a.startsWith("--case="))?.split("=")[1];
  const cases = only ? CASES.filter((c) => c.name === only) : CASES;
  if (only && cases.length === 0) {
    console.error(`no such case: ${only}`);
    console.error(`available: ${CASES.map((c) => c.name).join(", ")}`);
    process.exit(1);
  }

  console.log(
    `Grading ${cases.length} case(s) live against gemini-2.5-flash.\n`,
  );
  const scores: Record<string, number> = {};

  for (const c of cases) {
    try {
      const report = await grade(c.input);
      scores[c.name] = report.overallScore;
      console.log(`✓ ${c.name}  (overall ${report.overallScore})`);
      console.log(
        `   correctness=${report.correctness}  completeness=${report.completeness}  delivery=${report.deliveryScore}`,
      );
      console.log(`   evidence="${report.evidence}"`);
      for (const c of report.claimAudit ?? []) {
        console.log(`   [${c.verdict === "false" ? "✗" : "✓"}] ${c.claim.slice(0, 70)}`);
      }
      console.log("");    } catch (err) {
      const msg = (err as Error).message;
      console.log(
        `✗ ${c.name} — ${
          msg.includes("429")
          ? "rate limited — check rate limits and billing"
          : msg.slice(0, 200)        }\n`,
      );
    }
  }

  const strong = scores["strong-senior-technical"];
  const weak = scores["weak-junior-technical"];
  if (strong !== undefined && weak !== undefined && strong <= weak) {
    console.log(
      `✗ live grader did not rank strong (${strong}) above weak (${weak})`,
    );
    process.exit(1);
  }
}

main();