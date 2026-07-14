import { auth } from "@clerk/nextjs/server";
import { getDb, interviews, interviewTurns } from "@maven-ai/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { inngest } from "@/lib/inngest";

// POST /api/interviews/:id/end — the candidate ended the interview early (the
// Leave button). Finalize the row so the async scorer runs on the partial
// transcript and a report is generated; without this an early exit leaves the
// interview stuck `live` with no report. Natural completion and the time cap
// already finalize agent-side (§4.3) — this only covers the user-initiated exit.
// Idempotent + ownership-scoped (no IDOR).
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const db = getDb();

  const [iv] = await db
    .select({ status: interviews.status })
    .from(interviews)
    .where(and(eq(interviews.id, id), eq(interviews.userId, userId)));
  if (!iv) return new Response("Not found", { status: 404 });

  // Already finalized (natural end / cap / a prior leave): report it as-is.
  if (iv.status !== "live" && iv.status !== "provisioning") {
    return Response.json({ status: iv.status, scored: iv.status !== "live" });
  }

  // Only score if the candidate actually spoke — no empty reports from a room
  // someone opened and abandoned in the first few seconds.
  const [spoke] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(interviewTurns)
    .where(
      and(
        eq(interviewTurns.interviewId, id),
        eq(interviewTurns.speaker, "candidate"),
      ),
    );
  if ((spoke?.count ?? 0) === 0) {
    // Nobody said anything, so no interview happened. This used to return with the row
    // left `live` — which stranded it live forever AND spent a monthly slot on nothing.
    // The worst case was an agent outage: the candidate joins, no interviewer ever
    // shows up, they give up, and they've been charged for silence.
    //
    // Hand it back instead: `approved` is unbilled (UNBILLED_STATUSES), and the token
    // route already lets an `approved` interview join again — so "retry" just works.
    await db
      .update(interviews)
      .set({ status: "approved" })
      .where(
        and(
          eq(interviews.id, id),
          eq(interviews.userId, userId),
          inArray(interviews.status, ["live", "provisioning"]),
        ),
      );
    return Response.json({ status: "approved", scored: false });
  }

  // The status check above and this write are two round-trips, so a double-click on
  // Leave (or racing the agent's own finalize) can have both callers pass it. Put the
  // expected status in the UPDATE itself: the DB picks one winner, and only that one
  // fires the scorer. Without this both send interview/ended and we score — and pay —
  // twice on the same transcript.
  const won = await db
    .update(interviews)
    .set({ status: "processing", endedAt: sql`now()` })
    .where(
      and(
        eq(interviews.id, id),
        eq(interviews.userId, userId),
        inArray(interviews.status, ["live", "provisioning"]),
      ),
    )
    .returning({ id: interviews.id });

  if (won.length === 0) {
    // Someone else finalized between our read and our write.
    return Response.json({ status: "processing", scored: true });
  }

  await inngest.send({ name: "interview/ended", data: { interviewId: id } });
  return Response.json({ status: "processing", scored: true });
}
