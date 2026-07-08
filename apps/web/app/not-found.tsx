import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-fg/50">
        404
      </p>
      <h1 className="mt-3 font-display font-medium text-3xl tracking-tight">
        This page doesn&apos;t exist.
      </h1>
      <p className="mt-3 text-sm text-fg/60">
        The link may be old, or the interview it pointed to was removed.
      </p>
      <Link
        href="/dashboard"
        className={`${buttonVariants({ variant: "accent" })} mt-6`}
      >
        Go to your dashboard
      </Link>
    </main>
  );
}
