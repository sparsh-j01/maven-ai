"use client";

import { useEffect, useState } from "react";

type Phase = "ask" | "answer" | "score" | "adapt";

const SCRIPT = {
  question:
    "Once you could reproduce the race, how did you decide between locking and versioning?",
  answer:
    "I versioned the row and retried on write conflict — optimistic, since contention was rare.",
  scores: [
    { label: "Communication", value: 9.2 },
    { label: "Depth", value: 8.7 },
    { label: "Confidence", value: 8.4 },
  ],
  followUp: "Why optimistic locking over a pessimistic lock under load?",
  tag: "Concurrency",
} as const;

const PHASES: { phase: Phase; ms: number }[] = [
  { phase: "ask", ms: 3400 },
  { phase: "answer", ms: 4200 },
  { phase: "score", ms: 2800 },
  { phase: "adapt", ms: 3600 },
];

const BARS = Array.from({ length: 18 }, (_, i) => (i * 63) % 540);

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

function usePrefersReducedMotion() {
  // SSR-safe: false on first paint (matches server), corrected on mount so
  // there's no hydration mismatch.
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function HeroInterview() {
  const reduced = usePrefersReducedMotion();
  const [i, setI] = useState(0);
  const phase = PHASES[i]!.phase;
  const [secs, setSecs] = useState(240);
  const [typed, setTyped] = useState("");
  const [scoreP, setScoreP] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(
      () => setI((n) => (n + 1) % PHASES.length),
      PHASES[i]!.ms,
    );
    return () => clearTimeout(t);
  }, [i, reduced]);

  useEffect(() => {
    if (reduced) return;
    const t = setInterval(
      () => setSecs((s) => (s >= 599 ? 240 : s + 1)),
      1000,
    );
    return () => clearInterval(t);
  }, [reduced]);

  useEffect(() => {
    if (reduced || phase !== "answer") {
      setTyped(reduced ? SCRIPT.answer : "");
      return;
    }
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      setTyped(SCRIPT.answer.slice(0, n));
      if (n >= SCRIPT.answer.length) clearInterval(t);
    }, 42);
    return () => clearInterval(t);
  }, [phase, reduced]);

  useEffect(() => {
    if (reduced || phase !== "score") {
      setScoreP(1);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 1100);
      setScoreP(easeOut(t));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase, reduced]);

  const asking = !reduced && phase === "ask";
  const answering = reduced || phase === "answer";
  const scoring = !reduced && phase === "score";
  const adapting = !reduced && phase === "adapt";

  const orbTone = scoring
    ? "--amber"
    : answering && !adapting
      ? "--teal"
      : asking || adapting
        ? "--accent"
        : "--teal";
  const waveActive = asking || adapting || (answering && !reduced);
  const waveTone = asking || adapting ? "text-accent" : "text-teal";
  const status = scoring
    ? "Scoring your answer…"
    : adapting
      ? "Follow-up selected"
      : asking
        ? "Interviewer speaking"
        : "Your turn";

  return (
    <figure
      className="glass relative rounded-card"
      aria-label="A Maven interview in progress"
    >
      <div className="flex items-center justify-between gap-3 border-b border-fg/10 px-5 py-3">
        <span className="flex items-center gap-2 font-display text-sm font-medium">
          <span className="h-2 w-2 rounded-full bg-teal" aria-hidden />
          Maven
          <span className="ml-1 rounded-full border border-fg/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted">
            Technical
          </span>
        </span>
        <span className="flex items-center gap-2 font-mono text-xs text-teal">
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal"
            aria-hidden
          />
          {fmt(secs)}
        </span>
      </div>

      <div className="border-b border-fg/10 px-6 pb-5 pt-5">
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Interviewer
          </span>
          {adapting ? (
            <span className="hero-pop rounded-full bg-accent/12 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-accent">
              Follow-up · {SCRIPT.tag}
            </span>
          ) : null}
        </span>
        <p
          key={adapting ? "followup" : "question"}
          className="hero-fade mt-1.5 font-serif text-lg leading-snug text-fg/90"
        >
          &ldquo;{adapting ? SCRIPT.followUp : SCRIPT.question}&rdquo;
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 px-6 pb-6 pt-7">
        <div className="relative h-20 w-20" aria-hidden>
          {/* ambient halo — breathing, tight falloff so it reads as light, not a smudge */}
          <div
            className="blob-breathe absolute inset-0 rounded-full transition-[background] duration-500"
            style={{
              background: `radial-gradient(circle at 50% 46%, rgb(var(${orbTone}) / 0.3), transparent 60%)`,
            }}
          />
          {/* concentric aperture rings give the orb structure */}
          <div
            className="absolute inset-[18%] rounded-full border transition-colors duration-500"
            style={{ borderColor: `rgb(var(${orbTone}) / 0.22)` }}
          />
          <div
            className="absolute inset-[29%] rounded-full border transition-colors duration-500"
            style={{ borderColor: `rgb(var(${orbTone}) / 0.4)` }}
          />
          {/* core sphere — top-left highlight + outer glow reads as a lit bead */}
          <div
            className="absolute inset-[38%] rounded-full transition-[background,box-shadow] duration-500"
            style={{
              background: `radial-gradient(circle at 35% 30%, rgb(255 255 255 / 0.85), rgb(var(${orbTone})) 60%)`,
              boxShadow: `0 0 22px rgb(var(${orbTone}) / 0.5), inset 0 1px 2px rgb(255 255 255 / 0.45)`,
            }}
          />
        </div>

        <div
          className={`flex h-7 items-center gap-[3px] ${waveTone}`}
          aria-hidden
        >
          {BARS.map((d, idx) => (
            <span
              key={idx}
              className="w-[3px] origin-center rounded-full bg-current transition-transform duration-300"
              style={
                waveActive
                  ? {
                      height: "100%",
                      animation: `hero-wave 900ms ${d}ms ease-in-out infinite`,
                    }
                  : { height: "100%", transform: "scaleY(0.2)" }
              }
            />
          ))}
        </div>

        <span
          className={`font-mono text-xs uppercase tracking-widest ${
            scoring ? "text-amber" : asking || adapting ? "text-accent" : "text-teal"
          }`}
        >
          {status}
        </span>

        <p className="min-h-[2.75rem] max-w-sm text-center font-serif text-sm leading-snug text-fg/70">
          {typed ? (
            <>
              <span className="font-mono text-[10px] uppercase tracking-widest text-teal">
                You&nbsp;
              </span>
              &ldquo;{typed}
              {answering && !reduced && typed.length < SCRIPT.answer.length ? (
                <span className="ml-px inline-block h-4 w-px animate-pulse bg-teal align-middle" />
              ) : (
                "”"
              )}
            </>
          ) : null}
        </p>
      </div>

      <div className="border-t border-fg/10 px-6 py-5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
          Analysis
        </span>
        <div className="mt-3 flex flex-col gap-2.5">
          {SCRIPT.scores.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs text-fg/70">{s.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/10">
                <span
                  className="block h-full rounded-full bg-teal transition-[width] duration-200"
                  style={{ width: `${(s.value / 10) * scoreP * 100}%` }}
                />
              </span>
              <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-fg">
                {(s.value * scoreP).toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-fg/10 px-6 py-4">
        <span
          className={`rounded-full px-4 py-2 font-mono text-xs transition-colors duration-300 ${
            answering && !reduced
              ? "bg-teal text-on-accent"
              : "bg-teal/15 text-teal"
          }`}
        >
          {answering && !reduced ? "Listening… release to send" : "Hold to talk · Space"}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
          Problem solving · 8/10
        </span>
      </div>
    </figure>
  );
}
