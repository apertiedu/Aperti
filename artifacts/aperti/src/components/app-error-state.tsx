import { AlertCircle, RefreshCw, Bug, Home, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { motion } from "framer-motion";

const ROLE_SUGGESTIONS: Record<string, Array<{ label: string; href: string }>> = {
  admin: [
    { label: "Command Center", href: "/admin/command" },
    { label: "Data Quality", href: "/admin/data-quality" },
    { label: "Route Health", href: "/admin/route-health" },
  ],
  teacher: [
    { label: "CoreHub", href: "/" },
    { label: "Assessment Hub", href: "/assessment-hub" },
    { label: "PlanGrid", href: "/plan-grid" },
  ],
  assistant: [
    { label: "CoreHub", href: "/" },
    { label: "GradeFlow", href: "/grade-flow" },
    { label: "MarkerMind", href: "/marker-mind" },
  ],
  student: [
    { label: "Dashboard", href: "/" },
    { label: "My Courses", href: "/my-courses" },
    { label: "The Mentor", href: "/mentor" },
  ],
  parent: [
    { label: "Dashboard", href: "/" },
    { label: "Grades", href: "/parent/grades" },
    { label: "Attendance", href: "/parent/attendance" },
  ],
};

function sendReport(message: string, code?: number) {
  const token = (() => { try { return localStorage.getItem("aperti_token") ?? ""; } catch { return ""; } })();
  fetch("/api/errors/log", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message: `[user-report] ${message}`,
      route: window.location.pathname,
      status: code,
      source: "AppErrorState",
      userAgent: navigator.userAgent.slice(0, 200),
      timestamp: new Date().toISOString(),
    }),
  }).catch(() => {});
}

interface AppErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  code?: number;
  role?: string;
  hideReport?: boolean;
  compact?: boolean;
  className?: string;
}

export function AppErrorState({
  title = "Something went wrong",
  message = "We couldn't load this section. Your work is safe.",
  onRetry,
  code,
  role,
  hideReport = false,
  compact = false,
  className,
}: AppErrorStateProps) {
  const [reported, setReported] = useState(false);
  const suggestions = role ? (ROLE_SUGGESTIONS[role] ?? []) : [];
  const is404 = code === 404;

  if (compact) {
    return (
      <div className={`flex items-center gap-3 p-4 bg-destructive/8 border border-destructive/20 rounded-xl ${className ?? ""}`}>
        <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive">{title}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="shrink-0 p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
            aria-label="Retry"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`flex flex-col items-center justify-center min-h-[300px] p-8 text-center ${className ?? ""}`}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: is404 ? "hsl(var(--primary)/0.08)" : "hsl(var(--destructive)/0.08)" }}
      >
        {is404 ? (
          <span className="text-2xl font-black text-primary">404</span>
        ) : (
          <AlertCircle className="h-7 w-7 text-destructive" />
        )}
      </div>

      <h2 className="text-lg font-bold text-foreground mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">{message}</p>

      <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground bg-primary hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        )}
        <Link href="/">
          <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-foreground border border-border bg-card hover:bg-muted transition-colors">
            <Home className="h-4 w-4" />
            Dashboard
          </button>
        </Link>
        {!hideReport && (
          reported ? (
            <span className="text-xs text-muted-foreground px-3">Problem reported — thank you.</span>
          ) : (
            <button
              onClick={() => { sendReport(message, code); setReported(true); }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Bug className="h-3.5 w-3.5" />
              Report this problem
            </button>
          )
        )}
      </div>

      {is404 && suggestions.length > 0 && (
        <div className="w-full max-w-xs">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase mb-3">
            You might be looking for
          </p>
          <div className="space-y-1">
            {suggestions.map((s) => (
              <Link key={s.href} href={s.href}>
                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-muted/40 hover:bg-muted transition-colors group cursor-pointer">
                  <span className="text-sm font-medium text-foreground">{s.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
