// Self-check for the résumé-PDF parse path. Exercises the real worker artifact
// (pdf-worker.mjs) two ways: a genuine PDF extracts to text, and a CPU-bomb
// (spin:true) gets hard-killed by the parent's terminate()-on-timeout — the
// whole point of parsing in a worker. Local/macOS only: uses cupsfilter.
//   node apps/web/lib/parse-resume.check.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path, { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { isPdfHeader } from "./pdf-header.mjs";

// Resolve the worker next to this script, so the check runs from any cwd.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.join(HERE, "pdf-worker.mjs");
const MARKER = "Kafka";

// Same terminate-on-timeout wrapper as lib/pdf-parse.ts, inlined so the check
// runs under plain node (the lib is TS).
function run(bytes, { spin = false, timeoutMs = 4000 } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done) { done = true; clearTimeout(t); void w.terminate(); resolve(r); } };
    const w = new Worker(WORKER, {
      workerData: { buffer: bytes.buffer, maxPages: 30, maxChars: 10000, spin },
      resourceLimits: { maxOldGenerationSizeMb: 256 },
    });
    const t = setTimeout(() => finish({ reason: "timeout" }), timeoutMs);
    w.once("message", (m) => finish(m));
    w.once("error", () => finish({ reason: "error" }));
  });
}

const dir = mkdtempSync(join(tmpdir(), "resume-check-"));
const txt = join(dir, "r.txt");
writeFileSync(txt, `Jane Doe\nSenior Backend Engineer\n${MARKER} pipelines and Postgres sharding\n`);

let pdf;
try {
  pdf = execFileSync("cupsfilter", [txt], { maxBuffer: 8 << 20, stdio: ["ignore", "pipe", "ignore"] });
} catch {
  console.log("skip — cupsfilter unavailable (macOS-only check)");
  process.exit(0);
}

// 1) Real PDF → text, and the caller's bytes survive (clone, not transfer) so
// the route can still upload the file to R2 after parsing.
const bytes1 = new Uint8Array(pdf);
const extract = await run(bytes1);
const gotText = typeof extract.text === "string" && extract.text.includes(MARKER);
const survived = bytes1.byteLength > 0;
console.log(gotText ? "ok — worker extracted text" : "FAIL — no text", JSON.stringify((extract.text ?? "").replace(/\s+/g, " ").trim().slice(0, 50)));
console.log(survived ? "ok — bytes survive parsing (usable for R2 upload)" : "FAIL — bytes detached after parse");

// 2) CPU-bomb → hard-killed within the timeout (not left spinning).
const t0 = Date.now();
const bomb = await run(new Uint8Array(pdf), { spin: true, timeoutMs: 1500 });
const killed = bomb.reason === "timeout" && Date.now() - t0 < 3000;
console.log(killed ? `ok — spinning worker hard-killed in ${Date.now() - t0}ms` : "FAIL — bomb not killed");

// 3) The route's real header guard: a genuine PDF passes, renamed-malware (MZ)
// fails. Invokes the shared guard so this breaks if the route's guard breaks.
const guardOk = isPdfHeader(bytes1) && !isPdfHeader(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]));
console.log(guardOk ? "ok — route header guard accepts PDF, rejects non-PDF" : "FAIL — header guard wrong");

process.exit(gotText && survived && killed && guardOk ? 0 : 1);
