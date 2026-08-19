import { auth } from "@clerk/nextjs/server";
import { feedbackReports, getDb, interviews, users } from "@maven-ai/db";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/top-bar";
import { Card } from "@/components/ui/card";
import { isAdmin } from "@maven-ai/shared/admin";
import { STATUS_DOT, STATUS_LABEL } from "@/lib/interview-status";
import { ApproveButton } from "./approve-button";

export const dynamic = "force-dynamic";

// ponytail: a rolling 7-day window, not a calendar week — no date helper, no
// timezone edges. Ops wants "recently", not "since Monday".
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const fmtDate = (d: Date) =>
  d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

async function listPending() {
  try {
    return await getDb()
      .select({
        id: interviews.id,
        email: users.email,
        role: interviews.role,
        seniority: interviews.seniority,
        type: interviews.type,
        createdAt: interviews.createdAt,
      })
      .from(interviews)
      .innerJoin(users, eq(users.id, interviews.userId))
      .where(eq(interviews.status, "requested"))
      .orderBy(asc(interviews.createdAt))
      .limit(100);
  } catch {
    return [];
  }
}

// Ops numbers across every user. No user input reaches these — they're constant
// SELECTs, so there's nothing to inject into. An unreachable DB renders zeros
// rather than a 500.
async function adminMetrics() {
  try {
    const db = getDb();
    const [byStatus, [week]] = await Promise.all([
      db
        .select({
          status: interviews.status,
          n: sql<number>`count(*)::int`,
        })
        .from(interviews)
        .groupBy(interviews.status),
      db
        .select({
          n: sql<number>`count(*)::int`,
          avgScore: sql<number | null>`avg(${feedbackReports.overallScore})::float`,
        })
        .from(interviews)
        .innerJoin(
          feedbackReports,
          eq(feedbackReports.interviewId, interviews.id),
        )
        .where(
          and(
            eq(interviews.status, "ready"),
            gte(interviews.createdAt, new Date(Date.now() - WEEK_MS)),
          ),
        ),
    ]);

    const count = (s: string) => byStatus.find((r) => r.status === s)?.n ?? 0;
    return {
      pending: count("requested"),
      // "In flight" = a session that's live or spinning up.
      live: count("live") + count("provisioning"),
      scoring: count("processing"),
      readyAllTime: count("ready"),
      total: byStatus.reduce((sum, r) => sum + r.n, 0),
      completedThisWeek: week?.n ?? 0,
      avgScoreThisWeek:
        week?.avgScore != null ? Math.round(week.avgScore) : null,
    };
  } catch {
    return {
      pending: 0,
      live: 0,
      scoring: 0,
      readyAllTime: 0,
      total: 0,
      completedThisWeek: 0,
      avgScoreThisWeek: null,
    };
  }
}

async function recentActivity() {
  try {
    return await getDb()
      .select({
        id: interviews.id,
        email: users.email,
        role: interviews.role,
        type: interviews.type,
        status: interviews.status,
        createdAt: interviews.createdAt,
        overallScore: feedbackReports.overallScore,
      })
      .from(interviews)
      .innerJoin(users, eq(users.id, interviews.userId))
      .leftJoin(feedbackReports, eq(feedbackReports.interviewId, interviews.id))
      .orderBy(desc(interviews.createdAt))
      .limit(20);
  } catch {
    return [];
  }
}

function Stat({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: number | string;
  unit?: string;
  note: string;
}) {
  return (
    <Card>
      <p className="font-mono text-xs uppercase tracking-widest text-fg/50">
        {label}
      </p>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-display font-medium text-4xl tracking-tight">
          {value}
        </span>
        {unit ? <span className="text-sm text-fg/50">{unit}</span> : null}
      </div>
      <p className="mt-3 text-xs text-fg/50">{note}</p>
    </Card>
  );
}

// Admin-only: ops metrics, the interview-request queue, and a live activity feed.
// Non-admins (and signed-out users) get a 404 — the page doesn't exist for them.
export default async function AdminPage() {
  const { userId } = await auth();
  if (!isAdmin(userId)) notFound();

  const [pending, metrics, recent] = await Promise.all([
    listPending(),
    adminMetrics(),
    recentActivity(),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 pb-16">
      <TopBar />

      <div className="mt-10">
        <p className="font-mono text-xs uppercase tracking-widest text-fg/50">
          Admin
        </p>
        <h1 className="mt-2 font-display font-medium text-4xl tracking-tight">
          Operations
        </h1>
        <p className="mt-3 text-sm text-fg/70">
          Approving lets the candidate start the live voice session, which spends
          API credits. {metrics.total} interviews all-time.
        </p>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Pending"
          value={metrics.pending}
          note={
            metrics.pending === 0 ? "Nothing waiting." : "Waiting on your approval."
          }
        />
        <Stat
          label="In flight"
          value={metrics.live}
          note={
            metrics.scoring > 0
              ? `${metrics.scoring} more being scored.`
              : "Live or starting up."
          }
        />
        <Stat
          label="Completed"
          value={metrics.completedThisWeek}
          note={`Last 7 days · ${metrics.readyAllTime} all-time.`}
        />
        <Stat
          label="Avg score"
          value={metrics.avgScoreThisWeek ?? "—"}
          unit={metrics.avgScoreThisWeek == null ? undefined : "/ 100"}
          note={
            metrics.avgScoreThisWeek == null
              ? "No reports in the last 7 days."
              : "Across the last 7 days."
          }
        />
      </div>

      <h2 className="mt-12 font-display font-medium text-2xl tracking-tight">
        Interview requests
      </h2>

      {pending.length === 0 ? (
        <Card className="mt-5 py-16 text-center text-fg/60">
          Nothing waiting. New requests show up here.
        </Card>
      ) : (
        <Card className="mt-5 divide-y divide-fg/10 p-0">
          {pending.map((iv) => (
            <div
              key={iv.id}
              className="flex items-center justify-between gap-4 px-6 py-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {iv.role}{" "}
                  <span className="font-normal text-fg/50">· {iv.email}</span>
                </p>
                <p className="mt-0.5 font-mono text-xs uppercase tracking-wide text-fg/50">
                  {iv.seniority} · {iv.type.replace(/_/g, " ")}
                  {iv.createdAt ? ` · ${fmtDate(iv.createdAt)}` : ""}
                </p>
              </div>
              <ApproveButton id={iv.id} />
            </div>
          ))}
        </Card>
      )}

      <h2 className="mt-12 font-display font-medium text-2xl tracking-tight">
        Recent activity
      </h2>

      {recent.length === 0 ? (
        <Card className="mt-5 py-16 text-center text-fg/60">
          No interviews yet.
        </Card>
      ) : (
        <Card className="mt-5 divide-y divide-fg/10 p-0">
          {recent.map((iv) => (
            <div
              key={iv.id}
              className="flex items-center justify-between gap-4 px-6 py-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {iv.role}{" "}
                  <span className="font-normal text-fg/50">· {iv.email}</span>
                </p>
                <p className="mt-0.5 font-mono text-xs uppercase tracking-wide text-fg/50">
                  {iv.type.replace(/_/g, " ")}
                  {iv.createdAt ? ` · ${fmtDate(iv.createdAt)}` : ""}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-3">
                {iv.status === "ready" && iv.overallScore != null ? (
                  <span className="font-mono text-lg font-semibold text-accent">
                    {Math.round(Number(iv.overallScore))}
                    <span className="text-xs font-normal text-fg/40">/100</span>
                  </span>
                ) : null}
                <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-fg/60">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[iv.status] ?? "bg-fg/30"}`}
                  />
                  {STATUS_LABEL[iv.status] ?? iv.status}
                </span>
              </span>
            </div>
          ))}
        </Card>
      )}
    </main>
  );
}
