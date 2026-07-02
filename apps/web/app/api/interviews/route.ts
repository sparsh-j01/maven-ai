import { auth, currentUser } from "@clerk/nextjs/server";
import { getDb, interviews, users } from "@maven-ai/db";
import {
  companyType,
  interviewType,
  monthStart,
  monthlyInterviewLimit,
  seniority,
} from "@maven-ai/shared";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { personalizePlan } from "@/lib/personalize-plan";

// Per-user creation cap (spend cap, §8.1): one account can't loop this endpoint
// to burn plan-generation (Gemini) calls. Rolling 1-hour window, counted off the
// (user_id, created_at) index. ponytail: a DB count, not Upstash — Postgres is
// already required here; reach for @upstash/ratelimit only if you later need
// sub-second or cross-region limiting.
const MAX_INTERVIEWS_PER_HOUR = 10;

// Setup-wizard input (milestone 4). role/seniority/type drive plan generation;
// company is optional flavour the agent uses for its prompt. companyType shifts
// the difficulty band (product harder / service easier / startup neutral) and the
// agent's tone.
const createInput = z.object({
  role: z.string().trim().min(1).max(100),
  company: z.string().trim().max(100).optional(),
  companyType: companyType.optional(),
  seniority,
  type: interviewType,
  // Optional pasted tailoring context. Capped here to bound prompt size and the
  // injection surface; the agent further truncates + delimits it as data (§8.1).
  resumeText: z.string().trim().max(10000).optional(),
  jdText: z.string().trim().max(5000).optional(),
});

// POST /api/interviews — create a session row (status `provisioning`) with a
// generated, phased question plan. The token + room join happen on the room
// page (see [id]/token).
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const parsed = createInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("Invalid interview setup", { status: 400 });
  const { role, company, companyType: coType, seniority: sen, type, resumeText, jdText } = parsed.data;

  const db = getDb();

  // Rate limit before the metered plan-generation call below.
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [recent] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(interviews)
    .where(and(eq(interviews.userId, userId), gte(interviews.createdAt, since)));
  if ((recent?.count ?? 0) >= MAX_INTERVIEWS_PER_HOUR) {
    return new Response("Too many interviews started — try again in a bit.", {
      status: 429,
    });
  }

  // ponytail: mirror Clerk identity on first write. The Stripe webhook keeps
  // users.plan in sync after checkout (milestone 8); this upsert seeds the row.
  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress ?? "";
  const [row] = await db
    .insert(users)
    .values({ id: userId, email })
    .onConflictDoNothing()
    .returning({ plan: users.plan });
  // onConflictDoNothing returns nothing on an existing row — read the plan back.
  const userPlan =
    row?.plan ??
    (
      await db
        .select({ plan: users.plan })
        .from(users)
        .where(eq(users.id, userId))
    )[0]?.plan ??
    "free";

  // Entitlement gate (milestone 8): monthly interview quota by plan. Counted off
  // the same (user_id, created_at) index as the hourly cap. Checked before the
  // metered plan-generation call below so an over-quota request costs nothing.
  const [usage] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(interviews)
    .where(
      and(
        eq(interviews.userId, userId),
        gte(interviews.createdAt, monthStart()),
      ),
    );
  if ((usage?.count ?? 0) >= monthlyInterviewLimit(userPlan)) {
    return new Response(
      "Monthly interview limit reached — upgrade to Pro for more.",
      { status: 402 },
    );
  }

  // Generate the phased plan up front (§4.1) and persist it as plan_json. When a
  // résumé/JD is supplied, an LLM personalizes WHICH bank questions to ask (tier
  // B), grounded to the bank with a deterministic fallback. The cursor starts at
  // intro; the agent advances it via next_question.
  const plan = await personalizePlan({
    role,
    seniority: sen,
    type,
    company,
    companyType: coType,
    resumeText,
    jdText,
  });

  const [iv] = await db
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
      status: "provisioning",
      planJson: plan,
      currentPhase: "intro",
    })
    .returning({ id: interviews.id });

  return Response.json({ id: iv!.id });
}
