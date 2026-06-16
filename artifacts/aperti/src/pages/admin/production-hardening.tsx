import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Shield, Activity, Brain, AlertTriangle, CheckCircle, XCircle, AlertCircle, RefreshCw, ToggleLeft, ToggleRight, Clock, Zap } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ProductionMetrics {
  safe_mode: boolean;
  system: {
    uptime_seconds: number;
    total_requests_24h: number;
    error_count_24h: number;
    error_rate_pct: number;
    avg_latency_ms: number;
    validation_errors_24h: number;
  };
  ux: {
    violations_24h: number;
    critical_violations_24h: number;
  };
  ai: {
    total_calls_24h: number;
    failure_count_24h: number;
    avg_confidence: number;
  };
  timestamp: string;
}

interface SelfCheck {
  production_ready: boolean;
  overall: "pass" | "fail" | "warn";
  checks: Array<{ name: string; status: "pass" | "fail" | "warn"; latency_ms?: number; message?: string }>;
  timestamp: string;
}

function formatUptime(sec: number) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function StatusDot({ status }: { status: "pass" | "fail" | "warn" | "healthy" | "error" | "ok" }) {
  const map: Record<string, string> = {
    pass: "bg-emerald-500", healthy: "bg-emerald-500", ok: "bg-emerald-500",
    warn: "bg-amber-500",
    fail: "bg-red-500", error: "bg-red-500",
  };
  return <span className={cn("inline-block w-2 h-2 rounded-full shrink-0", map[status] ?? "bg-muted")} />;
}

function MetricCard({ label, value, sub, accent = false, warn = false }: {
  label: string; value: string | number; sub?: string; accent?: boolean; warn?: boolean;
}) {
  return (
    <div className={cn(
      "bg-card border rounded-xl p-4 flex flex-col gap-1",
      warn ? "border-amber-200 bg-amber-50/30" : "border-border",
    )}>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className={cn("text-2xl font-bold tabular-nums", accent ? "text-primary" : warn ? "text-amber-600" : "text-foreground")}>{value}</span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, badge }: { icon: React.ElementType; title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-primary" />
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {badge && (
        <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{badge}</span>
      )}
    </div>
  );
}

export default function ProductionHardeningPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [runningCheck, setRunningCheck] = useState(false);

  const { data: metrics, isLoading: metricsLoading, dataUpdatedAt, refetch: refetchMetrics } = useQuery<ProductionMetrics>({
    queryKey: ["production-metrics"],
    queryFn: () => apiFetch("/api/system/production-metrics").then((r) => r.json()),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: selfCheck, refetch: refetchCheck } = useQuery<SelfCheck>({
    queryKey: ["self-check"],
    queryFn: () => apiFetch("/api/system/self-check").then((r) => r.json()),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const toggleSafeMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiFetch("/api/system/safe-mode", { method: "POST", body: JSON.stringify({ enabled }) }).then((r) => r.json()),
    onSuccess: (_, enabled) => {
      toast({ title: enabled ? "Safe Mode Enabled" : "Safe Mode Disabled", description: enabled ? "Non-critical features reduced." : "Platform returned to full operation." });
      qc.invalidateQueries({ queryKey: ["production-metrics"] });
    },
    onError: () => toast({ title: "Failed to toggle safe mode", variant: "destructive" }),
  });

  const handleRunCheck = async () => {
    setRunningCheck(true);
    await refetchCheck();
    setRunningCheck(false);
  };

  const safeMode = metrics?.safe_mode ?? false;
  const errorRate = metrics?.system.error_rate_pct ?? 0;
  const avgConf = metrics?.ai.avg_confidence ?? 0;

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Production Hardening
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            System correctness · UX consistency · failure safety · observability
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Updated {lastUpdated}
          </span>
          <button
            onClick={() => { refetchMetrics(); refetchCheck(); }}
            className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", metricsLoading && "animate-spin")} />
          </button>
        </div>
      </div>

      {safeMode && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Platform is in <strong>Safe Mode</strong> — non-critical features are reduced to protect core functionality.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Uptime" value={metrics ? formatUptime(metrics.system.uptime_seconds) : "—"} sub="current session" accent />
        <MetricCard label="Error Rate (24h)" value={`${errorRate.toFixed(1)}%`} sub={`${metrics?.system.error_count_24h ?? 0} errors`} warn={errorRate >= 5} />
        <MetricCard label="Avg Latency" value={metrics ? `${metrics.system.avg_latency_ms}ms` : "—"} sub="all API requests" warn={(metrics?.system.avg_latency_ms ?? 0) > 800} />
        <MetricCard label="AI Confidence" value={avgConf > 0 ? `${Math.round(avgConf * 100)}%` : "—"} sub="avg last 24h" warn={avgConf > 0 && avgConf < 0.65} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <SectionHeader icon={Activity} title="System Health" badge="24h" />
          <div className="space-y-2.5">
            {[
              { label: "Total Requests", value: (metrics?.system.total_requests_24h ?? 0).toLocaleString() },
              { label: "Errors", value: metrics?.system.error_count_24h ?? 0, warn: (metrics?.system.error_count_24h ?? 0) > 10 },
              { label: "Validation Errors", value: metrics?.system.validation_errors_24h ?? 0, warn: (metrics?.system.validation_errors_24h ?? 0) > 5 },
              { label: "Avg Latency", value: `${metrics?.system.avg_latency_ms ?? 0}ms` },
            ].map(({ label, value, warn }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className={cn("font-medium tabular-nums", warn ? "text-red-600" : "text-foreground")}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <SectionHeader icon={Brain} title="AI Health" badge="24h" />
          <div className="space-y-2.5">
            {[
              { label: "Total AI Calls", value: metrics?.ai.total_calls_24h ?? 0 },
              { label: "Failures", value: metrics?.ai.failure_count_24h ?? 0, warn: (metrics?.ai.failure_count_24h ?? 0) > 5 },
              {
                label: "Avg Confidence",
                value: avgConf > 0 ? `${Math.round(avgConf * 100)}%` : "n/a",
                warn: avgConf > 0 && avgConf < 0.65,
              },
              {
                label: "Failure Rate",
                value: metrics && metrics.ai.total_calls_24h > 0
                  ? `${((metrics.ai.failure_count_24h / metrics.ai.total_calls_24h) * 100).toFixed(1)}%`
                  : "0%",
              },
            ].map(({ label, value, warn }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className={cn("font-medium tabular-nums", warn ? "text-amber-600" : "text-foreground")}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <SectionHeader icon={Zap} title="UX Health" badge="24h" />
          <div className="space-y-2.5">
            {[
              { label: "Rule Violations", value: metrics?.ux.violations_24h ?? 0, warn: (metrics?.ux.violations_24h ?? 0) > 0 },
              { label: "Critical Violations", value: metrics?.ux.critical_violations_24h ?? 0, warn: (metrics?.ux.critical_violations_24h ?? 0) > 0 },
              { label: "Fallback Activations", value: metrics?.system.validation_errors_24h ?? 0 },
              { label: "Status", value: (metrics?.ux.critical_violations_24h ?? 0) === 0 ? "Healthy" : "Needs Review" },
            ].map(({ label, value, warn }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className={cn("font-medium", warn ? "text-red-600" : "text-foreground")}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <SectionHeader icon={CheckCircle} title="Pre-Deployment Self-Check" />
          {selfCheck ? (
            <div className="space-y-2">
              {selfCheck.checks.map((c) => (
                <div key={c.name} className="flex items-center gap-2.5 py-1.5 border-b border-border last:border-0">
                  <StatusDot status={c.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground capitalize">{c.name.replace(/_/g, " ")}</p>
                    {c.message && <p className="text-[10px] text-muted-foreground truncate">{c.message}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {c.latency_ms !== undefined && (
                      <span className="text-[10px] text-muted-foreground">{c.latency_ms}ms</span>
                    )}
                    {c.status === "pass" && <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
                    {c.status === "fail" && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                    {c.status === "warn" && <AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
                  </div>
                </div>
              ))}
              <div className="pt-2 flex items-center justify-between">
                <span className={cn(
                  "text-xs font-semibold px-2 py-1 rounded-md",
                  selfCheck.production_ready ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
                )}>
                  {selfCheck.production_ready ? "Production Ready" : "Not Production Ready"}
                </span>
                <span className="text-[10px] text-muted-foreground">{new Date(selfCheck.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No check run yet.</p>
          )}
          <button
            onClick={handleRunCheck}
            disabled={runningCheck}
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", runningCheck && "animate-spin")} />
            {runningCheck ? "Running checks…" : "Run Self-Check"}
          </button>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <SectionHeader icon={Shield} title="Safe Mode Control" />
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              When enabled, safe mode reduces AI complexity, disables non-critical features, and switches to fallback logic. Core functionality is preserved.
            </p>
            <div className={cn(
              "flex items-center justify-between p-3 rounded-lg border",
              safeMode ? "border-amber-200 bg-amber-50/40" : "border-border bg-muted/30",
            )}>
              <div>
                <p className="text-sm font-medium text-foreground">Safe Mode</p>
                <p className={cn("text-xs", safeMode ? "text-amber-600 font-medium" : "text-muted-foreground")}>
                  {safeMode ? "Currently active" : "Currently inactive"}
                </p>
              </div>
              <button
                onClick={() => toggleSafeMutation.mutate(!safeMode)}
                disabled={toggleSafeMutation.isPending}
                className={cn(
                  "p-1 rounded transition-colors disabled:opacity-50",
                  safeMode ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground hover:text-foreground",
                )}
                title={safeMode ? "Disable safe mode" : "Enable safe mode"}
              >
                {safeMode
                  ? <ToggleRight className="h-8 w-8" />
                  : <ToggleLeft className="h-8 w-8" />}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { label: "safeHandler", desc: "All routes wrapped" },
                { label: "AI Validation", desc: "Schema + confidence" },
                { label: "Request Observer", desc: "Every request logged" },
                { label: "Fallback Responses", desc: "Degraded mode ready" },
              ].map(({ label, desc }) => (
                <div key={label} className="flex items-start gap-1.5 p-2 rounded-lg bg-muted/40">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">{label}</p>
                    <p className="text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground text-center">
        Data refreshes every 30 seconds · All times local · system_metrics_log · system_validation_errors · ux_rule_violations
      </div>
    </div>
  );
}
