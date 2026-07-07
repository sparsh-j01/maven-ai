import { randomUUID } from "node:crypto";
import { getDb, resumes } from "@maven-ai/db";
import { embedText } from "@maven-ai/shared/embed";
import { sql } from "drizzle-orm";
import { isR2Configured, putObject } from "@/lib/r2";
import { structureResume } from "@/lib/structure-resume";

// Hard storage cap: total bytes archived to R2 never exceeds this. Past it, uploads
// still work — we just stop saving the original file. Checked before each upload
// without a lock, so two concurrent uploads can overshoot by at most one file.
const STORAGE_CAP_BYTES = 500 * 1024 * 1024; // 500MB

// Upload the PDF to R2, structure + embed the text, insert a resumes row. No-op unless
// R2 is configured. Runs after the response and swallows errors — the RAG path works
// off the extracted text regardless.
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

  // Upload the original first — file_url is NOT NULL; structuring/embedding are enrichment.
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
