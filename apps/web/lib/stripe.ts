import Stripe from "stripe";

// Lazy singleton so importing this module never throws at build time when the
// key is absent (CI, preview) — it only fails when billing is actually used.
let client: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return (client ??= new Stripe(key));
}
