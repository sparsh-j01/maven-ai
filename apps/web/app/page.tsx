import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// §7.1 — first impression is the product, not a generic SaaS hero.
const steps = [
  {
    n: "1",
    title: "Pick a role",
    body: "Choose the role, company flavor, and seniority. Optionally add your resume and the job description so questions match your background.",
  },
  {
    n: "2",
    title: "Talk for 10 minutes",
    body: "A voice AI interviews you in clean turns — push-to-talk, no talking over each other — with adaptive follow-ups and a live coding round.",
  },
  {
    n: "3",
    title: "Get a scored report",
    body: "A rubric-scored report with strengths, gaps, model answers, and a replayable transcript.",
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <header className="flex items-center justify-between">
        <span className="font-mono text-sm font-semibold tracking-tight">
          maven<span className="text-teal">.ai</span>
        </span>
        <nav className="flex items-center gap-2">
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                Dashboard
              </Button>
            </Link>
          </SignedIn>
        </nav>
      </header>

      <section className="mt-20">
        <h1 className="text-5xl font-semibold leading-tight tracking-tight">
          Practice the interview, out loud.
        </h1>
        <p className="mt-5 max-w-xl text-xl text-ink/70">
          A real-time voice AI runs a realistic mock interview, then writes you a
          scored report with the transcript. No gimmicks — just reps.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <SignedOut>
            <SignUpButton mode="modal">
              <Button size="lg" variant="accent">
                Try a 2-minute interview
              </Button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard">
              <Button size="lg" variant="accent">
                Start an interview
              </Button>
            </Link>
          </SignedIn>
          <a href="#how" className="text-sm text-ink/60 hover:text-ink">
            How it works ↓
          </a>
        </div>
      </section>

      <section id="how" className="mt-24 grid gap-4">
        {steps.map((s) => (
          <Card key={s.n} className="flex gap-4">
            <span className="font-mono text-sm text-teal">{s.n}</span>
            <div>
              <h3 className="font-medium">{s.title}</h3>
              <p className="mt-1 text-sm text-ink/70">{s.body}</p>
            </div>
          </Card>
        ))}
      </section>
    </main>
  );
}
