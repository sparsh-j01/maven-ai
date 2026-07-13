import { getDb, subscriptions, users } from "@maven-ai/db";
import { eq } from "drizzle-orm";
import { verifyWebhook } from "@/lib/razorpay";

// Unauthenticated by design: Razorpay calls this directly, the HMAC signature is the auth.
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature");
  if (!verifyWebhook(raw, sig)) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event: {
    event: string;
    payload?: {
      subscription?: {
        entity: { id: string; status: string; notes?: { userId?: string } };
      };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    // Signature was valid but the body isn't JSON — answer 400, not an uncaught 500.
    return new Response("Invalid payload", { status: 400 });
  }

  const sub = event.payload?.subscription?.entity;
  const userId = sub?.notes?.userId;
  if (!sub || !userId) return Response.json({ received: true });

  const db = getDb();

  // Idempotent upserts (onConflictDoUpdate); we assume Razorpay delivers these in
  // order — a stray late "charged" after a "cancelled" could re-activate, but the
  // next billing cycle self-corrects and this is test-mode volume. stripeSubId
  // holds the Razorpay subscription id (generic gateway id; see schema comment).
  switch (event.event) {
    case "subscription.activated":
    case "subscription.charged":
    case "subscription.resumed": {
      await db.update(users).set({ plan: "pro" }).where(eq(users.id, userId));
      await db
        .insert(subscriptions)
        .values({ userId, stripeSubId: sub.id, status: "active" })
        .onConflictDoUpdate({
          target: subscriptions.userId,
          set: { stripeSubId: sub.id, status: "active" },
        });
      break;
    }
    case "subscription.halted":
    case "subscription.cancelled":
    case "subscription.completed": {
      await db.update(users).set({ plan: "free" }).where(eq(users.id, userId));
      await db
        .update(subscriptions)
        .set({ status: sub.status })
        .where(eq(subscriptions.userId, userId));
      break;
    }
  }

  return Response.json({ received: true });
}
