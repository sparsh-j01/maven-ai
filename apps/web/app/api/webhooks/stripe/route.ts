import { getDb, subscriptions, users } from "@maven-ai/db";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

// POST /api/webhooks/stripe — Stripe's source of truth for entitlements. Not
// Clerk-protected (Stripe calls it unauthenticated); the signature check is the
// auth. We read the raw body so the signature verifies.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 500 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    const raw = await req.text();
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    return new Response(`Invalid signature: ${(err as Error).message}`, {
      status: 400,
    });
  }

  const db = getDb();

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      const userId = s.client_reference_id;
      if (userId) {
        const customerId = typeof s.customer === "string" ? s.customer : null;
        const subId = typeof s.subscription === "string" ? s.subscription : null;
        await db.update(users).set({ plan: "pro" }).where(eq(users.id, userId));
        await db
          .insert(subscriptions)
          .values({
            userId,
            stripeCustomerId: customerId,
            stripeSubId: subId,
            status: "active",
          })
          .onConflictDoUpdate({
            target: subscriptions.userId,
            set: {
              stripeCustomerId: customerId,
              stripeSubId: subId,
              status: "active",
            },
          });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const userId = sub.metadata?.userId;
      if (userId) {
        const active = sub.status === "active" || sub.status === "trialing";
        await db
          .update(users)
          .set({ plan: active ? "pro" : "free" })
          .where(eq(users.id, userId));
        // current_period_end moved onto the subscription item in recent API
        // versions; read it from the first item.
        const periodEnd = sub.items.data[0]?.current_period_end;
        await db
          .update(subscriptions)
          .set({
            status: sub.status,
            stripeSubId: sub.id,
            currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
          })
          .where(eq(subscriptions.userId, userId));
      }
      break;
    }
  }

  return Response.json({ received: true });
}
