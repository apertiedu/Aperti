import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5 space-y-3", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <div className="border-b border-border p-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={`h-3.5 ${i === 0 ? "w-1/4" : "flex-1"}`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={`flex gap-4 p-3 items-center ${r < rows - 1 ? "border-b border-border/50" : ""}`}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-3 ${c === 0 ? "w-1/4" : "flex-1"} ${c === cols - 1 ? "w-16 flex-none" : ""}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

function SkeletonList({ items = 4 }: { items?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className={`h-3.5 w-${i % 2 === 0 ? "1/2" : "2/3"}`} />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-7 w-16 rounded-md shrink-0" />
        </div>
      ))}
    </div>
  );
}

function SkeletonWidget({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5 space-y-4", className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-7 w-7 rounded-lg" />
      </div>
      <Skeleton className="h-10 w-2/5" />
      <div className="flex gap-2">
        <Skeleton className="h-2 flex-1 rounded-full" />
        <Skeleton className="h-2 w-8 rounded-full" />
      </div>
    </div>
  );
}

function SkeletonPage({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-5 p-6", className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <SkeletonWidget key={i} />)}
      </div>
      <SkeletonTable rows={6} cols={5} />
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonTable, SkeletonList, SkeletonWidget, SkeletonPage };
