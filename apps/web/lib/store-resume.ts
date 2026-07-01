import { randomUUID } from "node:crypto";
import { getDb, resumes } from "@maven-ai/db";
import { embedText } from "@maven-ai/shared/embed";
import { sql } from "drizzle-orm";
import { isR2Configured, putObject } from "@/lib/r2";
import { structureResume } from "@/lib/structure-resume";

// Hard storage cap (free-tier safety valve): total bytes archived to R2 across
// all résumés never exceeds this. Once reached, uploads still work — we just
// stop saving the original file, so R2 usage can't grow past the cap.
// ponytail: checked before each upload, no lock — two concurrent uploads could
// overshoot by at most one file (≤3MB). Fine for this scale; add a lock/DB
// constraint only if archival ever becomes high-concurrency.
const STORAGE_CAP_BYTES = 500 * 1024 * 1024; // 500MB

// Durable résumé persistence (§5): upload the PDF to R2, structure + embed the
// text, and insert a `resumes` row keyed to the user. No-op unless R2 is
// configured or the storage cap is reached. The caller runs this AFTER the
// response (Next after()) and swallows errors — the RAG path works off the
// extracted text regardless, so a storage hiccup can never break an upload.
export async function persistResume(input: {
  userId: string;
  bytes: Uint8Array;
  text: string;
}): Promise<void> {
  if (!isR2Configured()) return;
  const db = getDb();

  // Enforce the storage cap before uploading anything.
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${resumes.fileSize}), 0)` })
    .from(resumes);
  if (Number(row?.total ?? 0) + input.bytes.length > STORAGE_CAP_BYTES) {
    console.warn("[resumes] storage cap reached — skipping archival");
    return;
  }

  // Upload the original file first — it's the column the schema requires
  // (file_url NOT NULL); structuring/embedding are enrichment on top.
  const key = `resumes/${input.userId}/${randomUUID()}.pdf`;
  const fileUrl = await putObject(key, input.bytes, "application/pdf");

  const [parsedJson, embedding] = await Promise.all([
    structureResume(input.text),
    embedText(input.text).catch(() => null),
  ]);

  await db.insert(resumes).values({
    userId: input.userId,
    fileUrl,
    fileSize: input.bytes.length,
    parsedJson: parsedJson ?? null,
    embedding: embedding ?? null,
  });
}
