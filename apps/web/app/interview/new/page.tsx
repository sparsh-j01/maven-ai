"use client";

import {
  type CompanyType,
  type Difficulty,
  type InterviewType,
  type Seniority,
  seniorityDifficulty,
} from "@maven-ai/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Milestone 4 setup: collect role / company / seniority / type so the BFF can
// generate a phased question plan. ponytail: a single form, not the multi-step
// wizard chrome from §7.3 — the mic check already gates entry in the room, and
// the resume-upload step lands with RAG in milestone 7.

const ROLES = [
  "Frontend Engineer",
  "Backend Engineer",
  "Full Stack Engineer",
  "Software Engineer",
];

const SENIORITY: { value: Seniority; label: string }[] = [
  { value: "intern", label: "Intern" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid-level" },
  { value: "senior", label: "Senior" },
  { value: "sde1", label: "SDE 1" },
  { value: "sde2", label: "SDE 2" },
  { value: "sde3", label: "SDE 3" },
];

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const TYPES: { value: InterviewType; label: string }[] = [
  { value: "technical", label: "Technical" },
  { value: "behavioral", label: "Behavioral" },
  { value: "mixed", label: "Mixed" },
  { value: "system_design", label: "System design" },
];

// Optional target-company lever — shifts the difficulty band (product harder,
// service easier, startup neutral) and colours the agent's tone (§5).
const COMPANY_TYPES: { value: CompanyType; label: string }[] = [
  { value: "product", label: "Product-based" },
  { value: "service", label: "Service-based" },
  { value: "startup", label: "Startup" },
];

const field =
  "h-10 w-full rounded border border-ink/15 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal";
const area =
  "w-full rounded border border-ink/15 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal";

export default function NewInterviewPage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [resume, setResume] = useState("");
  const [jd, setJd] = useState("");
  const [seniority, setSeniority] = useState<Seniority>("mid");
  const [type, setType] = useState<InterviewType>("mixed");
  const [companyTypeSel, setCompanyTypeSel] = useState<CompanyType | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: role.trim(),
          company: company.trim() || undefined,
          companyType: companyTypeSel || undefined,
          seniority,
          type,
          resumeText: resume.trim() || undefined,
          jdText: jd.trim() || undefined,
        }),
      });
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
      <Card>
        <h1 className="text-xl font-semibold tracking-tight">Set up your interview</h1>
        <p className="mt-2 text-sm text-ink/70">
          Pick a role and format — we&apos;ll build a question plan, then drop you
          into a live room. Hold the button (or Space) to talk.
        </p>

        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Role</span>
            <input
              className={field}
              list="role-options"
              placeholder="e.g. Frontend Engineer"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              autoFocus
            />
            <datalist id="role-options">
              {ROLES.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              Target company <span className="text-ink/40">(optional)</span>
            </span>
            <input
              className={field}
              placeholder="e.g. Stripe"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              Target company type <span className="text-ink/40">(optional)</span>
            </span>
            <select
              className={field}
              value={companyTypeSel}
              onChange={(e) => setCompanyTypeSel(e.target.value as CompanyType | "")}
            >
              <option value="">No preference</option>
              {COMPANY_TYPES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              Resume <span className="text-ink/40">(optional)</span>
            </span>
            <textarea
              className={area}
              rows={4}
              maxLength={10000}
              placeholder="Paste your resume — we'll tailor questions to your background."
              value={resume}
              onChange={(e) => setResume(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              Job description <span className="text-ink/40">(optional)</span>
            </span>
            <textarea
              className={area}
              rows={4}
              maxLength={5000}
              placeholder="Paste the role's job description — we'll aim questions at it."
              value={jd}
              onChange={(e) => setJd(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Seniority</span>
              <select
                className={field}
                value={seniority}
                onChange={(e) => setSeniority(e.target.value as Seniority)}
              >
                {SENIORITY.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Format</span>
              <select
                className={field}
                value={type}
                onChange={(e) => setType(e.target.value as InterviewType)}
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="text-xs text-ink/60">
            This interview will be{" "}
            <span className="font-medium text-ink">
              {DIFFICULTY_LABEL[seniorityDifficulty(seniority, companyTypeSel || undefined)]}
            </span>
            .
          </p>

          <Button
            type="submit"
            variant="accent"
            size="lg"
            className="mt-2"
            disabled={loading || role.trim().length === 0}
          >
            {loading ? "Building your plan…" : "Start interview"}
          </Button>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </form>

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
