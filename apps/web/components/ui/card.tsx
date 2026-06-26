import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-card border border-ink/10 bg-white p-6 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
