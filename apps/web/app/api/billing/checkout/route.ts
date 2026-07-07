import { auth, currentUser } from "@clerk/nextjs/server";
import { getDb, users } from "@maven-ai/db";
import { isCycle, isRegion, regionForCountry } from "@maven-ai/shared";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { createProSubscription, isRazorpayConfigured } from "@/lib/razorpay";
import { getStripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  // Guard against double-billing: the UI hides the button for pro, the API enforces it.
  const [row] = await getDb()
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId));
  if (row?.plan === "pro") {
    return new Response("Already subscribed", { status: 409 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;

  const jar = await cookies();
  const override = jar.get("pref_region")?.value;
  const country = (await headers()).get("x-vercel-ip-country");
  const region =
    override && isRegion(override) ? override : regionForCountry(country);
  const cycleRaw = jar.get("pref_cycle")?.value;
  const cycle = cycleRaw && isCycle(cycleRaw) ? cycleRaw : "monthly";

  // India → Razorpay (₹) once configured, else fall through to Stripe.
  if (region === "IN" && isRazorpayConfigured()) {
    const annualPlan =
      cycle === "annual" ? process.env.RAZORPAY_PLAN_ID_PRO_ANNUAL : undefined;
    const planId = annualPlan || process.env.RAZORPAY_PLAN_ID_PRO!;
    const totalCount = annualPlan ? 10 : 120;
    const url = await createProSubscription(userId, planId, totalCount, email);
    return Response.json({ url });
  }

  const priceId =
    (cycle === "annual" && process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL) ||
    process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO;
  if (!priceId) return new Response("Billing not configured", { status: 500 });
  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: userId,
    customer_email: email,
    subscription_data: { metadata: { userId } },
    success_url: `${origin}/dashboard?upgraded=1`,
    cancel_url: `${origin}/dashboard`,
  });

  return Response.json({ url: session.url });
}
