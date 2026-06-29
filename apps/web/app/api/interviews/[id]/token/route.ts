import { auth } from "@clerk/nextjs/server";
import { getDb, interviews } from "@maven-ai/db";
import { and, eq } from "drizzle-orm";
import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";

// POST /api/interviews/:id/token — mint a scoped LiveKit token for this room.
// F1 (§8.1): pinned to the one room, identity-locked, short TTL. The grant is
// audio-publish only (the candidate's mic for push-to-talk) plus the data
// channel for live transcript — no video, no screen share.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const db = getDb();

  // Ownership check — no cross-user room access (no IDOR). Pull the plan too; it
  // rides to the agent as room metadata below.
  const [iv] = await db
    .select({
      id: interviews.id,
      role: interviews.role,
      company: interviews.company,
      companyType: interviews.companyType,
      seniority: interviews.seniority,
      type: interviews.type,
      planJson: interviews.planJson,
      resumeText: interviews.resumeText,
      jdText: interviews.jdText,
    })
    .from(interviews)
    .where(and(eq(interviews.id, id), eq(interviews.userId, userId)));
  if (!iv) return new Response("Not found", { status: 404 });

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const livekitHost = process.env.LIVEKIT_URL; // wss:// — server-to-server control
  if (!apiKey || !apiSecret || !serverUrl || !livekitHost) {
    return new Response("LiveKit env not configured", { status: 500 });
  }

  const room = `interview-${id}`;

  // Hand the agent its per-interview context (§2.1 step 3): create the room up
  // front with the plan as metadata, so it's present before LiveKit auto-dispatches
  // the agent. The agent reads ctx.room.metadata to drive its state machine and
  // persists the live cursor (current_phase/plan_cursor) back to this row.
  // createRoom is get-or-create, so a reconnect is a no-op (the plan is static).
  const svc = new RoomServiceClient(
    livekitHost.replace(/^ws/, "http"),
    apiKey,
    apiSecret,
  );
  await svc.createRoom({
    name: room,
    metadata: JSON.stringify({
      interviewId: id,
      role: iv.role,
      company: iv.company,
      companyType: iv.companyType,
      seniority: iv.seniority,
      type: iv.type,
      plan: iv.planJson,
      resumeText: iv.resumeText,
      jdText: iv.jdText,
    }),
    emptyTimeout: 10 * 60,
    departureTimeout: 60,
  });

  const at = new AccessToken(apiKey, apiSecret, { identity: userId, ttl: "15m" });
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canPublishSources: [TrackSource.MICROPHONE], // mic only — no video/screen share
    canSubscribe: true,
    canPublishData: true,
  });
  const token = await at.toJwt();

  // ponytail: BFF marks live on join; the agent-confirmed transition (§2.1 step
  // 4) comes with agent dispatch in milestone 3.
  await db
    .update(interviews)
    .set({ livekitRoom: room, status: "live", startedAt: new Date() })
    .where(and(eq(interviews.id, id), eq(interviews.userId, userId)));

  return Response.json({ token, serverUrl, room });
}
