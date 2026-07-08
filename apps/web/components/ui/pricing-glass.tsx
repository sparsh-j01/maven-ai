"use client";

import React, { useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Check } from "lucide-react";

export type TierType = {
  name: string;
  priceMonthly: string;
  priceAnnual: string;
  description: string;
  isPopular?: boolean;
  inherits?: string;
  features: string[];
  originalPrice?: string;
  discountPct?: number;
};

export interface PricingGlassProps {
  tiers: TierType[];
  className?: string;
  isAnnual?: boolean;
}

function PricingCard({ tier, isAnnual }: { tier: TierType, isAnnual: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseX = useSpring(x, { stiffness: 150, damping: 15 });
  const mouseY = useSpring(y, { stiffness: 150, damping: 15 });

  function onMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    x.set(clientX - left - width / 2);
    y.set(clientY - top - height / 2);
  }

  function onMouseLeave() {
    x.set(0);
    y.set(0);
  }

  const rotateX = useTransform(mouseY, [-200, 200], [8, -8]);
  const rotateY = useTransform(mouseX, [-200, 200], [-8, 8]);

  const price = isAnnual ? tier.priceAnnual : tier.priceMonthly;

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className="relative group"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="absolute -inset-0.5 bg-gradient-to-br from-accent/40 via-teal/25 to-accent/40 rounded-[26px] blur-2xl opacity-0 group-hover:opacity-70 transition duration-700"
        animate={{
          opacity: tier.isPopular ? 0.6 : 0,
        }}
      />

      <div className="glass relative h-full rounded-[26px] p-7 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute top-0 -left-[100%] w-[200%] h-full bg-gradient-to-r from-transparent via-white/5 to-transparent"
            animate={{
              x: ["0%", "100%"],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              repeatDelay: 3,
              ease: "linear",
            }}
          />
        </div>

        {tier.isPopular && (
          <div className="absolute top-3 right-3">
            <motion.div
              className="bg-accent text-on-accent text-[10px] font-bold px-2.5 py-1 rounded-full font-mono uppercase tracking-wider"
              animate={{
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
            >
              Most popular
            </motion.div>
          </div>
        )}

        <div className="relative z-10">
          <h3 className="font-display text-2xl tracking-tight">{tier.name}</h3>
          <div className="mt-4 flex items-baseline gap-2">
            {tier.originalPrice && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="font-display text-2xl text-muted line-through"
              >
                {tier.originalPrice}
              </motion.span>
            )}
            {/* price is pre-formatted (currency symbol, or "Free"/"Contact") — render verbatim */}
            <span className="font-display text-5xl font-medium leading-none tracking-tight">
              {price === "Contact" ? "Let's talk" : price}
            </span>
            {price !== "Contact" && price !== "Free" && (
              <span className="font-mono text-sm text-muted">/mo</span>
            )}
            {tier.discountPct && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent"
              >
                {tier.discountPct}% off
              </motion.span>
            )}
          </div>
          <p className="mt-2 text-sm text-muted">{tier.description}</p>

          {tier.inherits && (
            <div className="mt-6 flex items-center gap-3">
              <span className="shrink-0 text-xs font-medium text-fg/60">
                Everything in {tier.inherits}, plus
              </span>
              <span className="h-px flex-1 bg-fg/10" />
            </div>
          )}

          <ul className={`${tier.inherits ? "mt-4" : "mt-6"} flex flex-col gap-3`}>
            {tier.features.map((f, idx) => (
              <motion.li
                key={f}
                className="flex items-start gap-3 text-fg/80"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Check
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    tier.inherits ? "text-accent" : "text-teal"
                  }`}
                />
                <span className="text-sm">{f}</span>
              </motion.li>
            ))}
          </ul>

          <motion.button
            className={`w-full mt-6 py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-300 ${
              tier.isPopular
                ? "bg-accent text-on-accent hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/20"
                : "bg-fg/10 text-fg hover:bg-fg/15 border border-fg/10"
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {price === "Contact"
              ? "Talk to us"
              : tier.name === "Pro"
                ? "Upgrade to Pro"
                : "Get started"}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export function PricingGlass({ tiers, className, isAnnual }: PricingGlassProps) {
  return (
    <div className={`w-full ${className || ""}`}>
      <div className="grid items-stretch gap-6 md:grid-cols-3">
        {tiers.map((tier) => (
          <PricingCard key={tier.name} tier={tier} isAnnual={isAnnual ?? false} />
        ))}
      </div>
    </div>
  );
}
