import { auth } from "@clerk/nextjs/server";
import { getDb, interviews } from "@maven-ai/db";
import { and, eq } from "drizzle-orm";
import { AccessToken, TrackSource } from "livekit-server-sdk";

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

  // Ownership check — no cross-user room access (no IDOR).
  const [iv] = await db
    .select({ id: interviews.id })
    .from(interviews)
    .where(and(eq(interviews.id, id), eq(interviews.userId, userId)));
  if (!iv) return new Response("Not found", { status: 404 });

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!apiKey || !apiSecret || !serverUrl) {
    return new Response("LiveKit env not configured", { status: 500 });
  }

  const room = `interview-${id}`;
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
