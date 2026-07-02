import { describe, expect, it } from "vitest";
import { monthStart, monthlyInterviewLimit } from "./entitlements";

describe("entitlements", () => {
  it("returns the per-plan monthly limit", () => {
    expect(monthlyInterviewLimit("free")).toBe(5);
    expect(monthlyInterviewLimit("pro")).toBe(200);
  });

  it("fails closed on an unknown plan", () => {
    expect(monthlyInterviewLimit("enterprise")).toBe(5);
    expect(monthlyInterviewLimit("")).toBe(5);
  });

  it("monthStart is midnight UTC on the 1st", () => {
    const s = monthStart(new Date("2026-07-15T13:45:00Z"));
    expect(s.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });
});
