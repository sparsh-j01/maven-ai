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

// Editorial plan card: flat paper, a hairline, cobalt only where it earns it.
// The popular tier gets a faint accent wash + border, not a glow. Stagger-reveal
// is handled globally by ScrollReveals via the grid's data-reveal-group.
function PricingCard({ tier, isAnnual }: { tier: TierType; isAnnual: boolean }) {
  const price = isAnnual ? tier.priceAnnual : tier.priceMonthly;
  const pro = tier.isPopular;
  return (
    <div
      className={`relative flex h-full flex-col rounded-card border p-7 ${
        pro
          ? "border-accent bg-accent/[0.05]"
          : "border-hair bg-panel"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-2xl tracking-tight">{tier.name}</h3>
        {pro && (
          <span className="border border-accent px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-accent">
            Most prep
          </span>
        )}
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        {tier.originalPrice && (
          <span className="font-display text-2xl text-muted line-through">
            {tier.originalPrice}
          </span>
        )}
        {/* price is pre-formatted (currency symbol, or "Free"/"Contact") */}
        <span className="font-display text-5xl leading-none tracking-tight">
          {price === "Contact" ? "Let's talk" : price}
        </span>
        {price !== "Contact" && price !== "Free" && (
          <span className="font-mono text-sm text-muted">/mo</span>
        )}
        {tier.discountPct ? (
          <span className="ml-1 bg-accent/10 px-2 py-0.5 font-mono text-xs font-medium text-accent">
            {tier.discountPct}% off
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-muted">{tier.description}</p>

      {tier.inherits && (
        <div className="mt-6 flex items-center gap-3">
          <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.1em] text-fg/50">
            Everything in {tier.inherits}, plus
          </span>
          <span className="h-px flex-1 bg-hair" />
        </div>
      )}

      <ul className={`${tier.inherits ? "mt-4" : "mt-6"} flex flex-1 flex-col gap-3`}>
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-fg/85">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            <span className="text-sm leading-snug">{f}</span>
          </li>
        ))}
      </ul>

      <button
        className={`mt-7 w-full rounded py-3 text-sm font-medium transition-colors ${
          pro
            ? "bg-accent text-on-accent hover:brightness-110"
            : "border border-fg/25 text-fg hover:bg-fg/5"
        }`}
      >
        {price === "Contact"
          ? "Talk to us"
          : tier.name === "Pro"
            ? "Upgrade to Pro"
            : "Get started"}
      </button>
    </div>
  );
}

export function PricingGlass({ tiers, className, isAnnual }: PricingGlassProps) {
  return (
    <div className={`w-full ${className || ""}`}>
      <div data-reveal-group className="grid items-stretch gap-5 md:grid-cols-3">
        {tiers.map((tier) => (
          <PricingCard key={tier.name} tier={tier} isAnnual={isAnnual ?? false} />
        ))}
      </div>
    </div>
  );
}
