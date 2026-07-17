"use client";

import { errorMessage } from "@maven-ai/shared";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function CancelButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      // Same contract as checkout: failures come back as plain text.
      if (!res.ok) throw new Error(await errorMessage(res, "Couldn't cancel."));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't cancel.");
    } finally {
      // Reset on success too. We cancel at cycle end, so the user stays Pro and this
      // button stays mounted — router.refresh() re-renders the server tree but not
      // this client state, and it would sit on "Cancelling…" forever.
      setLoading(false);
      setConfirming(false);
    }
  }

  // Two taps rather than a window.confirm() — this is the money path and a
  // misclick shouldn't end someone's subscription.
  return (
    <span className="flex flex-col items-end gap-1">
      {confirming ? (
        <span className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setConfirming(false)} disabled={loading}>
            Keep Pro
          </Button>
          <Button
            variant="outline"
            className="border-danger/30 text-danger hover:bg-danger/5"
            onClick={cancel}
            disabled={loading}
          >
            {loading ? "Cancelling…" : "Confirm cancel"}
          </Button>
        </span>
      ) : (
        <Button variant="ghost" onClick={() => setConfirming(true)}>
          Cancel subscription
        </Button>
      )}
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
