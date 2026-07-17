import crypto from "node:crypto";

export function isRazorpayConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET &&
      process.env.RAZORPAY_PLAN_ID_PRO,
  );
}

function authHeader(): string {
  const id = process.env.RAZORPAY_KEY_ID!;
  const secret = process.env.RAZORPAY_KEY_SECRET!;
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

// fetch has no default timeout, so a stalled Razorpay leaves the route hanging until
// Vercel kills the invocation — the user clicks Upgrade and gets a dead request with
// no error to show. Abort first and throw something the caller can actually surface.
const RAZORPAY_TIMEOUT_MS = 10_000;

// userId rides in `notes` so the webhook can map the payment back to a user.
export async function createProSubscription(
  userId: string,
  planId: string,
  totalCount: number,
  email?: string,
): Promise<string> {
  const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    signal: AbortSignal.timeout(RAZORPAY_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      plan_id: planId,
      total_count: totalCount,
      customer_notify: 1,
      notes: { userId, email: email ?? "" },
    }),
  });
  if (!res.ok) {
    throw new Error(`Razorpay ${res.status}: ${await res.text()}`);
  }
  const sub = (await res.json()) as { id: string; short_url: string };
  return sub.short_url;
}

// Cancel at cycle end, not immediately: they paid for the current period, so they
// keep Pro until it runs out. Razorpay fires subscription.cancelled when it actually
// lapses — that webhook is what flips users.plan back to free, never this call.
export async function cancelSubscription(subId: string): Promise<void> {
  const res = await fetch(
    `https://api.razorpay.com/v1/subscriptions/${subId}/cancel`,
    {
      method: "POST",
      signal: AbortSignal.timeout(RAZORPAY_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(),
      },
      body: JSON.stringify({ cancel_at_cycle_end: 1 }),
    },
  );
  if (res.ok) return;
  const bodyText = await res.text();
  // A cancel Razorpay has ALREADY processed is a success, not a failure.
  //
  // Without this, the 10s abort above strands the user forever. Razorpay accepts the
  // cancel but answers slowly, we abort, the route 502s and never writes
  // status="cancelling" — so its own double-cancel guard never arms. The user retries,
  // we POST cancel again, Razorpay 400s because it is already cancelled, we throw, the
  // route 502s again. Forever. They are told to try again for a cancellation that
  // worked the first time, while the dashboard still shows them subscribed.
  //
  // But suppress ONLY the confirmed already-cancelled 400. A 400 for any other reason
  // (bad subscription id, a state Razorpay won't cancel from) means the cancel did NOT
  // happen — swallowing it marks the row `cancelling` while Razorpay keeps charging,
  // and the user sees "cancelling" forever while still being billed.
  // ponytail: text match on the description. Narrow to an error code if Razorpay ships
  // a stable one; today the description ("...already cancelled") is what we get.
  if (res.status === 400 && /already.*cancel/i.test(bodyText)) return;
  throw new Error(`Razorpay ${res.status}: ${bodyText}`);
}

export function verifyWebhook(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
