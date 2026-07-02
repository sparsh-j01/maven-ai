// Plan entitlements (milestone 8). The monthly interview quota is the paid
// boundary: free users get a taste, pro unlocks the real volume. Kept here —
// pure and tested — so the API gate and the billing/upgrade UI read the same
// numbers and can't drift.

export type Plan = "free" | "pro";

export const PLAN_LIMITS: Record<Plan, { monthlyInterviews: number }> = {
  free: { monthlyInterviews: 5 },
  // Bounded, not infinite: a generous cap still stops a compromised pro account
  // from running unbounded metered spend.
  pro: { monthlyInterviews: 200 },
};

export function isPlan(value: string): value is Plan {
  return value === "free" || value === "pro";
}

// Unknown/legacy plan strings fall back to the free limit — fail closed.
export function monthlyInterviewLimit(plan: string): number {
  return (isPlan(plan) ? PLAN_LIMITS[plan] : PLAN_LIMITS.free)
    .monthlyInterviews;
}

// Start of the current UTC calendar month — the window interviews are counted
// against for the quota.
export function monthStart(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}
