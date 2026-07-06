import { describe, expect, it } from "vitest";
import {
  isUnlimited,
  monthStart,
  monthlyInterviewLimit,
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

  it("monthStart is midnight UTC on the 1st", () => {
    const s = monthStart(new Date("2026-07-15T13:45:00Z"));
    expect(s.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });
});
