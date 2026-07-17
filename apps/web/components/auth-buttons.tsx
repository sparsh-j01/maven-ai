"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";

// Clerk's button components must not render from an async server component. Their
// element child stops being a plain element across that boundary, so Clerk's internal
// Children.only check fails and throws "multiple children" — 500ing the whole page.
// Creating them inside a client component keeps the child a plain element.
//
// signedIn comes from the caller's server-side auth() rather than <SignedIn>/<SignedOut>.
// Those read useAuth(), which knows nothing until Clerk's JS loads, so they render
// nothing during SSR and pop the buttons in on hydration. A plain prop is settled at
// request time, so the right branch ends up in the HTML.

export function NavAuth({
  signedIn,
  linkClass,
  ctaClass,
}: {
  signedIn: boolean;
  linkClass: string;
  ctaClass: string;
}) {
  if (signedIn) {
    return (
      <>
        <Link href="/dashboard" className={`hidden sm:inline-flex ${linkClass}`}>
          Dashboard
        </Link>
        <Link href="/interview/new" className={ctaClass}>
          New interview
        </Link>
      </>
    );
  }
  return (
    <>
      <SignInButton mode="modal">
        <button className={`hidden sm:inline-flex ${linkClass}`}>Sign in</button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button className={ctaClass}>Start for free</button>
      </SignUpButton>
    </>
  );
}

export function StartFreeCta({
  signedIn,
  ctaClass,
}: {
  signedIn: boolean;
  ctaClass: string;
}) {
  if (signedIn) {
    return (
      <Link href="/interview/new" className={ctaClass}>
        Start Free
      </Link>
    );
  }
  return (
    <SignUpButton mode="modal">
      <button className={ctaClass}>Start Free</button>
    </SignUpButton>
  );
}
