// Pure geometry for the rubric radar chart (§6.3, §7.5). Kept here, tested, so a
// sign or clamp error can't silently distort the chart — the web component is
// then just SVG over these points.

export type Point = { x: number; y: number };

// Evenly spaced axes starting at 12 o'clock, going clockwise. Each value is
// clamped to [0, max] and scales its point's distance from the centre. Returns
// one point per value.
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

// Format points for an SVG <polygon>/<polyline> `points` attribute.
export function pointsToPath(points: Point[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}
