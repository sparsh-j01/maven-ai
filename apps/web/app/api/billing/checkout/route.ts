import { auth, currentUser } from "@clerk/nextjs/server";
import { getDb, users } from "@maven-ai/db";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";

// POST /api/billing/checkout — start a Stripe Checkout for the Pro subscription
// and return the hosted-checkout URL. The client redirects to it; the webhook
// flips users.plan once payment completes.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO;
  if (!priceId) return new Response("Billing not configured", { status: 500 });

  // Already-subscribed guard: the UI hides the button for pro users, but the
  // API is the boundary — a second checkout would double-bill and orphan the
  // tracked subscription row. (The seconds-wide webhook-lag window stays open;
  // it self-heals once the webhook lands.)
  const [row] = await getDb()
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId));
  if (row?.plan === "pro") {
    return new Response("Already subscribed", { status: 409 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  const origin =
    req.headers.get("origin") ?? new URL(req.url).origin;

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    // Links the payment back to the Clerk user in the webhook.
    client_reference_id: userId,
    customer_email: email,
    // Carried onto subscription.updated/deleted events so we can map those back.
    subscription_data: { metadata: { userId } },
    success_url: `${origin}/dashboard?upgraded=1`,
    cancel_url: `${origin}/dashboard`,
  });

  return Response.json({ url: session.url });
}
