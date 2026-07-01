import path from "node:path";
import { Worker } from "node:worker_threads";

// Extract résumé text from PDF bytes in a worker thread so a malicious CPU-bomb
// PDF can be hard-terminated on timeout (a main-thread timeout can't interrupt a
// synchronous pdf.js loop) and an allocation bomb is capped to the worker's
// heap. The worker file is loaded by path (not imported) so it stays out of the
// Next bundle; unpdf is resolved from node_modules at runtime.
//
// ponytail: process.cwd() is the app dir under `next dev`/`next start`. A Vercel
// deploy must trace lib/pdf-worker.mjs + unpdf into the function (see
// next.config outputFileTracingIncludes) — verify when deployment lands.

const WORKER_PATH = path.join(process.cwd(), "lib", "pdf-worker.mjs");
const PARSE_TIMEOUT_MS = 5000;
export const MAX_PAGES = 30; // a résumé is 1–3 pages
export const MAX_CHARS = 10000; // matches createInput.resumeText in /api/interviews

export type PdfParseResult =
  | { ok: true; text: string }
  | { ok: false; reason: "too-many-pages" | "parse-failed" | "timeout" };

export function parsePdf(bytes: Uint8Array, opts?: { spin?: boolean }): Promise<PdfParseResult> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (r: PdfParseResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      resolve(r);
    };
    // Clone the buffer into the worker (not transfer) so the caller keeps its
    // copy — the route still needs the bytes to upload the file to R2.
    const worker = new Worker(WORKER_PATH, {
      workerData: { buffer: bytes.buffer, maxPages: MAX_PAGES, maxChars: MAX_CHARS, spin: opts?.spin ?? false },
      resourceLimits: { maxOldGenerationSizeMb: 256 },
    });
    const timer = setTimeout(() => finish({ ok: false, reason: "timeout" }), PARSE_TIMEOUT_MS);
    worker.once("message", (m: { text?: string; error?: string }) =>
      m.error
        ? finish({ ok: false, reason: m.error === "too-many-pages" ? "too-many-pages" : "parse-failed" })
        : finish({ ok: true, text: m.text ?? "" }),
    );
    worker.once("error", () => finish({ ok: false, reason: "parse-failed" }));
    worker.once("exit", (code) => {
      if (code !== 0) finish({ ok: false, reason: "parse-failed" });
    });
  });
}
