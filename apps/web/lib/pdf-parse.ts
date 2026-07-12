import path from "node:path";
import { Worker } from "node:worker_threads";

// Extract résumé text in a worker thread so a malicious CPU-bomb PDF can be hard-
// terminated on timeout and an allocation bomb is capped to the worker heap. The worker
// is loaded by path (not imported) so it stays out of the Next bundle.

const WORKER_PATH = path.join(process.cwd(), "lib", "pdf-worker.mjs");
const PARSE_TIMEOUT_MS = 5000;
export const MAX_PAGES = 30; // a résumé is 1–3 pages
const MAX_CHARS = 10000; // matches createInput.resumeText in /api/interviews

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
    // Clone the buffer (not transfer) so the caller keeps its copy to upload to R2.
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
