import { describe, expect, it } from "vitest";
import {
  consumesQuota,
  isUnlimited,
  monthStart,
  monthlyInterviewLimit,
  pendingRequestLimit,
} from "./entitlements";

describe("entitlements", () => {
  it("returns the per-plan monthly limit", () => {
    expect(monthlyInterviewLimit("free")).toBe(3);
    expect(monthlyInterviewLimit("pro")).toBe(Infinity);
  });

  it("fails closed on an unknown plan", () => {
    expect(monthlyInterviewLimit("enterprise")).toBe(3);
    expect(monthlyInterviewLimit("")).toBe(3);
  });

  it("treats only pro as unlimited", () => {
    expect(isUnlimited("pro")).toBe(true);
    expect(isUnlimited("free")).toBe(false);
    expect(isUnlimited("enterprise")).toBe(false);
  });

  it("gives pro a bigger pending-request ceiling than free", () => {
    expect(pendingRequestLimit("free")).toBe(3);
    expect(pendingRequestLimit("pro")).toBe(10);
  });

  it("fails closed to the free ceiling on an unknown plan", () => {
    expect(pendingRequestLimit("enterprise")).toBe(3);
    expect(pendingRequestLimit("")).toBe(3);
  });

  // Queue depth is admin attention, not a resource the user bought — so unlike the
  // monthly quota, pro must stay FINITE here. Infinity would let one Pro account bury
  // the approval page, and the `count >= limit` gate would never trip to stop it.
  it("keeps the pending ceiling finite on every plan, including pro", () => {
    expect(Number.isFinite(pendingRequestLimit("pro"))).toBe(true);
    expect(Number.isFinite(pendingRequestLimit("free"))).toBe(true);
  });

  it("monthStart is midnight UTC on the 1st", () => {
    const s = monthStart(new Date("2026-07-15T13:45:00Z"));
    expect(s.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });
});

describe("consumesQuota", () => {
  // The bug this encodes: the gate used to count EVERY row created this month, so a
  // free user who requested three interviews an admin never approved had spent their
  // whole month on nothing — and a scorer outage spent it for them.
  it("does not charge for an interview we never approved", () => {
    expect(consumesQuota("requested")).toBe(false);
  });

  // Granted but never taken. The agent worker being down must not cost the candidate
  // a slot: /end hands a silent room back to `approved`.
  it("does not charge for an approved interview that was never taken", () => {
    expect(consumesQuota("approved")).toBe(false);
  });

  it("does not charge for an interview that failed on our side", () => {
    expect(consumesQuota("failed")).toBe(false);
  });

  it("charges once the interview actually starts", () => {
    expect(consumesQuota("live")).toBe(true);
    expect(consumesQuota("processing")).toBe(true);
    expect(consumesQuota("ready")).toBe(true);
  });

  // Fail closed: an unrecognised status charges, so a new status can never
  // accidentally hand out free interviews.
  it("charges for an unknown status", () => {
    expect(consumesQuota("some_new_status")).toBe(true);
  });
});
