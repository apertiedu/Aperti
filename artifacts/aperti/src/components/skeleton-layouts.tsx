/**
 * Phase 33 — Skeleton screen layouts
 * Shimmer skeletons that mirror real content shapes.
 * Use instead of spinners to eliminate blank white screens.
 */
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/* ── Base shimmer wrapper ─────────────────────────────────────────────────── */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card rounded-xl border border-border shadow-sm p-5 space-y-3", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-3/5 rounded-md" />
          <Skeleton className="h-3 w-2/5 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-8 w-1/3 rounded-lg" />
    </div>
  );
}

export function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card rounded-xl border border-border shadow-sm p-4", className)}>
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="w-8 h-8 rounded-lg" />
      </div>
      <Skeleton className="h-7 w-20 rounded mb-1.5" />
      <Skeleton className="h-3 w-28 rounded" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cn("bg-card rounded-xl border border-border shadow-sm overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={`h-3 rounded ${i === 0 ? "w-32" : i === cols - 1 ? "w-20 ml-auto" : "w-24"}`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex items-center gap-4 px-4 py-3.5 border-b border-gray-50 last:border-0">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-28 rounded" />
              <Skeleton className="h-2.5 w-20 rounded" />
            </div>
          </div>
          {Array.from({ length: cols - 2 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-20 rounded ml-auto" />
          ))}
          <Skeleton className="h-6 w-16 rounded-full ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart({ className, height = 200 }: { className?: string; height?: number }) {
  return (
    <div className={cn("bg-card rounded-xl border border-border shadow-sm p-5", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-36 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <div style={{ height }} className="flex items-end gap-2 pt-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-md"
            style={{ height: `${20 + Math.random() * 70}%`, animationDelay: `${i * 0.05}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export function SkeletonForm({ fields = 4, className }: { fields?: number; className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3.5 w-24 rounded" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ))}
      <Skeleton className="h-10 w-32 rounded-xl mt-2" />
    </div>
  );
}

export function SkeletonDashboardGrid({ cards = 4, className }: { cards?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 sm:grid-cols-4", className)}>
      {Array.from({ length: cards }).map((_, i) => (
        <SkeletonStatCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonPage({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6 p-6 animate-pulse", className)}>
      <div className="space-y-2">
        <Skeleton className="h-7 w-48 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded" />
      </div>
      <SkeletonDashboardGrid cards={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonChart />
        <SkeletonChart />
      </div>
      <SkeletonTable rows={5} cols={5} />
    </div>
  );
}

export function SkeletonList({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-card rounded-xl border border-border shadow-sm px-5 py-4 flex items-center gap-4"
        >
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton className="h-4 w-1/3 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonProfile({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card rounded-xl border border-border shadow-sm p-6", className)}>
      <div className="flex items-center gap-5 mb-6">
        <Skeleton className="h-16 w-16 rounded-full flex-shrink-0" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-36 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonAnalytics({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-5", className)}>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => <SkeletonStatCard key={i} />)}
      </div>
      <div className="bg-card rounded-xl border border-border shadow-sm p-5">
        <Skeleton className="h-4 w-36 rounded mb-4" />
        <Skeleton className="h-52 w-full rounded-lg" />
      </div>
      <SkeletonTable rows={4} cols={5} />
    </div>
  );
}
