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

// Statuses that do NOT consume monthly quota.
//
// The rule: you are billed when the interview actually STARTS (live → processing →
// ready), not when it is granted. Unbilled:
//   requested — an admin never approved it
//   approved  — granted, but never taken (e.g. the agent worker was down, so the room
//               was silent and the candidate gave up; api/interviews/[id]/end hands it
//               back to `approved` when nobody spoke)
//   failed    — it broke on our side
//
// Without this, the gate counted every row created this month: a free user who
// requested three interviews an admin never approved had spent their whole month on
// nothing, and a scorer outage spent it for them.
//
// Anything unrecognised is BILLED — fail closed, so a new status can never quietly
// hand out free interviews.
//
// Enforcement (api/interviews) and the dashboard's "used this month" both read this,
// so the number the user sees is the number the gate applies.
export const UNBILLED_STATUSES = ["requested", "approved", "failed"] as const;

export function consumesQuota(status: string): boolean {
  return !(UNBILLED_STATUSES as readonly string[]).includes(status);
}
