import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { mailto } from "@/lib/contact";

// DEV NOTE: deletion is request-based today (email → we erase). When a
// self-serve delete endpoint exists (Clerk user + DB cascade), swap the mailto
// button for it and gate this page behind auth.

export const metadata: Metadata = {
  title: "Delete Account · Maven",
  description: "Permanently delete your Maven account and all of its data.",
};

const REMOVED = [
  "Interview history",
  "Reports",
  "Voice recordings",
  "Transcripts",
];

export default function DeleteAccountPage() {
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
          Delete your account
        </h1>

        <p className="mt-6 text-sm leading-relaxed text-fg/75">
          Deleting your account permanently removes:
        </p>
        <ul className="mt-4 space-y-2">
          {REMOVED.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-fg/80">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
                aria-hidden
              />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm leading-relaxed text-muted">
          Backups are deleted within 30 days. This can&apos;t be undone.
        </p>

        <div className="mt-8 border-t border-fg/10 pt-8">
          <p className="text-sm leading-relaxed text-fg/75">
            To delete your account, send us a request from the email address on
            your account and we&apos;ll erase it and its data.
          </p>
          <a
            href={mailto(
              "Delete my account",
              "Please permanently delete my Maven account and all of its data.",
            )}
            className={`${buttonVariants({ variant: "accent" })} mt-5`}
          >
            Request account deletion
          </a>
        </div>
      </main>
    </div>
  );
}
