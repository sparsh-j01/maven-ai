import { auth } from "@clerk/nextjs/server";
import { getDb, interviews, users } from "@maven-ai/db";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/top-bar";
import { Card } from "@/components/ui/card";
import { isAdmin } from "@/lib/admin";
import { ApproveButton } from "./approve-button";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date) =>
  d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

async function listPending() {
  return getDb()
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
}

// Admin-only queue of interview requests waiting to be approved. Non-admins (and
// signed-out users) get a 404 — the page doesn't exist for them.
export default async function AdminPage() {
  const { userId } = await auth();
  if (!isAdmin(userId)) notFound();

  const pending = await listPending();

  return (
    <main className="mx-auto max-w-3xl px-6 pb-16">
      <TopBar />

      <div className="mt-10">
        <p className="font-mono text-xs uppercase tracking-widest text-fg/50">
          Admin
        </p>
        <h1 className="mt-2 font-display font-medium text-4xl tracking-tight">
          Interview requests
        </h1>
        <p className="mt-3 text-sm text-fg/70">
          Approving lets the candidate start the live voice session, which spends
          API credits. {pending.length} waiting.
        </p>
      </div>

      {pending.length === 0 ? (
        <Card className="mt-8 py-16 text-center text-fg/60">
          Nothing waiting. New requests show up here.
        </Card>
      ) : (
        <Card className="mt-8 divide-y divide-fg/10 p-0">
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
    </main>
  );
}
