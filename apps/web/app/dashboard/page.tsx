import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { interviews } from "@maven-ai/db";
import { getDb } from "@maven-ai/db";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type InterviewRow = typeof interviews.$inferSelect;

async function listInterviews(userId: string): Promise<InterviewRow[]> {
  // ponytail: tolerate an un-migrated/unreachable DB so the shell renders
  // before `pnpm db:push` has run. Remove the catch once migrations are wired.
  try {
    return await getDb()
      .select()
      .from(interviews)
      .where(eq(interviews.userId, userId))
      .orderBy(desc(interviews.createdAt))
      .limit(20);
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const { userId } = await auth();
  const rows = userId ? await listInterviews(userId) : [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex items-center justify-between">
        <Link
          href="/"
          className="font-mono text-sm font-semibold tracking-tight"
        >
          maven<span className="text-teal">.ai</span>
        </Link>
        <UserButton />
      </header>

      <div className="mt-10 flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Your interviews</h1>
        <Link href="/interview/new">
          <Button variant="accent">Start new interview</Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <Card className="mt-8 text-center">
          <h2 className="text-xl font-medium">Run your first interview</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink/70">
            Pick a role, talk for ten minutes, and get a scored report with the
            full transcript. That&apos;s the whole loop.
          </p>
          <Link href="/interview/new" className="mt-5 inline-block">
            <Button variant="accent" size="lg">
              Start an interview
            </Button>
          </Link>
        </Card>
      ) : (
        <ul className="mt-8 grid gap-3">
          {rows.map((iv) => (
            <li key={iv.id}>
              <Link href={`/interview/${iv.id}`}>
                <Card className="flex items-center justify-between py-4 transition-colors hover:bg-ink/[0.02]">
                  <div>
                    <p className="font-medium">{iv.role}</p>
                    <p className="text-sm text-ink/60">
                      {iv.seniority} · {iv.type}
                      {iv.company ? ` · ${iv.company}` : ""}
                    </p>
                  </div>
                  <span className="font-mono text-xs uppercase tracking-wide text-ink/50">
                    {iv.status}
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
