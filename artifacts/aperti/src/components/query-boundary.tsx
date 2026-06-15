import { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { AppErrorState } from "@/components/app-error-state";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface QueryBoundaryProps {
  isLoading: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  role?: string;
  errorTitle?: string;
  errorMessage?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  emptyAction?: { label: string; onClick: () => void };
  loadingComponent?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function QueryBoundary({
  isLoading,
  isError = false,
  isEmpty = false,
  error,
  onRetry,
  role,
  errorTitle,
  errorMessage,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyIcon,
  emptyAction,
  loadingComponent,
  className,
  children,
}: QueryBoundaryProps) {
  if (isLoading) {
    return loadingComponent ? (
      <>{loadingComponent}</>
    ) : (
      <div className={cn("flex items-center justify-center min-h-[200px]", className)}>
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <AppErrorState
        title={errorTitle}
        message={errorMessage || (error?.message ?? undefined)}
        onRetry={onRetry}
        role={role}
        className={className}
      />
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        className={className}
      />
    );
  }

  return <>{children}</>;
}

interface SkeletonGridProps {
  count?: number;
  className?: string;
  itemClassName?: string;
  height?: string;
}

export function SkeletonGrid({
  count = 4,
  className,
  itemClassName,
  height = "h-28",
}: SkeletonGridProps) {
  return (
    <div className={cn("grid gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-xl skeleton",
            height,
            itemClassName,
          )}
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

export function SkeletonList({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-xl bg-muted/30"
          style={{ opacity: 1 - i * 0.12 }}
        >
          <div className="h-9 w-9 rounded-full skeleton shrink-0" style={{ animationDelay: `${i * 60}ms` }} />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 skeleton rounded-full" style={{ width: `${70 - i * 5}%`, animationDelay: `${i * 60 + 30}ms` }} />
            <div className="h-2.5 skeleton rounded-full" style={{ width: `${50 - i * 4}%`, animationDelay: `${i * 60 + 60}ms` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonStatRow({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid gap-4 grid-cols-2 lg:grid-cols-${count}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card border border-border/40 rounded-xl p-4 space-y-3" style={{ animationDelay: `${i * 70}ms` }}>
          <div className="flex items-center justify-between">
            <div className="h-2.5 skeleton rounded-full w-20" />
            <div className="h-8 w-8 skeleton rounded-full" />
          </div>
          <div className="h-7 skeleton rounded-full w-16" />
          <div className="h-2 skeleton rounded-full w-24" />
        </div>
      ))}
    </div>
  );
}
