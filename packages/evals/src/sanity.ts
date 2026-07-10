import assert from "node:assert";
import { naiveScorer, runEvalSuite } from "./suite";

// Step 1 re-run — does the suite measure grading?
// Point a no-understanding scorer (word count + hedge count) at all five cases.
// It must be rejected: case 4 is the longest transcript but the least correct,
// case 5 the most hedged but the most correct — no counting satisfies both.
//
//   pnpm eval:sanity
const { passed, failures } = await runEvalSuite(naiveScorer);

console.log("Naive word/hedge-count scorer vs the suite:\n");
for (const f of failures) console.log(`  ✓ rejected: ${f}`);
console.log(
  `\nnaive scorer ${passed ? "PASSED — the suite has no teeth" : `rejected on ${failures.length} check(s)`}`,
);

assert(
  !passed,
  "a scorer with no understanding passed the suite — it is not measuring grading",
);
console.log(
  "Suite measures grading: no length or hedge heuristic can score case 4 and case 5 the way truth demands.",
);
