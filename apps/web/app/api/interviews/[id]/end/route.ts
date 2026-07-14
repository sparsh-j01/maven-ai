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
// One rule for every exit below. The client redirects on `scored` (report page vs
// dashboard), so an interview that was handed back as `approved` must not be reported
// as scored — that sends the candidate to a report which will never exist.
const NOT_SCORED = ["requested", "approved", "provisioning", "live"];
const scoredFor = (status: string) => !NOT_SCORED.includes(status);

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const db = getDb();
  const owned = and(eq(interviews.id, id), eq(interviews.userId, userId));

  // Every status write below is conditional, so a loser needs the truth, not a guess.
  const readStatus = async (): Promise<string> => {
    const [row] = await db
      .select({ status: interviews.status })
      .from(interviews)
      .where(owned);
    return row?.status ?? "failed";
  };

  const [iv] = await db
    .select({ status: interviews.status })
    .from(interviews)
    .where(owned);
  if (!iv) return new Response("Not found", { status: 404 });

  // Already finalized (natural end / cap / a prior leave): report it as-is.
  if (iv.status !== "live" && iv.status !== "provisioning") {
    return Response.json({ status: iv.status, scored: scoredFor(iv.status) });
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
    //
    // Conditional, and checked: the agent can finalize server-side between our read and
    // this write, in which case we matched zero rows and the row is being scored. Saying
    // "approved, not scored" then would be a lie the client acts on.
    const reset = await db
      .update(interviews)
      .set({ status: "approved" })
      .where(and(owned, inArray(interviews.status, ["live", "provisioning"])))
      .returning({ status: interviews.status });

    const status = reset[0]?.status ?? (await readStatus());
    return Response.json({ status, scored: scoredFor(status) });
  }

  // The status check above and this write are two round-trips, so a double-click on
  // Leave (or racing the agent's own finalize) can have both callers pass it. Put the
  // expected status in the UPDATE itself: the DB picks one winner, and only that one
  // fires the scorer. Without this both send interview/ended and we score — and pay —
  // twice on the same transcript.
  const won = await db
    .update(interviews)
    .set({ status: "processing", endedAt: sql`now()` })
    .where(and(owned, inArray(interviews.status, ["live", "provisioning"])))
    .returning({ id: interviews.id });

  if (won.length === 0) {
    // Someone else finalized between our read and our write. It's usually `processing`,
    // but a racing no-speech leave could have handed the row back as `approved` — so
    // read it rather than assuming.
    const status = await readStatus();
    return Response.json({ status, scored: scoredFor(status) });
  }

  await inngest.send({ name: "interview/ended", data: { interviewId: id } });
  return Response.json({ status: "processing", scored: true });
}
