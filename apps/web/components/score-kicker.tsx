"use client";

import { errorMessage } from "@maven-ai/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// Kick the durable scorer. This used to be `.catch(() => {})` with no res.ok check,
// so every failure — network, 500, 401 — resolved successfully and the caller could
// not tell. Reject instead, and let each caller decide what that means.
const SCORE = async (id: string) => {
  const res = await fetch(`/api/interviews/${id}/score`, { method: "POST" });
  if (!res.ok) throw new Error(await errorMessage(res, "Couldn't start scoring."));
};

// Processing state: kick the durable scorer once on mount (idempotent server
// side) and poll for the result. router.refresh() re-runs the server page; when
// the status leaves `processing` this component unmounts and the interval clears.
export function ScoreKicker({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    // Deliberately swallowed here: the poll below is what surfaces the outcome, and
    // there is no button to re-enable. RetryScoring is the path that must not.
    void SCORE(interviewId).catch(() => {});
    const t = setInterval(() => active && router.refresh(), 4000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [interviewId, router]);
  return null;
}

// Failed state: an explicit retry (§7.5). Re-triggers the same scorer and
// refreshes so the page flips back to the processing state.
export function RetryScoring({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-start gap-1">
      <Button
        variant="accent"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await SCORE(interviewId);
            // Refresh only on success. Refreshing after a failure re-rendered the very
            // same failed page with the very same button and told the candidate
            // nothing — so they'd sit clicking Retry forever against a scorer that was
            // never actually being kicked.
            router.refresh();
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Couldn't start scoring.",
            );
          } finally {
            // A retry that fails again leaves the interview in the same state, so the
            // refresh renders the very same button back — without this it returns
            // disabled and the candidate has no second retry.
            setBusy(false);
          }
        }}
      >
        {busy ? "Retrying…" : "Retry scoring"}
      </Button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
