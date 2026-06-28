import { auth, currentUser } from "@clerk/nextjs/server";
import { getDb, interviews, users } from "@maven-ai/db";
import { seniority, interviewType } from "@maven-ai/shared";
import { z } from "zod";
import { personalizePlan } from "@/lib/personalize-plan";

// Setup-wizard input (milestone 4). role/seniority/type drive plan generation;
// company is optional flavour the agent uses for its prompt, not for selection.
const createInput = z.object({
  role: z.string().trim().min(1).max(100),
  company: z.string().trim().max(100).optional(),
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
  const { role, company, seniority: sen, type, resumeText, jdText } = parsed.data;

  const db = getDb();

  // ponytail: mirror Clerk identity on first write. Replace with the Clerk
  // webhook sync when billing lands (milestone 8); upsert is fine until then.
  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress ?? "";
  await db.insert(users).values({ id: userId, email }).onConflictDoNothing();

  // Generate the phased plan up front (§4.1) and persist it as plan_json. When a
  // résumé/JD is supplied, an LLM personalizes WHICH bank questions to ask (tier
  // B), grounded to the bank with a deterministic fallback. The cursor starts at
  // intro; the agent advances it via next_question.
  const plan = await personalizePlan({
    role,
    seniority: sen,
    type,
    company,
    resumeText,
    jdText,
  });

  const [iv] = await db
    .insert(interviews)
    .values({
      userId,
      role,
      company: company || null,
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
