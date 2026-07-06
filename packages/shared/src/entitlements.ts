export type Plan = "free" | "pro";

// free gets a taste, pro is unlimited. Infinity so the `count >= limit` gate never trips for pro.
export const PLAN_LIMITS: Record<Plan, { monthlyInterviews: number }> = {
  free: { monthlyInterviews: 3 },
  pro: { monthlyInterviews: Infinity },
};

export function isPlan(value: string): value is Plan {
  return value === "free" || value === "pro";
}

// Unknown/legacy plan strings fall back to the free limit — fail closed.
export function monthlyInterviewLimit(plan: string): number {
  return (isPlan(plan) ? PLAN_LIMITS[plan] : PLAN_LIMITS.free)
    .monthlyInterviews;
}

export function isUnlimited(plan: string): boolean {
  return !Number.isFinite(monthlyInterviewLimit(plan));
}

export function monthStart(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}
