"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// ponytail: no setup wizard yet (milestone 4). One button creates a session and
// drops you into the room to prove transport.
export default function NewInterviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/interviews", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const { id } = (await res.json()) as { id: string };
      router.push(`/interview/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <Card className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Start an interview
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink/70">
          This opens a live room and connects you to the voice interviewer. Hold
          the button (or Space) to talk; release when you&apos;re done answering.
        </p>
        <Button
          variant="accent"
          size="lg"
          className="mt-6"
          onClick={start}
          disabled={loading}
        >
          {loading ? "Starting…" : "Start interview"}
        </Button>
        {error ? (
          <p className="mt-3 text-sm text-danger">{error}</p>
        ) : null}
        <Link
          href="/dashboard"
          className="mt-4 block text-sm text-ink/50 hover:text-ink"
        >
          Back to dashboard
        </Link>
      </Card>
    </main>
  );
}
