import { Clock } from "lucide-react";

interface ComingSoonBadgeProps {
  label?: string;
  className?: string;
}

export function ComingSoonBadge({ label = "Coming Soon", className = "" }: ComingSoonBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-primary/30 text-primary bg-primary/5 ${className}`}
    >
      <Clock className="h-3 w-3" />
      {label}
    </span>
  );
}

interface ComingSoonOverlayProps {
  title?: string;
  description?: string;
  children?: React.ReactNode;
}

export function ComingSoonOverlay({
  title = "Coming Soon",
  description = "This feature is in development and will be available soon.",
  children,
}: ComingSoonOverlayProps) {
  return (
    <div className="relative">
      <div className="pointer-events-none opacity-30 select-none">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-[2px] rounded-xl z-10">
        <div className="flex flex-col items-center gap-2 text-center px-6">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full border border-primary/30 text-primary bg-primary/5">
            <Clock className="h-3.5 w-3.5" />
            {title}
          </span>
          <p className="text-xs text-muted-foreground max-w-xs mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function ComingSoonBanner({ description }: { description?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/15 rounded-xl">
      <Clock className="h-4 w-4 text-primary shrink-0" />
      <div>
        <p className="text-sm font-semibold text-primary">Coming Soon</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  );
}
