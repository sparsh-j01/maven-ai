"use client";

import { SignedIn, SignedOut, SignUpButton } from "@clerk/nextjs";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { useRef } from "react";
import { buttonVariants } from "@/components/ui/button";

gsap.registerPlugin(useGSAP, ScrollTrigger);

// The editorial hero: an asymmetric masthead layout whose right column is a
// "case file" — a typeset transcript excerpt that resolves into an auto-graded
// assessment. Motion is a single orchestrated page-load moment (GSAP), gated
// behind prefers-reduced-motion via gsap.matchMedia.
const RUBRIC = [
  { label: "Communication", w: "82%", v: "8.2" },
  { label: "Technical depth", w: "66%", v: "6.6" },
  { label: "Problem solving", w: "74%", v: "7.4" },
] as const;

export function HeroDesk() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Hide start states here (not in CSS) so reduced-motion users see the
        // finished layout with no flash.
        gsap.set(".hd-line > span", { yPercent: 115 });
        gsap.set(".hd-rule", { scaleX: 0, transformOrigin: "left" });
        gsap.set([".hd-lede", ".hd-cta", ".hd-byline"], { opacity: 0, y: 14 });
        gsap.set(".hd-file", { opacity: 0, y: 16 });
        gsap.set(".hd-bar", { width: 0 });
        gsap.set(".hd-stamp", { opacity: 0, scale: 1.6, rotate: -9 });
        gsap.set(".hd-underline", { scaleX: 0, transformOrigin: "left" });
        // Score starts at 0 for the count-up (its rendered default is the final
        // value, so reduced-motion users see 74 with no animation).
        const scoreStart = root.current?.querySelector<HTMLElement>("[data-score]");
        if (scoreStart) scoreStart.textContent = "0";

        const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
        tl.to(".hd-rule", { scaleX: 1, duration: 0.6, ease: "power2.out" })
          .to(".hd-line > span", { yPercent: 0, duration: 0.95, stagger: 0.09 }, "-=0.35")
          .to(".hd-underline", { scaleX: 1, duration: 0.5, ease: "power2.out" }, "-=0.15")
          .to(".hd-lede", { opacity: 1, y: 0, duration: 0.7 }, "-=0.55")
          .to(".hd-cta", { opacity: 1, y: 0, duration: 0.7 }, "-=0.55")
          .to(".hd-byline", { opacity: 1, y: 0, duration: 0.6 }, "-=0.5")
          .to(".hd-file", { opacity: 1, y: 0, duration: 0.85 }, "-=0.75");

        // Score count-up + rubric bars, timed to the file settling in.
        const scoreEl = root.current?.querySelector<HTMLElement>("[data-score]");
        const counter = { v: 0 };
        tl.to(
          counter,
          {
            v: 74,
            duration: 1.1,
            ease: "power2.out",
            onUpdate: () => {
              if (scoreEl) scoreEl.textContent = String(Math.round(counter.v));
            },
          },
          "-=0.3",
        );
        RUBRIC.forEach((r, i) => {
          tl.to(`.hd-bar[data-i="${i}"]`, { width: r.w, duration: 0.9, ease: "power2.out" }, "-=0.85");
        });
        tl.to(".hd-stamp", { opacity: 1, scale: 1, rotate: -2, duration: 0.5, ease: "back.out(1.7)" }, "-=0.7");

        // Subtle parallax: the case file drifts as you scroll through the hero.
        gsap.to(".hd-file", {
          yPercent: -7,
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });

        // Magnetic pull on the primary CTA (listeners cleaned up on revert).
        const cleanups: Array<() => void> = [];
        gsap.utils.toArray<HTMLElement>(".hd-magnetic").forEach((el) => {
          const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" });
          const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3" });
          const move = (e: MouseEvent) => {
            const r = el.getBoundingClientRect();
            xTo((e.clientX - (r.left + r.width / 2)) * 0.3);
            yTo((e.clientY - (r.top + r.height / 2)) * 0.3);
          };
          const leave = () => {
            xTo(0);
            yTo(0);
          };
          el.addEventListener("mousemove", move);
          el.addEventListener("mouseleave", leave);
          cleanups.push(() => {
            el.removeEventListener("mousemove", move);
            el.removeEventListener("mouseleave", leave);
          });
        });
        return () => cleanups.forEach((fn) => fn());
      });
    },
    { scope: root },
  );

  return (
    <section className="-mx-6 border-b border-hair px-6">
      <div
        ref={root}
        className="grid grid-cols-1 items-start gap-14 py-16 lg:grid-cols-[1.1fr_0.9fr]"
      >
        {/* ---- left: the thesis ---- */}
        <div>
          <p className="mb-6 flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            <span className="hd-rule h-px w-9 bg-accent" />
            Real-time voice interviews
          </p>
          <h1 className="font-display text-[clamp(2.75rem,6.4vw,5rem)] font-normal leading-[1.0] tracking-[-0.015em]">
            <span className="mask-line block"><span className="hd-line block"><span className="block">Sit the interview</span></span></span>
            <span className="mask-line block"><span className="hd-line block"><span className="block"><em className="relative italic text-accent">before<span className="hd-underline absolute -bottom-0.5 left-0 h-px w-full bg-accent" /></em> the</span></span></span>
            <span className="mask-line block"><span className="hd-line block"><span className="block">interview.</span></span></span>
          </h1>
          <p className="hd-lede mt-7 max-w-[34ch] text-lg leading-relaxed text-muted">
            A voice interviewer that digs into your reasoning instead of reading
            from a script — then hands you{" "}
            <b className="font-semibold text-fg">a scored report you can replay,
            line by line.</b>
          </p>
          <div className="hd-cta mt-8 flex flex-wrap items-center gap-6">
            <SignedOut>
              <SignUpButton mode="modal">
                <button className={`hd-magnetic ${buttonVariants({ variant: "accent", size: "lg" })}`}>
                  Start a free interview
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link
                href="/interview/new"
                className={`hd-magnetic ${buttonVariants({ variant: "accent", size: "lg" })}`}
              >
                Start a new interview
              </Link>
            </SignedIn>
            <a href="#how" className="group text-sm text-fg">
              Read how it works{" "}
              <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
            </a>
          </div>
          <p className="hd-byline mt-9 flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Built for FAANG &amp; MANGO-style technical screens
          </p>
        </div>

        {/* ---- right: the case file ---- */}
        <figure className="hd-file m-0 flex flex-col border border-fg bg-panel">
          <figcaption className="flex items-center justify-between border-b border-hair px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-fg/45">
            <span>Transcript · excerpt</span>
            <span>Backend · SDE II</span>
          </figcaption>
          <div className="relative px-6 pb-5 pt-6">
            <span className="absolute right-4 top-3 font-mono text-[10px] uppercase tracking-[0.14em] text-fg/40">fol. 7</span>
            <div className="mb-4 grid grid-cols-[24px_1fr] gap-3">
              <div className="pt-1.5 text-right font-mono text-[10px] text-fg/40">14</div>
              <div>
                <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.13em] text-muted">Interviewer</span>
                <p className="font-serif text-[17px] leading-[1.42]">
                  You put a cache in front of that read. What breaks first when the
                  cache and the database disagree?
                </p>
              </div>
            </div>
            <div className="grid grid-cols-[24px_1fr] gap-3">
              <div className="pt-1.5 text-right font-mono text-[10px] text-fg/40">15</div>
              <div>
                <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.13em] text-accent">You</span>
                <p className="font-serif text-[17px] leading-[1.42]">
                  Stale reads — a write lands in the DB but the cache still serves
                  the old value until it expires…
                </p>
              </div>
            </div>
          </div>
          <div className="mx-6 flex gap-2.5 border-t border-dashed border-hair pb-5 pt-3 text-[12.5px] leading-relaxed text-muted">
            <span className="hd-stamp inline-flex h-fit items-center whitespace-nowrap border border-accent px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-accent">
              graded
            </span>
            <span>
              Names the failure but not the fix — flagged as{" "}
              <b className="font-semibold text-fg">cache invalidation</b>, with a
              model answer drafted.
            </span>
          </div>

          <div className="mt-auto border-t border-fg bg-ground px-6 pb-6 pt-5">
            <div className="mb-4 flex justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-fg/45">
              <span>Assessment</span>
              <span>Auto-graded · 6 axes</span>
            </div>
            <div className="mb-5 flex items-end justify-between">
              <div className="flex items-baseline gap-1 font-display leading-[0.9] tracking-[-0.02em]">
                <span data-score className="text-[56px]">74</span>
                <span className="text-[15px] text-muted">/100</span>
              </div>
              <div className="text-right font-mono text-[11px] uppercase leading-[1.7] tracking-[0.1em] text-fg/45">
                Readiness
                <br />
                <b className="font-serif text-[17px] normal-case tracking-normal text-accent">
                  Nearly there
                </b>
              </div>
            </div>
            <ul className="flex flex-col gap-3">
              {RUBRIC.map((r, i) => (
                <li key={r.label} className="grid grid-cols-[112px_1fr_32px] items-center gap-3 text-[12px]">
                  <span className="text-muted">{r.label}</span>
                  <span className="relative h-[3px] overflow-hidden bg-hair">
                    <span
                      data-i={i}
                      style={{ width: r.w }}
                      className="hd-bar absolute inset-y-0 left-0 bg-accent"
                    />
                  </span>
                  <span className="text-right font-mono text-[11px] tabular-nums text-fg">{r.v}</span>
                </li>
              ))}
            </ul>
          </div>
        </figure>
      </div>
    </section>
  );
}
