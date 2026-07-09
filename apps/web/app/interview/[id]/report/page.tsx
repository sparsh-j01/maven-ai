import { auth } from "@clerk/nextjs/server";
import {
  codeSubmissions,
  feedbackReports,
  getDb,
  interviews,
  interviewTurns,
  users,
} from "@maven-ai/db";
import { RUBRIC_DIMENSIONS, type RubricScores } from "@maven-ai/shared";
import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { RubricRadar } from "@/components/rubric-radar";
import { RetryScoring, ScoreKicker } from "@/components/score-kicker";
import { TopBar } from "@/components/top-bar";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UpgradeButton } from "@/components/upgrade-button";

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

// The readiness verdict shown alongside the 0–100 score.
const readinessBand = (n: number) =>
  n >= 80
    ? "Interview-ready"
    : n >= 65
      ? "Nearly there"
      : n >= 45
        ? "Getting there"
        : "Needs work";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) notFound();
  const { id } = await params;
  const db = getDb();

  // Ownership-scoped — you can only read your own report (no IDOR).
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

  // Pro gates the AI-coach study plan (same model as model answers).
  const [u] = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId));
  const isPro = u?.plan === "pro";

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

  // Not finished yet: send the user back to the room, not an empty report.
  if (iv.status === "provisioning" || iv.status === "live") {
    return (
      <Shell role={iv.role} sub={subtitle(iv)}>
        <Card className="text-center">
          <p className="text-fg/70">This interview hasn&apos;t finished yet.</p>
          <Link
            href={`/interview/${id}`}
            className={`${buttonVariants({ variant: "accent" })} mt-4`}
          >
            Back to the interview
          </Link>
        </Card>
      </Shell>
    );
  }

  const ready = iv.status === "ready" && report;
  const overall = report?.overallScore != null ? Number(report.overallScore) : null;

  return (
    <Shell role={iv.role} sub={subtitle(iv)}>
      {ready && overall != null ? (
        <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
          <div className="shrink-0">
            <p className="font-mono text-[11px] uppercase tracking-widest text-fg/50">
              Interview readiness
            </p>
            <div className="mt-1 flex items-baseline gap-1">
              <span
                className={`font-mono text-5xl font-semibold ${scoreColor(overall)}`}
              >
                {Math.round(overall)}
              </span>
              <span className="font-mono text-fg/40">/100</span>
            </div>
            <p className={`mt-1 text-sm font-medium ${scoreColor(overall)}`}>
              {readinessBand(overall)}
            </p>
          </div>
          <p className="font-serif text-lg leading-relaxed text-fg/80">
            {report.summary}
          </p>
        </Card>
      ) : iv.status === "failed" ? (
        <Card className="flex flex-col items-start gap-3">
          <p className="text-fg/80">
            Scoring didn&apos;t complete. Your transcript is safe below; you can
            retry.
          </p>
          <RetryScoring interviewId={id} />
        </Card>
      ) : (
        <Card className="flex items-center gap-3">
          <ScoreKicker interviewId={id} />
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber" />
          <p className="text-fg/70">
            Scoring your interview… this takes a few seconds.
          </p>
        </Card>
      )}

      {ready && report.rubricScores ? (
        <Card className="grid items-center gap-6 sm:grid-cols-2">
          <div className="flex justify-center">
            <RubricRadar scores={report.rubricScores} />
          </div>
          <RubricBars scores={report.rubricScores} />
        </Card>
      ) : null}

      {ready && (report.strengths?.length || report.gaps?.length) ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Bullets title="Strengths" items={report.strengths} accent="teal" />
          <Bullets title="What to work on" items={report.gaps} accent="amber" />
        </div>
      ) : null}

      {ready && report.modelAnswers?.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display font-medium text-2xl tracking-tight">
            What a great answer looks like
          </h2>
          {report.modelAnswers.map((m, i) => (
            <Card key={i}>
              <p className="text-sm font-medium text-fg">{m.question}</p>
              <p className="mt-3 rounded bg-fg/[0.03] p-4 font-serif text-lg leading-relaxed text-fg/80">
                {m.whatGreatLooksLike}
              </p>
            </Card>
          ))}
        </section>
      ) : null}

      {ready && report.studyPlan?.length ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-medium text-2xl tracking-tight">
              Your AI coach
            </h2>
            <span className="rounded-full bg-accent/12 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-accent">
              Pro
            </span>
          </div>
          {isPro ? (
            <div className="flex flex-col gap-3">
              {report.studyPlan.map((s, i) => (
                <Card key={i} className="flex gap-4">
                  <span className="shrink-0 font-mono text-sm text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-medium text-fg">{s.focus}</h3>
                    <p className="mt-1 text-sm text-fg/60">{s.why}</p>
                    <ul className="mt-3 flex flex-col gap-2">
                      {s.actions.map((a, j) => (
                        <li key={j} className="flex gap-2 text-sm text-fg/80">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="flex flex-col items-start gap-4">
              <ul className="flex select-none flex-col gap-1.5 blur-[3px]" aria-hidden>
                {report.studyPlan.map((s, i) => (
                  <li key={i} className="text-sm text-fg/80">
                    {String(i + 1).padStart(2, "0")} · {s.focus}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-fg/70">
                Your AI coach turned this interview into a{" "}
                {report.studyPlan.length}-part study plan — the exact topics and
                drills to close your gaps before the real thing. Unlock it with
                Pro.
              </p>
              <UpgradeButton />
            </Card>
          )}
        </section>
      ) : null}

      {lastSubmission ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display font-medium text-2xl tracking-tight">Coding round</h2>
          <Card className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs uppercase tracking-wide text-fg/50">
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
                <span className="text-xs text-fg/40">
                  {submissions.length} runs
                </span>
              ) : null}
            </div>
            <pre className="overflow-auto rounded bg-fg/[0.03] p-4 font-mono text-[13px] leading-relaxed text-fg/90">
              {lastSubmission.code}
            </pre>
            {lastSubmission.execStdout ? (
              <div>
                <span className="text-xs uppercase tracking-wide text-fg/40">
                  Output
                </span>
                <pre className="mt-1 overflow-auto rounded bg-fg/[0.03] p-3 font-mono text-xs text-fg/70">
                  {lastSubmission.execStdout}
                </pre>
              </div>
            ) : null}
          </Card>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-display font-medium text-2xl tracking-tight">Transcript</h2>
        {turns.length === 0 ? (
          <p className="text-sm text-fg/50">No transcript was recorded.</p>
        ) : (
          <Card className="flex flex-col gap-5">
            {turns.map((t, i) => (
              <div key={i} className="flex gap-4">
                <span className="w-10 shrink-0 pt-1 font-mono text-xs text-fg/40">
                  {fmtTime(t.tsStartMs)}
                </span>
                <div>
                  <span
                    className={`font-mono text-xs uppercase tracking-widest ${
                      t.speaker === "candidate" ? "text-teal" : "text-fg/40"
                    }`}
                  >
                    {t.speaker === "candidate" ? "You" : "Interviewer"}
                  </span>
                  <p className="mt-0.5 font-serif text-lg leading-relaxed text-fg/90">
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
          <Link
            href="/interview/new"
            className={buttonVariants({ variant: "accent" })}
          >
            Practice again
          </Link>
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "outline" })}
          >
            Back to dashboard
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
  return `${iv.seniority} · ${iv.type.replace(/_/g, " ")}${iv.company ? ` · ${iv.company}` : ""}${ct}`;
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
    <main className="mx-auto max-w-3xl px-6 pb-16">
      <TopBar
        right={
          <Link
            href="/dashboard"
            className="text-sm text-fg/50 transition-colors hover:text-fg"
          >
            Dashboard
          </Link>
        }
      />
      <div className="mt-10">
        <p className="font-mono text-xs uppercase tracking-widest text-fg/50">
          Interview report
        </p>
        <h1 className="mt-2 font-display font-medium text-4xl tracking-tight">{role}</h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-wide text-fg/50">
          {sub}
        </p>
      </div>
      <div className="mt-8 flex flex-col gap-6">{children}</div>
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
              <span className="text-fg/80">{humanize(d)}</span>
              <span className="font-mono text-fg/50">{v.toFixed(1)}</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-fg/10">
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
          <li key={i} className="flex gap-2 text-sm text-fg/80">
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
