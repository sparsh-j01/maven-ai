"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef, type ReactNode } from "react";

gsap.registerPlugin(useGSAP);

// App Router re-mounts this on every navigation, so a mount animation reads as a
// route transition. Opacity only — no layout shift, so it never fights the page's
// own ScrollTriggers. Reduced-motion users get an instant cut.
export default function Template({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(ref.current, { opacity: 0, duration: 0.35, ease: "power1.out" });
      });
    },
    { scope: ref },
  );
  return <div ref={ref}>{children}</div>;
}
