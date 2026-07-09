import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

// Baseline privacy policy written to what the app actually does (Clerk auth,
// résumé text/PDF, interview audio + transcripts, Stripe billing, the named
// subprocessors). DEV NOTE: have counsel review before public launch and set a
// real legal entity + contact addresses — the emails below are placeholders.

export const metadata: Metadata = {
  title: "Privacy · Maven",
  description: "How Maven collects, uses, and protects your data.",
};

const UPDATED = "July 2026";

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-fg/10 pt-8">
      <h2 className="font-display font-medium text-2xl tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-fg/75">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen text-fg">
      <main className="mx-auto max-w-2xl px-6 py-16">
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-widest text-muted transition-colors hover:text-fg"
        >
          ← Maven
        </Link>
        <h1 className="mt-6 font-display font-medium text-4xl tracking-tight">Privacy Policy</h1>
        <p className="mt-3 font-mono text-xs uppercase tracking-widest text-muted">
          Last updated {UPDATED}
        </p>
        <p className="mt-6 text-sm leading-relaxed text-fg/75">
          Maven (&ldquo;we&rdquo;) provides voice mock
          interviews. This policy explains what we collect, why, and the choices
          you have. We collect only what the product needs and never sell your
          data.
        </p>

        <div className="mt-12 space-y-10">
          <Section title="What we collect">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Account:</strong> name and email, handled by our auth
                provider (Clerk). We never see or store your password.
              </li>
              <li>
                <strong>Interview content:</strong> the role, seniority, and any
                résumé or job-description text you provide; the audio of your
                session and its transcript; and the scored report we generate.
              </li>
              <li>
                <strong>Billing:</strong> subscription status and identifiers
                from our payment processor. Card details are handled by the
                processor — we never receive them.
              </li>
              <li>
                <strong>Technical:</strong> basic logs and product analytics
                (pages used, errors) to keep the service working.
              </li>
            </ul>
          </Section>

          <Section title="How we use it">
            <p>
              To run your interview, generate and store your report, provide your
              history, process billing, prevent abuse, and improve the product.
              We do not use your résumé or transcripts to train third-party
              models.
            </p>
          </Section>

          <Section title="Who we share it with">
            <p>
              Only the service providers (&ldquo;subprocessors&rdquo;) that make
              Maven run — under contract, for these purposes only: authentication
              (Clerk), real-time voice and speech (LiveKit, Deepgram, Google),
              question and scoring models (Google), payments (Stripe,
              Razorpay), file and database storage (Cloudflare, Neon), and
              error/usage monitoring (Sentry, PostHog, Langfuse). We do not sell
              personal data or share it for advertising.
            </p>
          </Section>

          <Section title="Cookies">
            <p>
              We use a small number of essential cookies to keep you signed in
              (set by our auth provider) and to remember preferences like your
              theme and billing region. Product analytics may set cookies to
              measure usage in aggregate. We do not use advertising or
              cross-site tracking cookies. You can clear or block cookies in your
              browser, though signing in won&apos;t work without the essential
              ones.
            </p>
          </Section>

          <Section id="your-data" title="Your data & choices">
            <p>
              You can view your interviews and reports in your dashboard. You can
              request a copy of your data, or deletion of your account and its
              content, by emailing{" "}
              <a className="text-teal hover:underline" href="mailto:privacy@maven.ai">
                privacy@maven.ai
              </a>{" "}
              or from the{" "}
              <Link className="text-teal hover:underline" href="/delete-account">
                Delete Account
              </Link>{" "}
              page. Deleting your account removes your interviews, transcripts,
              and stored résumé files. Depending on where you live, you may have
              additional rights (access, correction, portability, objection).
            </p>
          </Section>

          <Section title="Retention">
            <p>
              We keep interview content while your account is active so you can
              revisit it, and delete it on account deletion. Minimal billing and
              log records may be retained where required for legal or accounting
              reasons.
            </p>
          </Section>

          <Section title="Children">
            <p>
              Maven is not intended for children under 13, and we don&apos;t
              knowingly collect their data. If you believe a child has given us
              personal information, email us and we&apos;ll delete it.
            </p>
          </Section>

          <Section title="International transfers">
            <p>
              We&apos;re made in India and serve candidates everywhere, and the
              providers that run Maven may process data in other countries
              (including the United States). Where that happens, we rely on those
              providers&apos; standard safeguards for cross-border transfers.
            </p>
          </Section>

          <Section title="Security">
            <p>
              Data is encrypted in transit (HTTPS). Interview files live in
              private storage, reachable only through short-lived signed links.
              Access is scoped so you can only reach your own interviews. No
              system is perfectly secure, but we work to protect your data — see
              our{" "}
              <Link className="text-teal hover:underline" href="/security">
                Security page
              </Link>{" "}
              for details.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We may update this policy as the product evolves. Material changes
              will be reflected by the &ldquo;last updated&rdquo; date above, and
              continued use of Maven means you accept the current version.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about privacy? Email{" "}
              <a className="text-teal hover:underline" href="mailto:privacy@maven.ai">
                privacy@maven.ai
              </a>
              .
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}
