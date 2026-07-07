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

// userId rides in `notes` so the webhook can map the payment back to a user.
export async function createProSubscription(
  userId: string,
  planId: string,
  totalCount: number,
  email?: string,
): Promise<string> {
  const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
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
