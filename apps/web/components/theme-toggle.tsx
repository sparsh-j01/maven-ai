"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

// The inline script in layout.tsx sets data-theme before paint; this flips and persists it.
// Renders a fixed-size box until mounted to avoid a hydration mismatch.
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    // Reading the theme the pre-paint script already applied. It can't be read during
    // render (no document on the server), and starting at null is what keeps hydration
    // from mismatching. Runs once on mount, so there's no cascading-render loop here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // storage disabled: theme still applies for this session
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      }
      className="grid h-9 w-9 place-items-center rounded-full border border-fg/15 text-muted transition-colors hover:bg-fg/5 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {theme === null ? (
        <span className="h-4 w-4" aria-hidden />
      ) : theme === "dark" ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
