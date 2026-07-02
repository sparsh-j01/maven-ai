import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import { isPdfHeader } from "@/lib/pdf-header.mjs";
import { MAX_PAGES, parsePdf } from "@/lib/pdf-parse";
import { persistResume } from "@/lib/store-resume";

// POST /api/resumes/parse — pull the text out of an uploaded résumé PDF so the
// setup form can drop it into the résumé field, where the existing paste-text
// path embeds it for RAG personalization (§5). We only extract text; the file
// itself isn't stored (durable R2/MinIO storage + the `resumes` table land with
// the storage layer — nothing reads them yet).
//
// Hardening (§8.1 F6): auth first, a per-user throttle, content-type pinned to
// PDF AND verified by magic bytes (the client label is untrusted), size capped
// before we buffer, then parsing is done in a worker thread that caps pages,
// hard-kills a CPU-bomb on timeout, and caps memory. The file is only ever read
// as data — never executed; embedded PDF JavaScript is not run.

const MAX_BYTES = 3 * 1024 * 1024; // 3MB — résumés are tiny; well under Vercel's 4.5MB request cap

// ponytail: in-memory per-user throttle — resets on redeploy and isn't shared
// across serverless instances, but it's zero-dep and blunts single-instance
// abuse. Swap to @upstash/ratelimit if it needs to hold cross-instance (§8).
const WINDOW_MS = 10 * 60_000;
const MAX_PARSES = 20;
const hits = new Map<string, number[]>();
function throttled(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > MAX_PARSES;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  if (throttled(userId)) {
    return new Response("Too many uploads — try again shortly.", { status: 429 });
  }

  // Reject by the declared length before buffering the body. A missing/invalid
  // length is untrusted so we refuse it; multipart runs a little over the file
  // itself, so allow a small margin over the file cap. file.size below is the
  // authoritative file-only check.
  const lenHeader = req.headers.get("content-length");
  const declared = lenHeader === null ? NaN : Number(lenHeader);
  if (!Number.isFinite(declared) || declared > MAX_BYTES + 1024) {
    return new Response("File too large (max 3MB)", { status: 413 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return new Response("No file uploaded", { status: 400 });
  if (file.type !== "application/pdf") return new Response("PDF files only", { status: 415 });
  if (file.size > MAX_BYTES) return new Response("File too large (max 3MB)", { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Verify it's really a PDF by its header (shared with the self-check), not the
  // client-supplied MIME type.
  if (!isPdfHeader(bytes)) {
    return new Response("That doesn't look like a PDF file", { status: 415 });
  }

  const result = await parsePdf(bytes);
  if (!result.ok) {
    if (result.reason === "too-many-pages") {
      return new Response(`PDF has too many pages (max ${MAX_PAGES})`, { status: 413 });
    }
    if (result.reason === "timeout") {
      return new Response("That PDF took too long to read", { status: 422 });
    }
    return new Response("Couldn't read that PDF", { status: 422 });
  }

  const clean = result.text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return new Response("No selectable text found in that PDF", { status: 422 });

  // Archive the file + structured/embedded résumé AFTER responding, so the
  // upload stays snappy. No-op unless R2 is configured; failures are swallowed
  // (the RAG path only needs the text we're returning now). (§5)
  after(() =>
    persistResume({ userId, bytes, text: clean }).catch((e) =>
      console.error("[resumes] persist failed:", e),
    ),
  );

  return Response.json({ text: clean });
}
