"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="h-3 w-3 rounded-full bg-danger" aria-hidden />
      <h1 className="mt-4 font-display font-medium text-3xl tracking-tight">
        Something went wrong.
      </h1>
      <p className="mt-3 text-sm text-fg/60">
        Your interviews and reports are safe. Try again; if it keeps happening,
        reload the page.
      </p>
      <Button variant="accent" className="mt-6" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
