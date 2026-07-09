import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import {
  REGION_PRICING,
  isCycle,
  regionForCountry,
} from "@maven-ai/shared";
import { Check, ChevronDown } from "lucide-react";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { HeroInterview } from "@/components/hero-interview";
import { HowItWorks } from "@/components/how-it-works";
import { PrefToggle } from "@/components/pref-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { PricingGlass } from "@/components/ui/pricing-glass";

const STEPS = [
  {
    n: "01",
    title: "Pick a role",
    body: "Choose the role, seniority, and format. Add your resume and the job description so questions target your actual background.",
  },
  {
    n: "02",
    title: "Talk for ten minutes",
    body: "Push-to-talk with clean turns, no talking over each other. The interviewer asks adaptive follow-ups and runs a live coding round.",
  },
  {
    n: "03",
    title: "Read your report",
    body: "Rubric scores per competency, strengths and gaps, model answers for weak spots, and the full replayable transcript.",
  },
] as const;

const PLANS = [
  {
    name: "Free",
    priceMonthly: "0",
    priceAnnual: "0",
    description: "Get a real sense of it.",
    isPopular: false,
    inherits: null,
    features: [
      "3 interviews per month",
      "Résumé, JD & company tailoring",
      "Adaptive voice interviewer",
      "Live coding round",
      "Rubric report + readiness score",
    ],
  },
  {
    name: "Pro",
    priceMonthly: "19",
    priceAnnual: "15",
    description: "For an all-out prep stretch.",
    isPopular: true,
    inherits: "Free",
    features: [
      "Unlimited interviews — no monthly cap",
      "AI coach: a personalized study plan",
      "Model answers for every weak spot",
      "Full transcript & report history",
    ],
  },
  {
    name: "University",
    priceMonthly: "Contact",
    priceAnnual: "Contact",
    description: "For universities, bootcamps & placement cells.",
    isPopular: false,
    inherits: "Pro",
    features: [
      "Cohort seats & central billing",
      "Placement-cell progress dashboard",
      "Onboarding & training",
    ],
  },
] as const;

const HERO_FEATURES = [
  { title: "Adaptive follow-ups", blurb: "Digs deeper based on your answer" },
  { title: "Live coding", blurb: "Solve real problems while you talk" },
  { title: "System design", blurb: "Whiteboard architecture out loud" },
  { title: "Readiness score", blurb: "A 0–100 read on how ready you are" },
] as const;

const FAQS = [
  {
    q: "Is this actually voice, or just another AI chatbot?",
    a: "It's a real voice interview. Speak naturally using your microphone, and Maven responds with low-latency voice. It manages turn-taking automatically, asks follow-up questions based on your answers, and feels much closer to a real technical screen than a text chat.",
  },
  {
    q: "How realistic are the interviews?",
    a: "Maven doesn't read from a fixed script. It adapts to your responses, asks deeper follow-up questions, changes difficulty as the interview progresses, and can challenge weak or incomplete answers—just like an experienced interviewer would.",
  },
  {
    q: "Can I upload my résumé and the job description?",
    a: "Yes. Upload your résumé or paste a job description, and Maven tailors the interview to your background, projects, skills, and target role. Personalized interviews are included on every plan.",
  },
  {
    q: "What interview roles and formats are supported?",
    a: "Practice Frontend, Backend, Full-stack, AI/ML, System Design, and Behavioral interviews—from Intern through Senior Engineer (SDE III). You can also choose a target company to better match its interview style and difficulty.",
  },
  {
    q: "Does Maven include live coding?",
    a: "Yes. Technical interviews can include live coding challenges where you solve problems while continuing the conversation over voice. The interviewer can ask clarifying questions, provide follow-ups, and evaluate both your solution and your thought process.",
  },
  {
    q: "How long does an interview take?",
    a: "Most interviews take 10–15 minutes, including a warm-up, technical questions, adaptive follow-ups, a coding round (if selected), and a wrap-up. You can also create shorter practice sessions for focused preparation.",
  },
  {
    q: "How am I scored?",
    a: "Every interview ends with a detailed report that evaluates communication, technical knowledge, problem solving, reasoning, and confidence. You'll receive rubric-based scores, actionable feedback, strengths, weak areas, and—on Pro—model answers for improvement.",
  },
  {
    q: "Can I replay my interviews?",
    a: "Yes. Every interview includes a replayable transcript so you can review exactly how you answered each question. Pro users also get unlimited interview history to track progress over time.",
  },
  {
    q: "How is Maven different from ChatGPT Voice?",
    a: "ChatGPT Voice is a general assistant—helpful, but it won't run an interview. Maven is built for one job: it drives a structured session with a phased plan, adapts difficulty as you go, challenges weak answers, runs a live coding round, and ends with a rubric-scored report on where you stand. You're not prompting a chatbot—you're being interviewed.",
  },
  {
    q: "What's included in the Free plan?",
    a: "The Free plan includes 3 complete interviews every month, including résumé tailoring, adaptive questioning, live coding, and scoring. Pro removes interview limits and adds unlimited history, model answers, and premium feedback features.",
  },
] as const;

const cta = buttonVariants({ variant: "accent", size: "lg" });
const navCta = buttonVariants({ variant: "accent", size: "sm" });
// Nav links rest at 60% of the foreground and brighten to full on hover —
// same colour, not a hue shift, which is what reads as premium.
const navLink =
  "rounded text-sm text-fg/60 transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
const navCenterLink =
  "rounded-full px-3.5 py-1.5 text-sm font-medium text-fg/60 transition-colors hover:bg-fg/5 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

function Wordmark({ size = "text-xl" }: { size?: string }) {
  return (
    <span className={`font-display font-bold ${size}`}>Maven</span>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-widest text-muted">
        {title}
      </p>
      <ul className="mt-4 flex flex-col gap-2.5 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              className="text-fg/70 transition-colors hover:text-fg"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Inline brand marks — lucide dropped brand icons, so keep the paths here to
// avoid a dependency for three glyphs. Update the hrefs with real handles.
const SOCIALS = [
  {
    label: "GitHub",
    href: "https://github.com/sparsh-j01",
    d: "M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.12-.3-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.56 22.29 24 17.8 24 12.5 24 5.87 18.63.5 12 .5Z",
  },
  {
    label: "X",
    href: "https://x.com",
    d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z",
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com",
    d: "M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14Zm1.78 13.02H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z",
  },
] as const;

function SocialLinks() {
  return (
    <div className="flex items-center gap-3">
      {SOCIALS.map((s) => (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={s.label}
          className="text-muted transition-colors hover:text-fg"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
            <path d={s.d} />
          </svg>
        </a>
      ))}
    </div>
  );
}


export default async function LandingPage() {
  // Region-aware pricing from geo only: IN → ₹, else $. No manual currency switch.
  const jar = await cookies();
  const country = (await headers()).get("x-vercel-ip-country");
  const region = regionForCountry(country);
  const pricing = REGION_PRICING[region];
  const cycleRaw = jar.get("pref_cycle")?.value;
  const cycle = cycleRaw && isCycle(cycleRaw) ? cycleRaw : "monthly";

  return (
    <div className="min-h-screen text-fg">
      <main className="mx-auto max-w-6xl px-6 pb-20">
        <header className="sticky top-3 z-50 mt-3">
          <nav className="glass grid transform-gpu grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-full px-4 py-2.5 sm:px-5">
            <Link
              href="/"
              className="flex w-fit items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Wordmark size="text-2xl" />
            </Link>

            <div className="hidden items-center gap-1 md:flex">
              <a href="#how" className={navCenterLink}>
                How it works
              </a>
              <a href="#pricing" className={navCenterLink}>
                Pricing
              </a>
              <a href="#faq" className={navCenterLink}>
                FAQ
              </a>
            </div>

            <div className="flex items-center justify-end gap-2 sm:gap-3">
              <SignedOut>
                <SignInButton mode="modal">
                  <button className={`hidden sm:inline-flex ${navLink}`}>
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className={navCta}>Start for free</button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <Link
                  href="/dashboard"
                  className={`hidden sm:inline-flex ${navLink}`}
                >
                  Dashboard
                </Link>
                <Link href="/interview/new" className={navCta}>
                  New interview
                </Link>
              </SignedIn>
              <ThemeToggle />
            </div>
          </nav>
        </header>

        <section className="grid items-center gap-14 pt-8 lg:grid-cols-[1.05fr_1fr] lg:items-start lg:pt-12">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted">
              Real-time voice mock interviews
            </p>
            <h1 className="mt-5 font-display text-[clamp(2.75rem,6.5vw,4.75rem)] font-semibold leading-[1.04] tracking-tight">
              Practice interviews that{" "}
              <em className="text-accent">feel&nbsp;real.</em>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-fg/70">
              An AI interviewer that digs into your reasoning instead of reading
              from a script — then scores how you think in a report you can
              replay.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-6">
              <SignedOut>
                <SignUpButton mode="modal">
                  <button className={cta}>Start a free interview</button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <Link href="/interview/new" className={cta}>
                  Start a new interview
                </Link>
              </SignedIn>
              <a
                href="#how"
                className="text-sm text-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
              >
                See how it works
              </a>
            </div>
            {/* Credibility under the CTA — honest reassurance, no fabricated
                stats or logos while the app isn't live yet. */}
            <p className="mt-5 flex items-center gap-2 text-sm text-muted">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal"
                aria-hidden
              />
              Built for FAANG &amp; MANGOS-style interviews
            </p>
            {/* Tiny glass cards, not a bullet list — each sells the benefit,
                not just names the feature. */}
            <ul className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {HERO_FEATURES.map((f, i) => (
                <li
                  key={f.title}
                  className={`glass rounded-card px-3.5 py-2.5 ${
                    i === HERO_FEATURES.length - 1 &&
                    HERO_FEATURES.length % 2 === 1
                      ? "sm:col-span-2"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 shrink-0 text-teal" aria-hidden />
                    <span className="text-sm font-medium">{f.title}</span>
                  </div>
                  <p className="mt-0.5 pl-[22px] text-xs leading-snug text-muted">
                    {f.blurb}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <HeroInterview />
        </section>

        <HowItWorks />

        <section id="pricing" className="mt-28 scroll-mt-10">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            Pricing
          </p>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-fg/10 pt-10">
            <h2 className="max-w-md font-display text-3xl font-medium tracking-tight">
              Start free. Go Pro when three a month isn&apos;t enough.
            </h2>
            <p className="max-w-xs text-sm leading-relaxed text-muted">
              No seat minimums, no annual lock-in. Cancel whenever you&apos;re
              done prepping.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <PrefToggle
              cookie="pref_cycle"
              current={cycle}
              options={[
                { value: "monthly", label: "Monthly" },
                { value: "annual", label: "Annual" },
              ]}
            />
          </div>

          <div className="mt-10">
            <PricingGlass
              tiers={PLANS.map((plan) => {
                // Prices are pre-formatted with the region symbol; Free/University stay words.
                const price =
                  plan.name === "Free"
                    ? "Free"
                    : plan.name === "Pro"
                      ? cycle === "annual"
                        ? pricing.annual.perMonthDisplay
                        : pricing.monthly.display
                      : "Contact";
                const originalPrice =
                  plan.name === "Pro" && cycle === "annual"
                    ? pricing.monthly.display
                    : undefined;
                const discountPct =
                  plan.name === "Pro" && cycle === "annual"
                    ? pricing.annual.savingsPct
                    : undefined;
                return {
                  name: plan.name,
                  priceMonthly: price,
                  priceAnnual: price,
                  description: plan.description,
                  features: [...plan.features],
                  isPopular: plan.isPopular,
                  inherits: plan.inherits ?? undefined,
                  originalPrice,
                  discountPct,
                };
              })}
              isAnnual={cycle === "annual"}
            />
          </div>
        </section>

        <section id="faq" className="mt-28 scroll-mt-10">
          <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-center text-lg leading-relaxed text-muted">
            Quick answers about the interview, the scoring, and your data —
            everything worth knowing before your first session.
          </p>

          {/* Exclusive accordion: a shared `name` closes other open items — native, no JS. */}
          <div className="glass mx-auto mt-10 max-w-3xl rounded-card px-6 py-2 sm:px-8">
            {FAQS.map((f) => (
              <details
                key={f.q}
                name="faq"
                className="group border-b border-dotted border-fg/15 last:border-b-0"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-base font-medium tracking-tight transition-colors hover:text-accent [&::-webkit-details-marker]:hidden">
                  <span>{f.q}</span>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-muted transition-transform duration-300 group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="pb-4 text-base leading-relaxed text-muted">
                  {f.a}
                </p>
              </details>
            ))}
          </div>

          <p className="mt-6 text-center text-muted">
            Can&apos;t find what you&apos;re looking for? Contact our{" "}
            <a
              href="mailto:hello@maven.ai"
              className="font-medium text-accent hover:underline"
            >
              support team
            </a>
            .
          </p>
        </section>

        {/* Final CTA — the last thing users see before the footer. */}
        <section className="mt-28">
          <div className="glass rounded-card px-6 py-16 text-center sm:py-20">
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready for your next interview?
            </h2>
            <p className="mt-3 text-lg text-muted">Practice with AI today.</p>
            <div className="mt-8 flex justify-center">
              <SignedOut>
                <SignUpButton mode="modal">
                  <button className={cta}>Start Free</button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <Link href="/interview/new" className={cta}>
                  Start Free
                </Link>
              </SignedIn>
            </div>
          </div>
        </section>

        <footer className="mt-28 border-t border-fg/10 pt-12">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
            <div>
              <Wordmark />
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
                Practice real interview conversations with an AI interviewer. Get
                instant feedback, a replayable transcript, and a rubric-scored
                report.
              </p>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-muted">
                Made in India • for candidates everywhere
              </p>
            </div>
            <FooterCol
              title="Product"
              links={[
                { label: "How it works", href: "#how" },
                { label: "Pricing", href: "#pricing" },
                { label: "FAQ", href: "#faq" },
                { label: "Start Free", href: "/interview/new" },
              ]}
            />
            <FooterCol
              title="Support"
              links={[
                { label: "Contact", href: "mailto:hello@maven.ai" },
                { label: "Security", href: "/security" },
                {
                  label: "Feedback",
                  href: "mailto:hello@maven.ai?subject=Feedback",
                },
              ]}
            />
            <FooterCol
              title="Legal"
              links={[
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Terms of Service", href: "/terms" },
                { label: "Delete Account", href: "/delete-account" },
              ]}
            />
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-fg/10 py-6">
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted">
              © 2026 Maven. All rights reserved.
            </span>
            <div className="flex items-center gap-5">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted">
                Private by default • Never sold
              </span>
              <SocialLinks />
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
