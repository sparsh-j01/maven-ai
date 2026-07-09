import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

export function TopBar({ right }: { right?: ReactNode }) {
  return (
    <header className="flex items-center justify-between border-b border-fg/10 py-5">
      <Link
        href="/dashboard"
        className="font-display font-bold text-xl"
      >
        Maven
      </Link>
      <div className="flex items-center gap-3">
        {right}
        <ThemeToggle />
      </div>
    </header>
  );
}
