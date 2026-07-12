"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// Approves one pending interview, then refreshes so it drops off the list.
export function ApproveButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);

  async function approve() {
    setLoading(true);
    setErr(false);
    try {
      const res = await fetch(`/api/admin/interviews/${id}/approve`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      window.location.reload();
    } catch {
      setErr(true);
      setLoading(false);
    }
  }

  return (
    <Button variant="accent" onClick={approve} disabled={loading}>
      {loading ? "Approving…" : err ? "Retry" : "Approve"}
    </Button>
  );
}
