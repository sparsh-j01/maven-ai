import type { FeedbackReport } from "@maven-ai/shared";
import { CASES } from "./fixtures";
import { grade } from "./grade";
import { judge } from "./judge";

// Eval runner. With GOOGLE_API_KEY set it grades each golden transcript through
// the real Gemini scorer (the actual eval). Without a key — or with --offline —
// it judges the bundled sampleReport instead, so the harness always runs (CI,
// no secrets, no spend) and proves the fixtures + judge are wired correctly.
//
//   pnpm eval            # live if GOOGLE_API_KEY is set, else offline
//   pnpm eval --offline  # force offline

const offline =
  process.argv.includes("--offline") || !process.env.GOOGLE_API_KEY;

async function main() {
  console.log(
    offline
      ? "Running evals OFFLINE (bundled sample reports — set GOOGLE_API_KEY for a live grade).\n"
      : "Running evals LIVE against gemini-2.5-flash.\n",
  );

  let passed = 0;
  for (const c of CASES) {
    let report: FeedbackReport;
    try {
      report = offline ? c.sampleReport : await grade(c.input);
    } catch (err) {
      console.log(`✗ ${c.name} — grading error: ${(err as Error).message}`);
      continue;
    }

    const result = judge(report, c.expect);
    if (result.pass) {
      passed++;
      console.log(`✓ ${c.name}  (overall ${report.overallScore})`);
    } else {
      console.log(`✗ ${c.name}  (overall ${report.overallScore})`);
      for (const f of result.failures) console.log(`    - ${f}`);
    }
  }

  const total = CASES.length;
  console.log(`\n${passed}/${total} passed`);
  if (passed < total) process.exit(1);
}

main();
