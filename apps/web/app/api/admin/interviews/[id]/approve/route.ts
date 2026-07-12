import { auth } from "@clerk/nextjs/server";
import { getDb, interviews } from "@maven-ai/db";
import { and, eq } from "drizzle-orm";
import { isAdmin } from "@/lib/admin";

// POST /api/admin/interviews/:id/approve — admin-only. Flips a `requested`
// interview to `approved` so its owner can start the live session (/token).
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!isAdmin(userId)) return new Response("Not found", { status: 404 });

  const { id } = await params;
  const db = getDb();
  const [row] = await db
    .update(interviews)
    .set({ status: "approved" })
    .where(and(eq(interviews.id, id), eq(interviews.status, "requested")))
    .returning({ id: interviews.id });

  if (!row) return new Response("Not a pending request", { status: 409 });
  return Response.json({ ok: true });
}
