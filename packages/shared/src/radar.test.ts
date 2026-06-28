import { describe, expect, it } from "vitest";
import { pointsToPath, radarPoints } from "./radar";

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

describe("radarPoints", () => {
  it("puts a full-value first axis straight up from the centre", () => {
    const [p] = radarPoints([10], { radius: 100, cx: 50, cy: 50, max: 10 });
    expect(near(p!.x, 50)).toBe(true);
    expect(near(p!.y, -50)).toBe(true); // up = smaller y
  });

  it("places four max axes at top / right / bottom / left", () => {
    const [top, right, bottom, left] = radarPoints([10, 10, 10, 10], {
      radius: 100,
      cx: 0,
      cy: 0,
      max: 10,
    });
    expect([near(top!.x, 0), near(top!.y, -100)]).toEqual([true, true]);
    expect([near(right!.x, 100), near(right!.y, 0)]).toEqual([true, true]);
    expect([near(bottom!.x, 0), near(bottom!.y, 100)]).toEqual([true, true]);
    expect([near(left!.x, -100), near(left!.y, 0)]).toEqual([true, true]);
  });

  it("scales by value and clamps out-of-range values", () => {
    const o = { radius: 100, cx: 0, cy: 0, max: 10 };
    expect(near(radarPoints([5], o)[0]!.y, -50)).toBe(true); // half radius
    expect(near(radarPoints([0], o)[0]!.y, 0)).toBe(true); // at centre
    expect(near(radarPoints([99], o)[0]!.y, -100)).toBe(true); // clamped to max
    expect(near(radarPoints([-5], o)[0]!.y, 0)).toBe(true); // clamped to 0
  });
});

describe("pointsToPath", () => {
  it("formats x,y pairs space-separated", () => {
    expect(pointsToPath([{ x: 1, y: 2 }, { x: 3.456, y: 4 }])).toBe(
      "1.00,2.00 3.46,4.00",
    );
  });
});
