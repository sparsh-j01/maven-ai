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

// Per-user creation cap (spend cap): one account can't loop this endpoint to burn
// Gemini plan-generation calls. Rolling 1-hour window off the (user_id, created_at) index.
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

// Create a session row (status `provisioning`) with a generated, phased question plan.
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

  // Mirror Clerk identity on first write; the gateway webhook keeps users.plan in sync.
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

  // Entitlement gate: monthly quota by plan, checked before the metered call so an
  // over-quota request costs nothing.
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

  // Generate the phased plan and persist as plan_json. With a résumé/JD, an LLM
  // personalizes which bank questions to ask, grounded with a deterministic fallback.
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
