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

  const annualPlan = process.env.RAZORPAY_PLAN_ID_PRO_ANNUAL;
  // RAZORPAY_PLAN_ID_PRO_ANNUAL is optional, so "annual" can be selected while it's
  // unset. Never quietly downgrade that to the monthly plan — the user asked to be
  // billed once a year and would instead be charged every month. Fail loudly.
  if (cycle === "annual" && !annualPlan) {
    return new Response("Annual billing isn't available right now", {
      status: 503,
    });
  }

  const useAnnual = cycle === "annual";
  const planId = useAnnual ? annualPlan! : process.env.RAZORPAY_PLAN_ID_PRO!;
  // total_count = billing cycles: ~10 years either way, just a long ceiling.
  const totalCount = useAnnual ? 10 : 120;

  // Ensure the users row exists BEFORE Razorpay charges. The webhook that upgrades the
  // user only knows the userId (from the subscription notes) and inserts a subscriptions
  // row FK'd to users.id. A user who subscribes before ever starting an interview has no
  // users row yet — the insert FK-violates, the webhook 500s, and Razorpay retries it
  // forever: money taken, never upgraded. users.email is NOT NULL so the webhook can't
  // create the row (it has no email); checkout has the email, so it does it here.
  await getDb()
    .insert(users)
    .values({ id: userId, email: email ?? "" })
    .onConflictDoNothing();

  try {
    const url = await createProSubscription(userId, planId, totalCount, email);
    return Response.json({ url });
  } catch (err) {
    // Razorpay rejected or is unreachable. Don't hand the user a bare 500 HTML page
    // on the money path — the client reads text and can show it.
    console.error("razorpay checkout failed", err);
    return new Response("Couldn't reach checkout. Please try again.", {
      status: 502,
    });
  }
}
