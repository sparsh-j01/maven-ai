import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

// Baseline terms of service for a practice-interview product. DEV NOTE: have
// counsel review and set a real legal entity + governing law before public
// launch — the contact address below is a placeholder.

export const metadata: Metadata = {
  title: "Terms · Maven",
  description: "The terms that govern your use of Maven.",
};

const UPDATED = "July 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="scroll-mt-24 border-t border-fg/10 pt-8">
      <h2 className="font-display font-medium text-2xl tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-fg/75">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen text-fg">
      <main className="mx-auto max-w-2xl px-6 py-16">
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-widest text-muted transition-colors hover:text-fg"
        >
          ← Maven
        </Link>
        <h1 className="mt-6 font-display font-medium text-4xl tracking-tight">Terms of Service</h1>
        <p className="mt-3 font-mono text-xs uppercase tracking-widest text-muted">
          Last updated {UPDATED}
        </p>
        <p className="mt-6 text-sm leading-relaxed text-fg/75">
          These terms govern your use of Maven. By creating an account or
          using the service, you agree to them.
        </p>

        <div className="mt-12 space-y-10">
          <Section title="What Maven is">
            <p>
              Maven is a practice tool: an AI conducts mock interviews and
              produces a rubric-scored report. It is for preparation only. It is
              not a real job interview, not affiliated with any employer, and its
              scores and feedback do not guarantee any hiring outcome.
            </p>
          </Section>

          <Section title="Your account">
            <p>
              You must provide accurate information and keep your login secure.
              You&apos;re responsible for activity under your account. You must be
              old enough to form a binding contract in your jurisdiction. Don&apos;t
              create multiple accounts to get around free-tier limits.
            </p>
          </Section>

          <Section title="Acceptable use">
            <p>
              Don&apos;t misuse the service: no attempts to break, overload, or
              reverse-engineer it; no uploading content you don&apos;t have the
              right to share; no unlawful, infringing, or abusive use; and no
              attempts to manipulate the AI into unsafe or off-task behavior.
            </p>
          </Section>

          <Section title="Plans, billing & refunds">
            <p>
              Free and paid plans are described on our pricing page. Paid
              subscriptions renew until cancelled; you can cancel anytime and keep
              access through the end of the paid period. Fees are charged through
              our payment processor. Except where required by law, payments are
              non-refundable.
            </p>
          </Section>

          <Section title="Your content">
            <p>
              You keep ownership of the résumé text, answers, and audio you
              provide. You grant us the limited license needed to run your
              interview, generate and store your report, and operate the service.
              See our{" "}
              <Link className="text-teal hover:underline" href="/privacy">
                Privacy Policy
              </Link>{" "}
              for how content is handled.
            </p>
          </Section>

          <Section title="Disclaimers & liability">
            <p>
              The service is provided &ldquo;as is,&rdquo; without warranties.
              Interview questions, transcripts, and AI-generated feedback may be
              inaccurate — use your judgment. To the extent permitted by law,
              Maven is not liable for indirect or consequential damages, and our
              total liability is limited to the amount you paid us in the prior
              three months.
            </p>
          </Section>

          <Section title="Termination & changes">
            <p>
              You can stop using Maven anytime. We may suspend accounts that
              violate these terms. We may update these terms; material changes
              will be reflected by the &ldquo;last updated&rdquo; date, and
              continued use means you accept them.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these terms? Email{" "}
              <a className="text-teal hover:underline" href="mailto:hello@maven.ai">
                hello@maven.ai
              </a>
              .
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}
