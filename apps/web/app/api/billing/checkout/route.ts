import { auth, currentUser } from "@clerk/nextjs/server";
import { getDb, users } from "@maven-ai/db";
import { isCycle } from "@maven-ai/shared";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { createProSubscription, isRazorpayConfigured } from "@/lib/razorpay";

// Single gateway: Razorpay (test mode for now). The ₹ plan is charged for every
// region — INTL sees a $ display price but is billed via the Razorpay ₹ plan
// until Razorpay International (or a global gateway) is wired. Fine for test/demo.
export async function POST(_req: Request) {
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

  if (!isRazorpayConfigured()) {
    return new Response("Billing not configured", { status: 500 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;

  const jar = await cookies();
  const cycleRaw = jar.get("pref_cycle")?.value;
  const cycle = cycleRaw && isCycle(cycleRaw) ? cycleRaw : "monthly";

  const annualPlan =
    cycle === "annual" ? process.env.RAZORPAY_PLAN_ID_PRO_ANNUAL : undefined;
  const planId = annualPlan || process.env.RAZORPAY_PLAN_ID_PRO!;
  // total_count = billing cycles: ~10 years either way, just a long ceiling.
  const totalCount = annualPlan ? 10 : 120;
  const url = await createProSubscription(userId, planId, totalCount, email);
  return Response.json({ url });
}
