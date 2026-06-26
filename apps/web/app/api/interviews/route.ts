import { auth, currentUser } from "@clerk/nextjs/server";
import { getDb, interviews, users } from "@maven-ai/db";

// POST /api/interviews — create a session row (status `provisioning`).
// The token + room join happen on the room page (see [id]/token).
export async function POST() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const db = getDb();

  // ponytail: mirror Clerk identity on first write. Replace with the Clerk
  // webhook sync when billing lands (milestone 8); upsert is fine until then.
  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress ?? "";
  await db.insert(users).values({ id: userId, email }).onConflictDoNothing();

  // ponytail: placeholder role/seniority/type — the setup wizard supplies the
  // real values in milestone 4. Milestone 2 only proves transport.
  const [iv] = await db
    .insert(interviews)
    .values({
      userId,
      role: "Software Engineer",
      seniority: "mid",
      type: "mixed",
      status: "provisioning",
    })
    .returning({ id: interviews.id });

  return Response.json({ id: iv!.id });
}
