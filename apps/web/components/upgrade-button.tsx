"use client";

import { errorMessage } from "@maven-ai/shared";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function UpgradeButton() {
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
        {loading ? "Redirecting…" : "Upgrade to Pro"}
      </Button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
