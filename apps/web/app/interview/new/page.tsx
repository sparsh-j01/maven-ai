"use client";

import {
  type CompanyType,
  type Difficulty,
  type InterviewType,
  type Seniority,
  PLAN_LIMITS,
  seniorityDifficulty,
} from "@maven-ai/shared";
import { FileText, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UpgradeButton } from "@/components/upgrade-button";
import { cn } from "@/lib/utils";

const ROLES: { value: string; label: string }[] = [
  { value: "Frontend Engineer", label: "Frontend" },
  { value: "Backend Engineer", label: "Backend" },
  { value: "Software Engineer (Full Stack)", label: "Full-stack" },
  { value: "AI Engineer", label: "AI / ML" },
];

const SENIORITY: { value: Seniority; label: string }[] = [
  { value: "intern", label: "Intern" },
  { value: "sde1", label: "SDE 1" },
  { value: "sde2", label: "SDE 2" },
  { value: "sde3", label: "SDE 3" },
];

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  easy: "border-teal/30 bg-teal/10 text-teal",
  medium: "border-amber/30 bg-amber/10 text-amber",
  hard: "border-accent/30 bg-accent/10 text-accent",
};

const TYPES: { value: InterviewType; label: string }[] = [
  { value: "technical", label: "Technical" },
  { value: "behavioral", label: "Behavioral" },
  { value: "mixed", label: "Mixed" },
  { value: "system_design", label: "System design" },
];

const COMPANY_TYPES: { value: CompanyType | ""; label: string }[] = [
  { value: "", label: "No preference" },
  { value: "product", label: "Product-based" },
  { value: "service", label: "Service-based" },
  { value: "startup", label: "Startup" },
];

const field =
  "h-11 w-full rounded-lg border border-fg/15 bg-fg/[0.03] px-3.5 text-sm placeholder:text-fg/35 transition-colors focus:border-fg/25 focus:outline-none focus:ring-2 focus:ring-accent/40";
const area =
  "w-full rounded-lg border border-fg/15 bg-fg/[0.03] px-3.5 py-2.5 text-sm leading-relaxed placeholder:text-fg/35 transition-colors focus:border-fg/25 focus:outline-none focus:ring-2 focus:ring-accent/40";

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value || "none"}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              active
                ? "border-transparent bg-fg font-medium text-ground"
                : "border-fg/15 text-fg/70 hover:border-fg/30 hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function NewInterviewPage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [resume, setResume] = useState("");
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [jd, setJd] = useState("");
  const [seniority, setSeniority] = useState<Seniority>("sde1");
  const [type, setType] = useState<InterviewType>("mixed");
  const [companyTypeSel, setCompanyTypeSel] = useState<CompanyType | "">("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaHit, setQuotaHit] = useState(false);

  const difficulty = seniorityDifficulty(seniority, companyTypeSel || undefined);

  // Extract the PDF text server-side, then drop it into the résumé field. Client
  // checks type+size for fast feedback; the route enforces both again.
  async function handleFile(file: File | undefined) {
    if (!file) return;
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Please upload a PDF file.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError("That PDF is over 3MB — try a smaller file.");
      return;
    }
    setParsing(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/resumes/parse", { method: "POST", body: fd });
      if (!res.ok) {
        // Surface the route's plain-text message; never dump an HTML 500 page.
        const msg = res.headers.get("content-type")?.startsWith("text/plain")
          ? (await res.text()).slice(0, 200)
          : "";
        throw new Error(msg || "Couldn't read that PDF");
      }
      const { text } = (await res.json()) as { text: string };
      setResume(text);
      setResumeFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that PDF");
    } finally {
      setParsing(false);
    }
  }

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
      if (res.status === 402) {
        setQuotaHit(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const { id } = (await res.json()) as { id: string };
      router.push(`/interview/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 pb-16">
      <TopBar />

      <Link
        href="/dashboard"
        className="mt-8 inline-flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-fg/50 transition-colors hover:text-fg"
      >
        ← Dashboard
      </Link>

      <Card className="mt-4 p-7 sm:p-9">
        <p className="font-mono text-xs uppercase tracking-widest text-fg/50">
          New session
        </p>
        <h1 className="mt-2 font-display font-medium text-3xl tracking-tight">
          Set up your interview
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-fg/70">
          Pick a role and format; we&apos;ll build a question plan, then drop you
          into a live room. Hold the button (or Space) to talk.
        </p>

        <form
          className="mt-8 flex flex-col gap-7"
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
        >
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Role</span>
            <Segmented value={role} onChange={setRole} options={ROLES} />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Seniority</span>
            <Segmented
              value={seniority}
              onChange={setSeniority}
              options={SENIORITY}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Format</span>
            <Segmented value={type} onChange={setType} options={TYPES} />
          </div>

          <div className="flex flex-col gap-2.5">
            <label htmlFor="company" className="text-sm font-medium">
              Target company <span className="text-fg/40">(optional)</span>
            </label>
            <input
              id="company"
              className={field}
              placeholder="e.g. Stripe"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
            <Segmented
              value={companyTypeSel}
              onChange={setCompanyTypeSel}
              options={COMPANY_TYPES}
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
                DIFFICULTY_STYLE[difficulty],
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
              {DIFFICULTY_LABEL[difficulty]} interview
            </span>
            <span className="text-xs text-fg/45">
              Tuned to your level
              {companyTypeSel ? " and target company" : ""}.
            </span>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <span className="font-mono text-[11px] uppercase tracking-widest text-fg/45">
              Tailoring
            </span>
            <span className="h-px flex-1 bg-fg/10" aria-hidden />
            <span className="text-[11px] text-fg/40">optional</span>
          </div>

          <div className="flex flex-col gap-2.5">
            <label htmlFor="resume-text" className="text-sm font-medium">
              Resume <span className="text-fg/40">(optional, recommended)</span>
            </label>
            <p className="-mt-1 text-xs text-fg/50">
              Tailors the questions to your background — and helps the interviewer
              hear your name and the tools you mention.
            </p>

            {/* The label wraps only the file input, so the textarea below stays independently focusable. */}
            <label
              onDragOver={(e) => {
                e.preventDefault();
                if (!parsing) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void handleFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-7 text-center transition-colors",
                dragging
                  ? "border-accent bg-accent/[0.06]"
                  : "border-fg/20 hover:border-fg/35 hover:bg-fg/[0.02]",
                parsing && "pointer-events-none opacity-70",
              )}
            >
              <input
                type="file"
                accept="application/pdf"
                className="sr-only"
                disabled={parsing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = ""; // allow re-selecting the same file
                  void handleFile(f);
                }}
              />
              {parsing ? (
                <>
                  <Loader2
                    className="h-5 w-5 animate-spin text-accent"
                    aria-hidden
                  />
                  <span className="text-sm font-medium">Reading your PDF…</span>
                </>
              ) : resumeFileName ? (
                <>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal/10 text-teal">
                    <FileText className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="max-w-full truncate text-sm font-medium">
                    {resumeFileName}
                  </span>
                  <span className="text-xs text-fg/50">
                    Parsed — click to replace
                  </span>
                </>
              ) : (
                <>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fg/[0.06] text-fg/55">
                    <Upload className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="text-sm font-medium">
                    Drop your resume PDF here, or{" "}
                    <span className="text-accent">browse</span>
                  </span>
                  <span className="text-xs text-fg/50">
                    PDF · max 3MB · we extract the text
                  </span>
                </>
              )}
            </label>

            <textarea
              id="resume-text"
              className={area}
              rows={4}
              maxLength={10000}
              placeholder="…or paste your resume text here. We'll tailor questions to your background."
              value={resume}
              onChange={(e) => setResume(e.target.value)}
            />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              Job description <span className="text-fg/40">(optional)</span>
            </span>
            <textarea
              className={area}
              rows={4}
              maxLength={5000}
              placeholder="Paste the role's job description. We'll aim questions at it."
              value={jd}
              onChange={(e) => setJd(e.target.value)}
            />
          </label>

          <Button
            type="submit"
            variant="accent"
            size="lg"
            className="mt-1 w-full"
            disabled={loading || role.trim().length === 0}
          >
            {loading ? "Building your plan…" : "Start interview"}
          </Button>
          {quotaHit ? (
            <div className="rounded-lg border border-teal/25 bg-teal/[0.06] p-4">
              <p className="text-sm font-medium">
                You&apos;ve used all {PLAN_LIMITS.free.monthlyInterviews} free
                interviews this month.
              </p>
              <p className="mt-1 text-sm text-fg/70">
                Pro includes unlimited interviews. Your reports and transcripts
                stay either way.
              </p>
              <div className="mt-3">
                <UpgradeButton />
              </div>
            </div>
          ) : error ? (
            <p className="text-sm text-danger">{error}</p>
          ) : null}
        </form>
      </Card>
    </main>
  );
}
