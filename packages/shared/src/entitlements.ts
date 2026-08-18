export type Plan = "free" | "pro";

// free gets a taste, pro is unlimited. Infinity so the `count >= limit` gate never trips for pro.
//
// pendingRequests is a different KIND of limit from monthlyInterviews and the two should
// not be read as a pair. monthlyInterviews is consumption — it resets on the 1st and is
// what the user is paying for. pendingRequests is queue depth: how many un-approved
// requests one account may leave sitting in the admin queue at once. It is not spent and
// it does not reset on a clock; approving a request is the only thing that frees a slot.
//
// So pro is NOT unlimited here even though it is unlimited on monthlyInterviews. The
// queue is an admin's attention, not a resource the user bought, and an unbounded queue
// depth would hand any single Pro account the ability to bury the approval page. Pro gets
// more room to line work up; it does not get to make the queue meaningless.
export const PLAN_LIMITS: Record<
  Plan,
  { monthlyInterviews: number; pendingRequests: number }
> = {
  free: { monthlyInterviews: 3, pendingRequests: 3 },
  pro: { monthlyInterviews: Infinity, pendingRequests: 10 },
};

export function isPlan(value: string): value is Plan {
  return value === "free" || value === "pro";
}

// Unknown/legacy plan strings fall back to the free limit — fail closed.
export function monthlyInterviewLimit(plan: string): number {
  return (isPlan(plan) ? PLAN_LIMITS[plan] : PLAN_LIMITS.free)
    .monthlyInterviews;
}

// Same fail-closed rule: an unrecognised plan gets the free ceiling, never the pro one.
export function pendingRequestLimit(plan: string): number {
  return (isPlan(plan) ? PLAN_LIMITS[plan] : PLAN_LIMITS.free).pendingRequests;
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
