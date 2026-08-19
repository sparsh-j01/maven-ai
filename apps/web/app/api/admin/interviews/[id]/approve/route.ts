import { auth } from "@clerk/nextjs/server";
import { getDb, interviews } from "@maven-ai/db";
import type { CompanyType, InterviewType, Seniority } from "@maven-ai/shared";
import { and, eq } from "drizzle-orm";
import { isAdmin } from "@maven-ai/shared/admin";
import { personalizePlan } from "@/lib/personalize-plan";

// personalizePlan runs retrieval (embed, 8s cap) and THEN the plan LLM (7s cap),
// sequentially — ~15s worst case, past Vercel's 10s default. 60s is the Hobby ceiling.
export const maxDuration = 60;

// POST /api/admin/interviews/:id/approve — admin-only. Generates the question plan
// and flips a `requested` interview to `approved` so its owner can start the live
// session (/token).
//
// The plan is generated HERE, not at creation, so the one metered call on this path
// sits behind the approval gate instead of in front of it. /token reads plan_json into
// the room metadata, so it has to exist by the time this returns — which is why this
// route pays the latency rather than /token. An admin waiting ~15s on their own
// dashboard is the right place to spend it.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!isAdmin(userId)) return new Response("Not found", { status: 404 });

  const { id } = await params;
  const db = getDb();

  // Read the plan inputs the candidate submitted. Scoped to `requested` so an
  // already-approved (or live, or scored) interview never gets a second plan.
  const [iv] = await db
    .select({
      role: interviews.role,
      company: interviews.company,
      companyType: interviews.companyType,
      seniority: interviews.seniority,
      type: interviews.type,
      resumeText: interviews.resumeText,
      jdText: interviews.jdText,
    })
    .from(interviews)
    .where(and(eq(interviews.id, id), eq(interviews.status, "requested")));
  if (!iv) return new Response("Not a pending request", { status: 409 });

  // Fails safe internally: RAG retrieval falls back to the deterministic order, the
  // LLM may only pick ids from the curated bank, and the whole thing falls back to
  // buildPlan. It resolves to a usable plan or throws, never to null.
  // The columns are plain text in Postgres; the enums live in the zod schemas the
  // create route validates against, so anything stored is already one of these.
  const plan = await personalizePlan({
    role: iv.role,
    seniority: iv.seniority as Seniority,
    type: iv.type as InterviewType,
    company: iv.company,
    companyType: iv.companyType as CompanyType | null,
    resumeText: iv.resumeText,
    jdText: iv.jdText,
  });

  // Still conditional on `requested`: the read above and this write are two
  // round-trips, so a double-clicked Approve can have both callers pass the read.
  // The DB picks one winner; the loser gets the 409 and its plan is discarded.
  const [row] = await db
    .update(interviews)
    .set({ status: "approved", planJson: plan })
    .where(and(eq(interviews.id, id), eq(interviews.status, "requested")))
    .returning({ id: interviews.id });

  if (!row) return new Response("Not a pending request", { status: 409 });
  return Response.json({ ok: true });
}
