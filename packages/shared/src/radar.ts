// Pure geometry for the rubric radar chart — kept here and tested.

export type Point = { x: number; y: number };

// Evenly spaced axes from 12 o'clock clockwise; each value clamped to [0, max].
export function radarPoints(
  values: number[],
  opts: { radius: number; cx: number; cy: number; max: number },
): Point[] {
  const { radius, cx, cy, max } = opts;
  const n = values.length;
  return values.map((v, i) => {
    const frac = max > 0 ? Math.min(Math.max(v, 0), max) / max : 0;
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n; // i=0 at the top
    return {
      x: cx + radius * frac * Math.cos(angle),
      y: cy + radius * frac * Math.sin(angle),
    };
  });
}

export function pointsToPath(points: Point[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}
