import { TopBar } from "@/components/top-bar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the dashboard layout so the swap to real content doesn't jump.
export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-3xl px-6 pb-16">
      <TopBar />
      <div className="mt-10 flex items-end justify-between">
        <div>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-9 w-56" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <Card className="mt-8 divide-y divide-fg/10 p-0">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between px-6 py-4">
            <div>
              <Skeleton className="h-4 w-44" />
              <Skeleton className="mt-2 h-3 w-32" />
            </div>
            <Skeleton className="h-5 w-14" />
          </div>
        ))}
      </Card>
    </main>
  );
}
