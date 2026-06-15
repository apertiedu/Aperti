import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  className?: string;
  lines?: number;
  hasHeader?: boolean;
  hasAvatar?: boolean;
  hasFooter?: boolean;
  padding?: "sm" | "md" | "lg";
}

export function SkeletonCard({
  className,
  lines = 3,
  hasHeader = true,
  hasAvatar = false,
  hasFooter = false,
  padding = "md",
}: SkeletonCardProps) {
  const padClass = { sm: "p-4", md: "p-5", lg: "p-6" }[padding];

  return (
    <div className={cn("bg-card border border-border/40 rounded-xl shadow-sm", padClass, className)}>
      {hasHeader && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {hasAvatar && <div className="h-9 w-9 rounded-full skeleton shrink-0" />}
            <div className="space-y-1.5">
              <div className="h-3.5 skeleton rounded-full w-32" />
              <div className="h-2.5 skeleton rounded-full w-20" />
            </div>
          </div>
          <div className="h-7 w-16 skeleton rounded-lg" />
        </div>
      )}
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 skeleton rounded-full"
            style={{
              width: i === lines - 1 ? "60%" : `${100 - i * 8}%`,
              animationDelay: `${i * 80}ms`,
            }}
          />
        ))}
      </div>
      {hasFooter && (
        <div className="mt-4 pt-3 border-t border-border/30 flex items-center gap-2">
          <div className="h-7 w-20 skeleton rounded-lg" />
          <div className="h-7 w-16 skeleton rounded-lg" />
        </div>
      )}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-card border border-border/40 rounded-xl overflow-hidden shadow-sm">
      <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="px-4 py-3 border-b border-border/40 bg-muted/30">
            <div className="h-2.5 skeleton rounded-full w-20" />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, ri) => (
        <div
          key={ri}
          className="grid border-b border-border/20 last:border-0"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, opacity: 1 - ri * 0.08 }}
        >
          {Array.from({ length: cols }).map((_, ci) => (
            <div key={ci} className="px-4 py-3.5">
              <div
                className="h-3 skeleton rounded-full"
                style={{ width: ci === 0 ? "80%" : `${65 - ci * 8}%`, animationDelay: `${(ri * cols + ci) * 40}ms` }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 skeleton rounded-full w-48" />
          <div className="h-3.5 skeleton rounded-full w-32" />
        </div>
        <div className="h-9 w-32 skeleton rounded-xl" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border/40 rounded-xl p-4 space-y-3" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center justify-between">
              <div className="h-2.5 skeleton rounded-full w-16" />
              <div className="h-8 w-8 skeleton rounded-full" />
            </div>
            <div className="h-8 skeleton rounded-full w-14" />
            <div className="h-2 skeleton rounded-full w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard lines={4} hasHeader hasFooter />
        <SkeletonCard lines={5} hasHeader />
      </div>
    </div>
  );
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}

export function SkeletonText({ lines = 3, className, lastLineWidth = "60%" }: SkeletonTextProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 skeleton rounded-full"
          style={{
            width: i === lines - 1 ? lastLineWidth : "100%",
            animationDelay: `${i * 60}ms`,
          }}
        />
      ))}
    </div>
  );
}
