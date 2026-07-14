import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SUPPORT_EMAIL } from "@/lib/contact";

const A = "text-teal hover:underline";

// Security overview written to what the app actually runs on (Clerk auth,
// Razorpay billing, Vercel hosting, Neon Postgres, Cloudflare R2, the
// LiveKit/Deepgram/Google voice stack). DEV NOTE: keep this honest as the stack
// changes, and set a real security contact before public launch.

export const metadata: Metadata = {
  title: "Security · Maven",
  description: "How Maven protects your account, your interviews, and your data.",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="scroll-mt-24 border-t border-fg/10 pt-8">
      <h2 className="font-display font-medium text-2xl tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-fg/75">{children}</div>
    </section>
  );
}

export default function SecurityPage() {
  return (
    <div className="min-h-screen text-fg">
      <main className="mx-auto max-w-2xl px-6 py-16">
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-widest text-muted transition-colors hover:text-fg"
        >
          ← Maven
        </Link>
        <h1 className="mt-6 font-display font-medium text-4xl tracking-tight">Security</h1>
        <p className="mt-6 text-sm leading-relaxed text-fg/75">
          Maven is built to keep your account and your interviews private. Here
          is how we protect your data and who we rely on to do it. For what we
          collect and why, see our{" "}
          <Link className={A} href="/privacy">
            Privacy Policy
          </Link>
          .
        </p>

        <div className="mt-12 space-y-10">
          <Section title="Encryption in transit & at rest">
            <p>
              All traffic is served over HTTPS (TLS), and HSTS keeps browsers on
              a secure connection. Interview audio, transcripts, and any résumé
              files live in private object storage, reachable only through
              short-lived signed links — never a public URL. Data at rest is
              encrypted by our storage and database providers.
            </p>
          </Section>

          <Section title="Authentication & access">
            <p>
              Sign-in is handled by Clerk, a dedicated auth provider — we never
              see or store your password, and you can add multi-factor
              authentication on your account. Every request is scoped to your
              user, so you can only ever reach your own interviews and reports.
            </p>
          </Section>

          <Section title="Payments">
            <p>
              We never receive or store card numbers. Payments run through
              Razorpay, which is PCI-DSS compliant and handles card data
              directly. We only keep your subscription status and the identifiers
              needed to manage it.
            </p>
          </Section>

          <Section title="Infrastructure">
            <p>
              The app is hosted on Vercel, with a managed Postgres database on
              Neon and file storage on Cloudflare R2. Real-time voice runs on
              LiveKit with speech and language models from Deepgram and Google.
              Each is an established provider under contract to process data only
              on our behalf.
            </p>
          </Section>

          <Section title="Backups & recovery">
            <p>
              Databases and file storage are backed up by our providers with
              encryption, so we can recover from failures. When you delete your
              account, your interviews, transcripts, and recordings are removed
              and purged from backups within 30 days.
            </p>
          </Section>

          <Section title="Monitoring & abuse prevention">
            <p>
              We log errors (Sentry) so we can catch and fix problems quickly,
              and we rate-limit requests to protect the service from abuse. None
              of this is used to advertise to you or sold to anyone.
            </p>
          </Section>

          <Section title="What you can do">
            <p>
              Security is shared. Use a strong, unique password, turn on
              multi-factor authentication in your account settings, and sign out
              on shared devices. Never share your login, and let us know right
              away if you notice anything unusual.
            </p>
          </Section>

          <Section title="Reporting a vulnerability">
            <p>
              Found a security issue? Please email{" "}
              <a className={A} href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>{" "}
              with the details and steps to reproduce. We&apos;ll acknowledge
              your report, keep you updated, and credit you if you&apos;d like
              once it&apos;s fixed. Please don&apos;t publicly disclose an issue
              before we&apos;ve had a chance to address it.
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}
