import { auth } from "@clerk/nextjs/server";
import { getDb, interviews } from "@maven-ai/db";
import { and, eq } from "drizzle-orm";
import { inngest } from "@/lib/inngest";

// POST /api/interviews/:id/score — (re)trigger async scoring for a finished
// interview the caller owns. Idempotent: it only kicks the durable job when
// there's something to do — a fresh `processing` interview, or a `failed` one
// being retried (§7.5). The heavy LLM grading runs in the Inngest function,
// never on this request (§4.3).
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const db = getDb();

  // Ownership-scoped — no scoring another user's interview (no IDOR).
  const [iv] = await db
    .select({ status: interviews.status })
    .from(interviews)
    .where(and(eq(interviews.id, id), eq(interviews.userId, userId)));
  if (!iv) return new Response("Not found", { status: 404 });

  if (iv.status === "processing" || iv.status === "failed") {
    // A retry resets failed → processing so the UI shows progress again.
    if (iv.status === "failed") {
      await db
        .update(interviews)
        .set({ status: "processing" })
        .where(and(eq(interviews.id, id), eq(interviews.userId, userId)));
    }
    await inngest.send({ name: "interview/ended", data: { interviewId: id } });
    return Response.json({ status: "processing" });
  }

  // ready / live / provisioning: nothing to (re)score; report it as-is.
  return Response.json({ status: iv.status });
}
