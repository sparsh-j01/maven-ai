import { auth, currentUser } from "@clerk/nextjs/server";
import { getDb, interviews, users } from "@maven-ai/db";
import {
  companyType,
  interviewType,
  monthStart,
  monthlyInterviewLimit,
  pendingRequestLimit,
  seniority,
  UNBILLED_STATUSES,
} from "@maven-ai/shared";
import { and, eq, gte, notInArray, sql } from "drizzle-orm";
import { z } from "zod";

// role/seniority/type drive plan generation; company is optional flavour; companyType
// shifts the difficulty band and the agent's tone.
const createInput = z.object({
  role: z.string().trim().min(1).max(100),
  company: z.string().trim().max(100).optional(),
  companyType: companyType.optional(),
  seniority,
  type: interviewType,
  // Capped to bound prompt size and the injection surface; the agent re-truncates + delimits it as data.
  resumeText: z.string().trim().max(10000).optional(),
  jdText: z.string().trim().max(5000).optional(),
});

// Create a request row (status `requested`). No plan and nothing metered — the approve
// route generates the question plan once an admin lets the interview through.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const parsed = createInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("Invalid interview setup", { status: 400 });
  const { role, company, companyType: coType, seniority: sen, type, resumeText, jdText } = parsed.data;

  // Clerk identity is fetched BEFORE the transaction below: this is an HTTP round-trip
  // to Clerk, and holding a database lock across a network call to a third party means
  // one slow upstream serializes every create this user makes.
  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress?.trim() ?? "";

  const db = getDb();

  // Both caps below are read-then-write, and that gap is the whole problem: N requests
  // arriving together all run their COUNT before any of them INSERTs, so all N read the
  // same pre-insert total, all N pass, and all N write. Either cap then bound only the
  // callers who politely waited their turn — one account firing concurrently could put in
  // as many rows as it liked, which is exactly the shape an abusive client takes. (This
  // mattered far more before plan generation moved to the approve route: back then the
  // thing past the gap was a metered Gemini call, not an INSERT.)
  //
  // So take a per-user lock and do check-then-write with nobody in between. hashtext()
  // maps the Clerk id onto the bigint the lock is keyed by; distinct users hash to
  // distinct keys and never contend. The _xact_ variant releases on commit AND on
  // rollback, so there is no unlock path to leak.
  const outcome = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

    // Mirror Clerk identity on first write; the gateway webhook keeps users.plan in sync.
    // An interview doesn't need an email, so a user without one in Clerk still gets a row
    // (users.email is NOT NULL — "" is the only option). But that "" must not be permanent:
    // upsert the address whenever Clerk has one, so it heals on the next write instead of
    // following the account forever. coalesce/nullif keeps a good stored email when this
    // request is the one with nothing to offer — never clobber a real address with "".
    // DoUpdate always returns the row, so unlike DoNothing there's no second read to fold
    // in the existing-user case.
    //
    // This runs FIRST because both gates below are plan-dependent, and users.plan is the
    // only authority on which plan that is — never anything the client sent.
    const [row] = await tx
      .insert(users)
      .values({ id: userId, email })
      .onConflictDoUpdate({
        target: users.id,
        set: { email: sql`coalesce(nullif(excluded.email, ''), ${users.email})` },
      })
      .returning({ plan: users.plan });
    const userPlan = row?.plan ?? "free";

    // Queue-depth ceiling: how many of this user's requests are still awaiting approval.
    // A ceiling, not a rate — `requested` is the status a row is born with and leaves the
    // moment an admin approves it, so this refills when an admin acts, never on a clock.
    // It replaced a flat 10-per-hour window (a SPEND number from when creation generated
    // the plan): a rate refills on its own, so waiting is a valid strategy for an abusive
    // client and one account still accrues 240 rows a day. Pro gets more room to line work
    // up (see PLAN_LIMITS); an unrecognised plan fails closed to the free ceiling.
    const [pending] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(interviews)
      .where(and(eq(interviews.userId, userId), eq(interviews.status, "requested")));
    if ((pending?.count ?? 0) >= pendingRequestLimit(userPlan)) {
      // Deliberately not "try again in a bit" — nothing about waiting helps here, and
      // telling someone to wait for a limit that never expires on its own is the kind of
      // error message that sends them to support.
      return {
        error:
          "You already have interviews waiting for approval. You'll be able to request another once one of them is approved.",
        status: 429,
      } as const;
    }

    // Entitlement gate: monthly quota by plan. UNBILLED_STATUSES is the rule (shared with
    // the dashboard): an interview we never approved, or one that failed on our side, does
    // not spend a slot — otherwise a free user burns all three on interviews that never
    // happened, and can't retry until the 1st.
    const [usage] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(interviews)
      .where(
        and(
          eq(interviews.userId, userId),
          gte(interviews.createdAt, monthStart()),
          notInArray(interviews.status, [...UNBILLED_STATUSES]),
        ),
      );
    if ((usage?.count ?? 0) >= monthlyInterviewLimit(userPlan)) {
      return {
        error: "Monthly interview limit reached — upgrade to Pro for more.",
        status: 402,
      } as const;
    }

    // No plan yet — the request is just a row until an admin approves it, and the
    // approve route generates plan_json then (§spend gate).
    //
    // Plan generation used to run HERE, before approval, which put a metered call in
    // front of the gate rather than behind it. The hourly cap was the only thing limiting
    // it, and the monthly quota could not help: a fresh interview is `requested`, and
    // `requested` is in UNBILLED_STATUSES, so it never counted toward the quota it would
    // need to trip. That left 10 free Gemini plan-generations per account per hour,
    // refilling forever, on rows nobody had approved — and one signup per bot bought
    // another 10. Creating a row costs a database write; keep it that way.
    const [iv] = await tx
      .insert(interviews)
      .values({
        userId,
        role,
        company: company || null,
        companyType: coType || null,
        seniority: sen,
        type,
        resumeText: resumeText || null,
        jdText: jdText || null,
        // Spend gate: the candidate can set up a request for free, but the interview
        // waits in `requested` until an admin approves it — only then is a plan
        // generated, and only then can /token mint a LiveKit token and start the
        // (costly) live voice session.
        status: "requested",
        currentPhase: "intro",
      })
      .returning({ id: interviews.id });

    return { id: iv!.id } as const;
  });

  if ("error" in outcome) {
    return new Response(outcome.error, { status: outcome.status });
  }
  return Response.json({ id: outcome.id });
}
