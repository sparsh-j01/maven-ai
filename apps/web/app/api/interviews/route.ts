import { auth, currentUser } from "@clerk/nextjs/server";
import { getDb, interviews, users } from "@maven-ai/db";
import {
  companyType,
  interviewType,
  monthStart,
  monthlyInterviewLimit,
  seniority,
  UNBILLED_STATUSES,
} from "@maven-ai/shared";
import { and, eq, gte, notInArray, sql } from "drizzle-orm";
import { z } from "zod";

// Per-user creation cap: one account can't loop this endpoint to fill the admin queue
// with junk. Rolling 1-hour window off the (user_id, created_at) index. This is no
// longer a spend cap — nothing metered runs here any more — so it only has to bound
// rows, not cost.
const MAX_INTERVIEWS_PER_HOUR = 10;

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

// Create a session row (status `requested`); the plan is generated at approval.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const parsed = createInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("Invalid interview setup", { status: 400 });
  const { role, company, companyType: coType, seniority: sen, type, resumeText, jdText } = parsed.data;

  // Clerk identity is fetched BEFORE the transaction below: this is an HTTP round-trip
  // to Clerk, and holding a database lock across a network call to a third party turns
  // their latency into our serialization.
  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress?.trim() ?? "";

  const db = getDb();
  const since = new Date(Date.now() - 60 * 60 * 1000);

  // Both gates below are read-then-write, and that gap is the whole problem: N requests
  // arriving together all run their COUNT before any of them INSERTs, so all N read the
  // same pre-insert total, all N pass, and all N write. Either cap then bound only the
  // callers who politely waited their turn — one account firing concurrently could put in
  // as many rows as it liked, which is exactly the shape an abusive client takes.
  //
  // So take a per-user lock and do check-then-write with nobody in between. hashtext()
  // maps the Clerk id onto the bigint the lock is keyed by; distinct users hash to
  // distinct keys and never contend. The _xact_ variant releases on commit AND on
  // rollback, so there is no unlock path to leak.
  const outcome = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

    const [recent] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(interviews)
      .where(and(eq(interviews.userId, userId), gte(interviews.createdAt, since)));
    if ((recent?.count ?? 0) >= MAX_INTERVIEWS_PER_HOUR) {
      return {
        error: "Too many interviews started — try again in a bit.",
        status: 429,
      } as const;
    }

    // Mirror Clerk identity on first write; the gateway webhook keeps users.plan in sync.
    // An interview doesn't need an email, so a user without one in Clerk still gets a row
    // (users.email is NOT NULL — "" is the only option). But that "" must not be permanent:
    // upsert the address whenever Clerk has one, so it heals on the next write instead of
    // following the account forever. coalesce/nullif keeps a good stored email when this
    // request is the one with nothing to offer — never clobber a real address with "".
    // DoUpdate always returns the row, so unlike DoNothing there's no second read to fold
    // in the existing-user case.
    const [row] = await tx
      .insert(users)
      .values({ id: userId, email })
      .onConflictDoUpdate({
        target: users.id,
        set: { email: sql`coalesce(nullif(excluded.email, ''), ${users.email})` },
      })
      .returning({ plan: users.plan });
    const userPlan = row?.plan ?? "free";

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

    // No plan yet — the request is just a row until an admin approves it, and the approve
    // route generates plan_json then. /token only ever runs on an approved row, so the
    // plan is always present by the time anything reads it.
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
