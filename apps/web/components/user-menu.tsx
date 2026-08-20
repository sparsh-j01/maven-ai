"use client";

import { UserButton } from "@clerk/nextjs";
import { Shield } from "lucide-react";

// The Clerk avatar menu, with an Admin entry that only admins are sent.
//
// This is a client component for the same reason auth-buttons.tsx is (see its
// comment): Clerk's components must not receive children from an async server
// component. The child stops being a plain element across that boundary, Clerk's
// internal Children.only check fails, and the page 500s. <UserButton /> with no
// children is safe there — <UserButton.MenuItems> is not. Do not "simplify" this
// back into dashboard/page.tsx.
//
// isAdmin arrives as a settled boolean, never the allowlist: ADMIN_USER_IDS has
// no NEXT_PUBLIC_ prefix precisely so it cannot reach the browser. Hiding the
// entry is presentation only — /admin and the approve route each re-check the
// session server-side, so a user who forges this prop gains nothing.
export function UserMenu({ isAdmin }: { isAdmin: boolean }) {
  if (!isAdmin) return <UserButton />;
  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Link
          label="Admin"
          labelIcon={<Shield className="h-4 w-4" aria-hidden />}
          href="/admin"
        />
      </UserButton.MenuItems>
    </UserButton>
  );
}
