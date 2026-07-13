import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { feedbackReports, getDb, interviews, users } from "@maven-ai/db";
import { monthStart, PLAN_LIMITS } from "@maven-ai/shared";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UpgradeButton } from "@/components/upgrade-button";
import { STATUS_DOT, STATUS_LABEL } from "@/lib/interview-status";

export const dynamic = "force-dynamic";

// Once an interview ends it lives at its report; before that, the live room.
const REPORT_STATUSES = new Set(["processing", "ready", "failed"]);
const hrefFor = (iv: { id: string; status: string }) =>
  REPORT_STATUSES.has(iv.status)
    ? `/interview/${iv.id}/report`
    : `/interview/${iv.id}`;

// A `requested` interview has no room yet (the /token gate 403s until approved),
// so its row isn't a link — everything else routes to its report or live room.
const isClickable = (status: string) => status !== "requested";

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

const SENIORITY_LABEL: Record<string, string> = {
  intern: "Intern",
  junior: "Junior",
  mid: "Mid-level",
  senior: "Senior",
  sde1: "SDE 1",
  sde2: "SDE 2",
  sde3: "SDE 3",
};
const fmtSeniority = (s: string) => SENIORITY_LABEL[s] ?? s;

async function listInterviews(userId: string) {
  // Tolerate an unreachable/un-migrated DB so the shell still renders.
  try {
    return await getDb()
      .select({
        id: interviews.id,
        role: interviews.role,
        company: interviews.company,
        seniority: interviews.seniority,
        type: interviews.type,
        status: interviews.status,
        createdAt: interviews.createdAt,
        overallScore: feedbackReports.overallScore,
      })
      .from(interviews)
      .leftJoin(feedbackReports, eq(feedbackReports.interviewId, interviews.id))
      .where(eq(interviews.userId, userId))
      .orderBy(desc(interviews.createdAt))
      .limit(20);
  } catch {
    return [];
  }
}

async function getPlan(userId: string): Promise<string> {
  try {
    const [row] = await getDb()
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, userId));
    return row?.plan ?? "free";
  } catch {
    return "free";
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string; requested?: string }>;
}) {
  const { userId } = await auth();
  const { upgraded, requested } = await searchParams;
  const rows = userId ? await listInterviews(userId) : [];
  const plan = userId ? await getPlan(userId) : "free";
  // Just back from checkout: the webhook may lag, so trust the redirect and show Pro.
  const isPro = plan === "pro" || upgraded === "1";

  const start = monthStart();
  const usedThisMonth = rows.filter(
    (r) => r.createdAt && r.createdAt >= start,
  ).length;

  // Score trend: oldest → newest; only drawn with 2+ real scores.
  const trend = rows
    .filter((r) => r.status === "ready" && r.overallScore != null)
    .map((r) => Number(r.overallScore))
    .reverse();

  // Both stats come from the rows already loaded — no extra query. That caps them
  // at the last 20 interviews, which the cards say out loud.
  const completedCount = rows.filter((r) => r.status === "ready").length;
  const bestScore = trend.length ? Math.round(Math.max(...trend)) : null;

  // limit mirrors the enforced plan cap (entitlements.ts).
  const limit = isPro
    ? PLAN_LIMITS.pro.monthlyInterviews
    : PLAN_LIMITS.free.monthlyInterviews;
  const unlimited = !Number.isFinite(limit);
  const usagePct = Math.min(100, Math.round((usedThisMonth / limit) * 100));
  const atLimit = usedThisMonth >= limit;
  const latestScore = trend.length
    ? Math.round(trend[trend.length - 1]!)
    : null;

  return (
    <main className="mx-auto max-w-5xl px-6 pb-16">
      <TopBar
        right={
          <>
            {!isPro && <UpgradeButton />}
            <UserButton />
          </>
        }
      />

      {upgraded === "1" ? (
        <Card className="mt-6 flex items-center gap-3 py-4">
          <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
          <p className="text-sm text-fg/80">
            You&apos;re on Pro — unlimited interviews from here.
          </p>
        </Card>
      ) : null}

      {requested === "1" ? (
        <Card className="mt-6 flex items-center gap-3 py-4">
          <span className="h-2 w-2 shrink-0 rounded-full bg-amber" aria-hidden />
          <p className="text-sm text-fg/80">
            Request submitted — your plan is ready. You can start the interview
            once it&apos;s approved.
          </p>
        </Card>
      ) : null}

      <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-fg/50">
            Sessions
          </p>
          <h1 className="mt-2 font-display font-medium text-4xl tracking-tight">
            Your interviews
          </h1>
        </div>
        {/* At the free cap, the primary CTA goes straight to Razorpay checkout
            instead of a setup form the API would 402. */}
        {atLimit && !isPro ? (
          <UpgradeButton />
        ) : (
          <Link
            href="/interview/new"
            className={buttonVariants({ variant: "accent" })}
          >
            Start new interview
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <Card className="mt-8 py-16 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-fg/50">
            {unlimited
              ? "Unlimited interviews on Pro"
              : `${limit - usedThisMonth} of ${limit} free interviews left this month`}
          </p>
          <h2 className="mt-3 font-display font-medium text-3xl tracking-tight">
            Run your first interview
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-fg/70">
            Pick a role, talk for ten minutes, and get a scored report with the
            full transcript. That&apos;s the whole loop.
          </p>
          <Link
            href="/interview/new"
            className={`${buttonVariants({ variant: "accent", size: "lg" })} mt-6`}
          >
            Start an interview
          </Link>
        </Card>
      ) : (
        <>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Card>
              <p className="font-mono text-xs uppercase tracking-widest text-fg/50">
                This month
              </p>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display font-medium text-4xl tracking-tight">
                  {usedThisMonth}
                </span>
                <span className="text-sm text-fg/50">
                  {unlimited
                    ? "interviews · unlimited on Pro"
                    : `/ ${limit} free interviews`}
                </span>
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-fg/10">
                <div
                  className={`h-full rounded-full transition-all ${atLimit && !unlimited ? "bg-amber" : "bg-accent"}`}
                  style={{ width: unlimited ? "100%" : `${usagePct}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-fg/50">
                {unlimited
                  ? "Pro plan · no monthly cap"
                  : atLimit
                    ? "You've used every free interview this month."
                    : `${limit - usedThisMonth} left · resets on the 1st`}
              </p>
            </Card>

            <Card>
              <p className="font-mono text-xs uppercase tracking-widest text-fg/50">
                Score trend
              </p>
              {trend.length >= 2 && latestScore != null ? (
                <>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-display font-medium text-4xl tracking-tight text-accent">
                      {latestScore}
                    </span>
                    <span className="text-sm text-fg/50">/ 100 latest</span>
                  </div>
                  <svg
                    className="mt-4 h-12 w-full"
                    viewBox="0 0 100 40"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label={`Scores over your last ${trend.length} interviews, latest ${latestScore}`}
                  >
                    <polyline
                      points={trend
                        .map(
                          (s, i) =>
                            `${(i / (trend.length - 1)) * 100},${36 - (Math.min(Math.max(s, 0), 100) / 100) * 32}`,
                        )
                        .join(" ")}
                      fill="none"
                      className="stroke-accent"
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                </>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-fg/60">
                  Finish a couple of scored interviews and your progress shows up
                  here.
                </p>
              )}
            </Card>

            <Card>
              <p className="font-mono text-xs uppercase tracking-widest text-fg/50">
                Best score
              </p>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display font-medium text-4xl tracking-tight">
                  {bestScore ?? "—"}
                </span>
                <span className="text-sm text-fg/50">
                  {bestScore == null ? "no scored interviews yet" : "/ 100"}
                </span>
              </div>
              <p className="mt-3 text-xs text-fg/50">
                Your highest across the interviews below.
              </p>
            </Card>

            <Card>
              <p className="font-mono text-xs uppercase tracking-widest text-fg/50">
                Completed
              </p>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display font-medium text-4xl tracking-tight">
                  {completedCount}
                </span>
                <span className="text-sm text-fg/50">
                  {completedCount === 1 ? "scored report" : "scored reports"}
                </span>
              </div>
              <p className="mt-3 text-xs text-fg/50">
                Interviews you finished and got graded.
              </p>
            </Card>
          </div>

          <Card className="mt-5 divide-y divide-fg/10 p-0">
            {rows.map((iv) => {
              const rowClass =
                "flex items-center justify-between gap-4 px-6 py-4";
              const inner = (
                <>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{iv.role}</p>
                    <p className="mt-0.5 font-mono text-xs uppercase tracking-wide text-fg/50">
                      {fmtSeniority(iv.seniority)} · {iv.type.replace(/_/g, " ")}
                      {iv.company ? ` · ${iv.company}` : ""}
                      {iv.createdAt ? ` · ${fmtDate(iv.createdAt)}` : ""}
                    </p>
                  </div>
                  {iv.status === "ready" && iv.overallScore != null ? (
                    <span className="shrink-0 font-mono text-lg font-semibold text-accent">
                      {Math.round(Number(iv.overallScore))}
                      <span className="text-xs font-normal text-fg/40">/100</span>
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-2 font-mono text-xs uppercase tracking-wide text-fg/60">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[iv.status] ?? "bg-fg/30"}`}
                      />
                      {STATUS_LABEL[iv.status] ?? iv.status}
                    </span>
                  )}
                </>
              );
              return isClickable(iv.status) ? (
                <Link
                  key={iv.id}
                  href={hrefFor(iv)}
                  className={`${rowClass} transition-colors hover:bg-fg/[0.03]`}
                >
                  {inner}
                </Link>
              ) : (
                <div key={iv.id} className={rowClass}>
                  {inner}
                </div>
              );
            })}
          </Card>
        </>
      )}
    </main>
  );
}
