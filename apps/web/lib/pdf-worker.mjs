// Runs PDF text extraction OFF the request thread. A malicious "CPU-bomb" PDF
// (pathological object graph) can make pdf.js spin synchronously; on the main
// thread a Promise.race timeout can't interrupt that, but a worker can be
// hard-terminated by the parent (see lib/pdf-parse.ts). The parent also caps
// this worker's heap, so an allocation-bomb OOMs the worker alone.
import { extractText, getDocumentProxy } from "unpdf";
import { parentPort, workerData } from "node:worker_threads";

const { buffer, maxPages, maxChars, spin } = workerData;

// Test-only: burn CPU so the parent's terminate()-on-timeout can be exercised.
// The route never sets `spin`.
if (spin) for (;;) { /* hard-kill target */ }

try {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  if (pdf.numPages > maxPages) {
    parentPort.postMessage({ error: "too-many-pages" });
  } else {
    const { text } = await extractText(pdf, { mergePages: true });
    parentPort.postMessage({ text: String(text).slice(0, maxChars) });
  }
} catch {
  parentPort.postMessage({ error: "parse-failed" });
}
