import { auth } from "@clerk/nextjs/server";
import { getDb, subscriptions } from "@maven-ai/db";
import { eq } from "drizzle-orm";
import { cancelSubscription, isRazorpayConfigured } from "@/lib/razorpay";

// Schedules the cancellation; it doesn't downgrade anyone. users.plan is written
// by the Razorpay webhook alone, so Pro survives until the paid period lapses.
export async function POST(_req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  if (!isRazorpayConfigured()) {
    return new Response("Billing not configured", { status: 500 });
  }

  const db = getDb();
  const [sub] = await db
    .select({ subId: subscriptions.stripeSubId, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));

  if (!sub?.subId) {
    return new Response("No subscription to cancel", { status: 404 });
  }
  // Razorpay 400s on a second cancel; answer it ourselves so the user sees why.
  if (sub.status === "cancelling") {
    return new Response("Already set to cancel at the end of this period", {
      status: 409,
    });
  }

  try {
    await cancelSubscription(sub.subId);
  } catch (err) {
    console.error("razorpay cancel failed", err);
    return new Response("Couldn't cancel right now. Please try again.", {
      status: 502,
    });
  }

  // Razorpay already cancelled — that's the source of truth. If this local write
  // fails, don't report failure: the user would retry and hit the 409 above for a
  // cancel that actually worked. The webhook reconciles status when it lapses.
  try {
    await db
      .update(subscriptions)
      .set({ status: "cancelling" })
      .where(eq(subscriptions.userId, userId));
  } catch (err) {
    console.error("cancel: local status write failed after razorpay cancel", err);
  }

  return Response.json({ ok: true });
}
