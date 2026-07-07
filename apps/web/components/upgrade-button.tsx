"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function UpgradeButton() {
  const [loading, setLoading] = useState(false);

  async function upgrade() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const { url } = (await res.json()) as { url?: string };
      if (url) window.location.href = url;
      else setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  return (
    <Button variant="accent" onClick={upgrade} disabled={loading}>
      {loading ? "Redirecting…" : "Upgrade to Pro"}
    </Button>
  );
}
