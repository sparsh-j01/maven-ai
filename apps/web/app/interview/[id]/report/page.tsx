import { auth } from "@clerk/nextjs/server";
import {
  codeSubmissions,
  feedbackReports,
  getDb,
  interviews,
  interviewTurns,
} from "@maven-ai/db";
import { RUBRIC_DIMENSIONS, type RubricScores } from "@maven-ai/shared";
import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { RubricRadar } from "@/components/rubric-radar";
import { RetryScoring, ScoreKicker } from "@/components/score-kicker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const humanize = (d: string) => {
  const s = d.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const fmtTime = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const scoreColor = (n: number) =>
  n >= 70 ? "text-teal" : n >= 40 ? "text-amber" : "text-danger";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) notFound();
  const { id } = await params;
  const db = getDb();

  // Ownership-scoped — you can only read your own report (no IDOR, §8).
  const [iv] = await db
    .select({
      role: interviews.role,
      company: interviews.company,
      companyType: interviews.companyType,
      seniority: interviews.seniority,
      type: interviews.type,
      status: interviews.status,
    })
    .from(interviews)
    .where(and(eq(interviews.id, id), eq(interviews.userId, userId)));
  if (!iv) notFound();

  const [report] = await db
    .select()
    .from(feedbackReports)
    .where(eq(feedbackReports.interviewId, id))
    .limit(1);

  const turns = await db
    .select({
      speaker: interviewTurns.speaker,
      text: interviewTurns.text,
      tsStartMs: interviewTurns.tsStartMs,
      phase: interviewTurns.phase,
    })
    .from(interviewTurns)
    .where(eq(interviewTurns.interviewId, id))
    .orderBy(asc(interviewTurns.tsStartMs));

  // Coding round submissions, oldest → newest; the last is the candidate's final
  // attempt. The scorer already factored these in; this surfaces them.
  const submissions = await db
    .select({
      language: codeSubmissions.language,
      code: codeSubmissions.code,
      execStdout: codeSubmissions.execStdout,
      execPassed: codeSubmissions.execPassed,
    })
    .from(codeSubmissions)
    .where(eq(codeSubmissions.interviewId, id))
    .orderBy(asc(codeSubmissions.createdAt));
  const lastSubmission = submissions.at(-1);

  // An interview that hasn't finished doesn't have a report yet — send the user
  // back to the room rather than showing an empty report.
  if (iv.status === "provisioning" || iv.status === "live") {
    return (
      <Shell role={iv.role} sub={subtitle(iv)}>
        <Card className="text-center">
          <p className="text-ink/70">This interview hasn&apos;t finished yet.</p>
          <Link href={`/interview/${id}`} className="mt-4 inline-block">
            <Button variant="accent">Back to the interview</Button>
          </Link>
        </Card>
      </Shell>
    );
  }

  const ready = iv.status === "ready" && report;
  const overall = report?.overallScore != null ? Number(report.overallScore) : null;

  return (
    <Shell role={iv.role} sub={subtitle(iv)}>
      {/* Score / status hero. */}
      {ready && overall != null ? (
        <Card className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
          <div className="shrink-0">
            <span className={`font-mono text-5xl font-semibold ${scoreColor(overall)}`}>
              {Math.round(overall)}
            </span>
            <span className="font-mono text-ink/40">/100</span>
          </div>
          <p className="text-ink/80">{report.summary}</p>
        </Card>
      ) : iv.status === "failed" ? (
        <Card className="flex flex-col items-start gap-3">
          <p className="text-ink/80">
            Scoring didn&apos;t complete. Your transcript is safe below — you can
            retry.
          </p>
          <RetryScoring interviewId={id} />
        </Card>
      ) : (
        <Card className="flex items-center gap-3">
          {/* processing: kick + poll, transcript shown immediately (§7.5). */}
          <ScoreKicker interviewId={id} />
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber" />
          <p className="text-ink/70">
            Scoring your interview… this takes a few seconds.
          </p>
        </Card>
      )}

      {/* Rubric: radar + per-competency breakdown. */}
      {ready && report.rubricScores ? (
        <Card className="grid items-center gap-6 sm:grid-cols-2">
          <div className="flex justify-center">
            <RubricRadar scores={report.rubricScores} />
          </div>
          <RubricBars scores={report.rubricScores} />
        </Card>
      ) : null}

      {/* Strengths / gaps. */}
      {ready && (report.strengths?.length || report.gaps?.length) ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Bullets title="Strengths" items={report.strengths} accent="teal" />
          <Bullets title="What to work on" items={report.gaps} accent="amber" />
        </div>
      ) : null}

      {/* Model answers for weak spots. */}
      {ready && report.modelAnswers?.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            What a great answer looks like
          </h2>
          {report.modelAnswers.map((m, i) => (
            <Card key={i}>
              <p className="text-sm font-medium text-ink">{m.question}</p>
              <p className="mt-2 text-sm text-ink/70">{m.whatGreatLooksLike}</p>
            </Card>
          ))}
        </section>
      ) : null}

      {/* Coding round — the candidate's final submission + the sandbox verdict. */}
      {lastSubmission ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Coding round</h2>
          <Card className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs uppercase tracking-wide text-ink/50">
                {lastSubmission.language}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  lastSubmission.execPassed
                    ? "bg-teal/10 text-teal"
                    : "bg-amber/10 text-amber"
                }`}
              >
                {lastSubmission.execPassed ? "Passed" : "Did not pass"}
              </span>
              {submissions.length > 1 ? (
                <span className="text-xs text-ink/40">
                  {submissions.length} runs
                </span>
              ) : null}
            </div>
            <pre className="overflow-auto rounded-lg bg-ink/[0.03] p-4 font-mono text-[13px] leading-relaxed text-ink/90">
              {lastSubmission.code}
            </pre>
            {lastSubmission.execStdout ? (
              <div>
                <span className="text-xs uppercase tracking-wide text-ink/40">
                  Output
                </span>
                <pre className="mt-1 overflow-auto rounded-lg bg-ink/[0.03] p-3 font-mono text-xs text-ink/70">
                  {lastSubmission.execStdout}
                </pre>
              </div>
            ) : null}
          </Card>
        </section>
      ) : null}

      {/* Transcript — shown in every state. ponytail: timestamped + seekable
          text now; audio scrub lands when call recordings ship (R2). */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Transcript</h2>
        {turns.length === 0 ? (
          <p className="text-sm text-ink/50">No transcript was recorded.</p>
        ) : (
          <Card className="flex flex-col gap-4">
            {turns.map((t, i) => (
              <div key={i} className="flex gap-3">
                <span className="w-10 shrink-0 pt-0.5 font-mono text-xs text-ink/40">
                  {fmtTime(t.tsStartMs)}
                </span>
                <div>
                  <span className="text-xs uppercase tracking-wide text-ink/40">
                    {t.speaker === "candidate" ? "You" : "Interviewer"}
                  </span>
                  <p className="text-[15px] leading-relaxed text-ink/90">
                    {t.text}
                  </p>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>

      {ready ? (
        <div className="flex flex-wrap gap-3">
          <Link href="/interview/new">
            <Button variant="accent">Practice again</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        </div>
      ) : null}
    </Shell>
  );
}

const COMPANY_TYPE_LABEL: Record<string, string> = {
  product: "product-based",
  service: "service-based",
  startup: "startup",
};

function subtitle(iv: {
  seniority: string;
  type: string;
  company: string | null;
  companyType: string | null;
}) {
  const ct = iv.companyType ? ` · ${COMPANY_TYPE_LABEL[iv.companyType] ?? iv.companyType}` : "";
  return `${iv.seniority} · ${iv.type}${iv.company ? ` · ${iv.company}` : ""}${ct}`;
}

function Shell({
  role,
  sub,
  children,
}: {
  role: string;
  sub: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex items-center justify-between">
        <Link href="/dashboard" className="font-mono text-sm font-semibold tracking-tight">
          maven<span className="text-teal">.ai</span>
        </Link>
        <Link href="/dashboard" className="text-sm text-ink/50 hover:text-ink">
          Dashboard
        </Link>
      </header>
      <div className="mt-8">
        <h1 className="text-3xl font-semibold tracking-tight">{role}</h1>
        <p className="mt-1 text-sm text-ink/60">{sub}</p>
      </div>
      <div className="mt-6 flex flex-col gap-6">{children}</div>
    </main>
  );
}

function RubricBars({ scores }: { scores: RubricScores }) {
  return (
    <ul className="flex flex-col gap-3">
      {RUBRIC_DIMENSIONS.map((d) => {
        const v = scores[d] ?? 0;
        return (
          <li key={d}>
            <div className="flex justify-between text-sm">
              <span className="text-ink/80">{humanize(d)}</span>
              <span className="font-mono text-ink/50">{v.toFixed(1)}</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-ink/10">
              <div
                className="h-full rounded-full bg-teal"
                style={{ width: `${(Math.min(Math.max(v, 0), 10) / 10) * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Bullets({
  title,
  items,
  accent,
}: {
  title: string;
  items: string[] | null;
  accent: "teal" | "amber";
}) {
  if (!items?.length) return null;
  return (
    <Card>
      <h3 className="font-medium">{title}</h3>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm text-ink/80">
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                accent === "teal" ? "bg-teal" : "bg-amber"
              }`}
            />
            {it}
          </li>
        ))}
      </ul>
    </Card>
  );
}
