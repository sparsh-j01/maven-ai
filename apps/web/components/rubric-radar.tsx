import {
  pointsToPath,
  radarPoints,
  RUBRIC_DIMENSIONS,
  type RubricScores,
} from "@maven-ai/shared";

// Hand-rolled SVG over shared/radar geometry — no chart dep; pure render (server component).

const SIZE = 280;
const C = SIZE / 2;
const R = 82;
const MAX = 10;
const RINGS = [0.25, 0.5, 0.75, 1];

const LABELS: Record<string, string> = {
  communication: "Communication",
  problem_solving: "Problem solving",
  technical_depth: "Technical depth",
  code_quality: "Code quality",
  culture_fit: "Culture fit",
};

const ring = (frac: number) =>
  radarPoints(RUBRIC_DIMENSIONS.map(() => MAX * frac), {
    radius: R,
    cx: C,
    cy: C,
    max: MAX,
  });

export function RubricRadar({ scores }: { scores: RubricScores }) {
  const values = RUBRIC_DIMENSIONS.map((d) => scores[d] ?? 0);
  const axisEnds = ring(1);
  const dataPts = radarPoints(values, { radius: R, cx: C, cy: C, max: MAX });
  const labelPts = radarPoints(RUBRIC_DIMENSIONS.map(() => MAX), {
    radius: R + 16,
    cx: C,
    cy: C,
    max: MAX,
  });

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="h-auto w-full max-w-[280px]"
      role="img"
      aria-label="Rubric scores radar chart"
    >
      {RINGS.map((f) => (
        <polygon
          key={f}
          points={pointsToPath(ring(f))}
          fill="none"
          className="stroke-fg/10"
          strokeWidth={1}
        />
      ))}
      {axisEnds.map((p, i) => (
        <line
          key={i}
          x1={C}
          y1={C}
          x2={p.x}
          y2={p.y}
          className="stroke-fg/10"
          strokeWidth={1}
        />
      ))}
      <polygon
        points={pointsToPath(dataPts)}
        className="fill-teal/20 stroke-teal"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {dataPts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} className="fill-teal" />
      ))}
      {labelPts.map((p, i) => {
        const anchor =
          Math.abs(p.x - C) < 6 ? "middle" : p.x > C ? "start" : "end";
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="fill-fg/70 text-[9px] font-medium"
          >
            {LABELS[RUBRIC_DIMENSIONS[i]!] ?? RUBRIC_DIMENSIONS[i]}
          </text>
        );
      })}
    </svg>
  );
}
