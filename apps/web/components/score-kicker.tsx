"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const SCORE = (id: string) =>
  fetch(`/api/interviews/${id}/score`, { method: "POST" }).catch(() => {});

// Processing state: kick the durable scorer once on mount (idempotent server
// side) and poll for the result. router.refresh() re-runs the server page; when
// the status leaves `processing` this component unmounts and the interval clears.
export function ScoreKicker({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    void SCORE(interviewId);
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
  return (
    <Button
      variant="accent"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await SCORE(interviewId);
        router.refresh();
      }}
    >
      {busy ? "Retrying…" : "Retry scoring"}
    </Button>
  );
}
