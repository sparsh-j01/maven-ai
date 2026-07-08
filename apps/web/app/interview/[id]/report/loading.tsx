import { TopBar } from "@/components/top-bar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the report shell: heading, score hero, transcript block.
export default function ReportLoading() {
  return (
    <main className="mx-auto max-w-3xl px-6 pb-16">
      <TopBar />
      <div className="mt-10">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-9 w-64" />
        <Skeleton className="mt-3 h-3 w-40" />
      </div>
      <div className="mt-8 flex flex-col gap-6">
        <Card className="flex items-center gap-8">
          <Skeleton className="h-12 w-24" />
          <div className="flex-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-3/4" />
          </div>
        </Card>
        <Card className="flex flex-col gap-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-3 w-10 shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-2 h-4 w-full" />
                <Skeleton className="mt-1.5 h-4 w-2/3" />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </main>
  );
}
