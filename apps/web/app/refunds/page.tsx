import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

// Standard SaaS cancellation & refund policy — required by Razorpay for
// activation. DEV NOTE: the 7-day money-back window is a business choice; adjust
// the number (or drop it) to match how you actually want to handle refunds.

export const metadata: Metadata = {
  title: "Cancellation & Refunds · Maven",
  description: "Cancel anytime, keep access to the end of your period, and our money-back terms.",
};

const UPDATED = "July 2026";
const EMAIL = "sparshjjwala.work@gmail.com";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="scroll-mt-24 border-t border-fg/10 pt-8">
      <h2 className="font-display font-medium text-2xl tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-fg/75">{children}</div>
    </section>
  );
}

export default function RefundsPage() {
  return (
    <div className="min-h-screen text-fg">
      <main className="mx-auto max-w-2xl px-6 py-16">
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-widest text-muted transition-colors hover:text-fg"
        >
          ← Maven
        </Link>
        <h1 className="mt-6 font-display font-medium text-4xl tracking-tight">
          Cancellation &amp; Refunds
        </h1>
        <p className="mt-3 font-mono text-xs uppercase tracking-widest text-muted">
          Last updated {UPDATED}
        </p>
        <p className="mt-6 text-sm leading-relaxed text-fg/75">
          We keep this simple and fair. The Free plan lets you try Maven before
          you pay, and you can cancel Pro whenever you like.
        </p>

        <div className="mt-12 space-y-10">
          <Section title="Free plan">
            <p>
              The Free plan is free forever and needs no card. There&apos;s
              nothing to cancel and nothing to refund.
            </p>
          </Section>

          <Section title="Cancelling Pro">
            <p>
              You can cancel Pro anytime — there&apos;s no cancellation fee. When
              you cancel, you keep Pro until the end of the period you&apos;ve
              already paid for (the rest of the month, or the rest of the year on
              an annual plan), and then your account moves to Free automatically.
              We don&apos;t charge you again after you cancel. To cancel, email us
              at{" "}
              <a className="text-teal hover:underline" href={`mailto:${EMAIL}?subject=Cancel%20my%20subscription`}>
                {EMAIL}
              </a>{" "}
              and we&apos;ll stop your renewal.
            </p>
          </Section>

          <Section title="Refunds">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>7-day money-back:</strong> if Pro isn&apos;t for you,
                email us within 7 days of your first Pro payment (monthly or
                annual) and we&apos;ll refund it in full.
              </li>
              <li>
                <strong>Billing errors:</strong> duplicate or accidental charges
                are always refunded in full — just let us know.
              </li>
              <li>
                <strong>After the 7 days:</strong> payments are non-refundable,
                but you can still cancel anytime and keep access until the end of
                the period. Annual plans aren&apos;t pro-rated after the money-back
                window.
              </li>
            </ul>
          </Section>

          <Section title="Failed payments">
            <p>
              If a renewal payment fails, we retry it for a short while. If it
              keeps failing, your account simply moves to Free — no penalty, and
              your interviews and reports stay in your account.
            </p>
          </Section>

          <Section title="How refunds are issued">
            <p>
              Approved refunds go back to your original payment method through our
              processor (Razorpay in India, Stripe elsewhere). It usually takes
              5–10 business days for the amount to appear, depending on your bank.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about a cancellation or refund? Email{" "}
              <a className="text-teal hover:underline" href={`mailto:${EMAIL}`}>
                {EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}
