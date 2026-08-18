"use client";

import { type BillingCycle, errorMessage } from "@maven-ai/shared";
import { useState } from "react";
import { Button } from "@/components/ui/button";

// `cycle` is display-only — the checkout route reads the pref_cycle cookie, which is the
// authority, and this just names it. Passing it in makes the button say what it is about
// to charge: the cookie is set on the landing page's pricing toggle, so a user who signed
// up and came straight here would otherwise click "Upgrade to Pro" with no idea whether
// that meant monthly or annual. Omit it and the label stays generic.
export function UpgradeButton({ cycle }: { cycle?: BillingCycle }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upgrade() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      // The route answers failures in plain text (503 annual-unavailable, 502
      // gateway). Surface it — a button that just stops spinning tells the user
      // nothing, and this is the money path.
      if (!res.ok)
        throw new Error(await errorMessage(res, "Couldn't start checkout."));
      const { url } = (await res.json()) as { url?: string };
      if (url) {
        window.location.href = url;
        return;
      }
      throw new Error("Checkout didn't return a link.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start checkout.");
      setLoading(false);
    }
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <Button variant="accent" onClick={upgrade} disabled={loading}>
        {loading
          ? "Redirecting…"
          : cycle
            ? `Upgrade to Pro — ${cycle === "annual" ? "Annual" : "Monthly"}`
            : "Upgrade to Pro"}
      </Button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
