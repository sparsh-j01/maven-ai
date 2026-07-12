import { BarChart3, Mic, SlidersHorizontal } from "lucide-react";

const STEPS = [
  {
    id: "01",
    icon: SlidersHorizontal,
    title: "Pick a role",
    description:
      "Choose the role, seniority, and format. Add your résumé and the job description so questions target your actual background.",
  },
  {
    id: "02",
    icon: Mic,
    title: "Talk it through",
    description:
      "Push-to-talk with clean turns — no talking over each other. The interviewer asks adaptive follow-ups and runs a live coding round.",
  },
  {
    id: "03",
    icon: BarChart3,
    title: "Read your report",
    description:
      "Rubric scores per competency, strengths and gaps, model answers for weak spots, and the full replayable transcript.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mt-28 scroll-mt-10">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">
        How it works
      </p>
      <div
        data-reveal
        className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-hair pt-10"
      >
        <h2 className="max-w-md font-display text-3xl font-medium tracking-tight">
          Three steps. About ten minutes.
        </h2>
        <p className="max-w-xs text-sm leading-relaxed text-muted">
          No setup call, no scheduling. Start a session and start talking.
        </p>
      </div>

      <ol data-reveal-group className="mt-10 grid gap-5 md:grid-cols-3">
        {STEPS.map(({ id, icon: Icon, title, description }) => (
          <li key={id} className="glass flex flex-col gap-4 rounded-card p-7">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-accent">{id}</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-fg/10 bg-fg/5 text-teal">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
            </div>
            <h3 className="font-display text-xl font-semibold tracking-tight">
              {title}
            </h3>
            <p className="text-sm leading-relaxed text-fg/70">{description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
