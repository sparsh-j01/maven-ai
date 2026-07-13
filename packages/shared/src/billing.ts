// Regional + annual pricing. Single gateway for now: Razorpay (test mode). India
// is billed in ₹; INTL still sees a $ display price but is charged via the ₹ plan
// until Razorpay International (or a global gateway) is wired. One source of truth
// so the pricing UI and the checkout route can't drift.

export type Region = "IN" | "INTL";
export type Gateway = "razorpay";
export type BillingCycle = "monthly" | "annual";

export const REGION_PRICING: Record<
  Region,
  {
    gateway: Gateway;
    currency: string;
    symbol: string;
    monthly: { perMonth: number; display: string };
    annual: {
      perMonth: number;
      perMonthDisplay: string;
      total: number;
      totalDisplay: string;
      savingsPct: number;
    };
  }
> = {
  IN: {
    gateway: "razorpay",
    currency: "INR",
    symbol: "₹",
    monthly: { perMonth: 799, display: "₹799" },
    annual: {
      perMonth: 599,
      perMonthDisplay: "₹599",
      total: 7188,
      totalDisplay: "₹7,188",
      savingsPct: 25,
    },
  },
  INTL: {
    gateway: "razorpay",
    currency: "USD",
    symbol: "$",
    monthly: { perMonth: 19, display: "$19" },
    annual: {
      perMonth: 15,
      perMonthDisplay: "$15",
      total: 180,
      totalDisplay: "$180",
      savingsPct: 21,
    },
  },
};

export function regionForCountry(country?: string | null): Region {
  return (country ?? "").toUpperCase() === "IN" ? "IN" : "INTL";
}

export function isCycle(v: string): v is BillingCycle {
  return v === "monthly" || v === "annual";
}
