"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

// Segmented toggle that persists to a cookie the server reads, then refreshes
// the server component in place so prices update without a full reload — a
// reload would reset scroll and jump the page to the top.
export function PrefToggle<T extends string>({
  cookie,
  current,
  options,
}: {
  cookie: string;
  current: T;
  options: { value: T; label: string; hint?: string; discount?: string }[];
}) {
  const router = useRouter();
  function pick(v: T) {
    if (v === current) return;
    // pick() only ever runs from onClick, and writing a cookie is exactly the
    // "update an external system" case. The compiler rule can't prove this isn't
    // reachable during render; it isn't.
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `${cookie}=${v}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.refresh();
  }
  return (
    <div className="inline-flex rounded-full border border-fg/15 p-0.5 font-mono text-xs">
      {options.map((o) => {
        const isSelected = current === o.value;
        const showDiscount = isSelected && o.discount;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => pick(o.value)}
            aria-pressed={isSelected}
            className={`relative rounded-full px-3 py-1 transition-colors ${
              isSelected ? "bg-fg/10 text-fg" : "text-muted hover:text-fg"
            }`}
          >
            {o.label}
            {showDiscount && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="ml-1.5 text-accent font-semibold"
              >
                {o.discount}
              </motion.span>
            )}
          </button>
        );
      })}
    </div>
  );
}
