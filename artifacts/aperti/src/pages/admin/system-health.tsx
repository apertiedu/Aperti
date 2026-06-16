import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion } from "framer-motion";
import {
  Activity, Brain, Shield, Zap, Clock, AlertTriangle, CheckCircle2,
  XCircle, Server, TrendingUp, TrendingDown, Minus, RefreshCw,
  BarChart2, Monitor, Database, Wifi, AlertCircle, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface ValidationError {
  id: number;
  source: string;
  error_type: string;
  field_missing: string | null;
  fallback_used: boolean;
  created_at: string;
}

function formatUptime(sec: number) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function HealthBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatusIndicator({ status }: { status: "pass" | "fail" | "warn" | "healthy" | "degraded" | "critical" }) {
  const map: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
    pass: { color: "text-emerald-500", icon: CheckCircle2 },
    healthy: { color: "text-emerald-500", icon: CheckCircle2 },
    warn: { color: "text-amber-500", icon: AlertTriangle },
    degraded: { color: "text-amber-500", icon: AlertTriangle },
    fail: { color: "text-rose-500", icon: XCircle },
    critical: { color: "text-rose-500", icon: XCircle },
  };
  const { color, icon: Icon } = map[status] ?? { color: "text-muted-foreground", icon: Minus };
  return <Icon className={cn("h-4 w-4 shrink-0", color)} />;
}

function MetricTile({
  label, value, sub, icon: Icon, trend, accent, warn,
}: {
  label: string; value: string | number; sub?: string;
  icon: typeof Activity; trend?: "up" | "down" | "flat";
  accent?: boolean; warn?: boolean;
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  return (
    <div className={cn(
      "rounded-xl border p-4 flex flex-col gap-1.5",
      warn ? "bg-rose-50 border-rose-200" : accent ? "bg-primary/5 border-primary/20" : "bg-card border-border"
    )}>
      <div className="flex items-center justify-between">
        <Icon className={cn("h-4 w-4", warn ? "text-rose-500" : accent ? "text-primary" : "text-muted-foreground")} />
        {trend && <TrendIcon className={cn("h-3.5 w-3.5", trend === "up" ? "text-emerald-500" : trend === "down" ? "text-rose-500" : "text-muted-foreground")} />}
      </div>
      <div className={cn("text-2xl font-extrabold", warn ? "text-rose-700" : "text-foreground")}>{value}</div>
      <div className="text-xs text-muted-foreground font-medium">{label}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function SectionHeader({ icon: Icon, label, status }: { icon: typeof Activity; label: string; status?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-primary" />
      <h2 className="font-bold text-foreground">{label}</h2>
      {status && (
        <Badge className={cn("ml-auto text-xs border",
          status === "healthy" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
          status === "degraded" ? "bg-amber-100 text-amber-700 border-amber-200" :
          "bg-rose-100 text-rose-700 border-rose-200"
        )}>{status}</Badge>
      )}
    </div>
  );
}

function overallSystemStatus(m: ProductionMetrics): "healthy" | "degraded" | "critical" {
  if (m.safe_mode) return "degraded";
  if (m.system.error_rate_pct > 10 || m.ai.failure_count_24h > 20) return "critical";
  if (m.system.error_rate_pct > 5 || m.system.avg_latency_ms > 1000) return "degraded";
  return "healthy";
}

function aiHealthStatus(ai: ProductionMetrics["ai"]): "healthy" | "degraded" | "critical" {
  const failRate = ai.total_calls_24h > 0 ? ai.failure_count_24h / ai.total_calls_24h : 0;
  if (failRate > 0.3 || ai.avg_confidence < 0.4) return "critical";
  if (failRate > 0.1 || ai.avg_confidence < 0.65) return "degraded";
  return "healthy";
}

function uxHealthStatus(ux: ProductionMetrics["ux"]): "healthy" | "degraded" | "critical" {
  if (ux.critical_violations_24h > 10) return "critical";
  if (ux.violations_24h > 20 || ux.critical_violations_24h > 0) return "degraded";
  return "healthy";
}

export default function SystemHealthDashboard() {
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery<ProductionMetrics>({
    queryKey: ["system-health-metrics"],
    queryFn: () => apiFetch("/api/system/production-metrics").then(r => r.json()),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: selfCheck, isLoading: selfCheckLoading, refetch: refetchSelfCheck } = useQuery<SelfCheck>({
    queryKey: ["system-self-check"],
    queryFn: () => apiFetch("/api/system/self-check").then(r => r.json()),
    staleTime: 60_000,
  });

  const { data: validationErrors } = useQuery<ValidationError[]>({
    queryKey: ["system-validation-errors"],
    queryFn: () =>
      apiFetch("/api/system/validation-errors").then(r => r.json()).then(d => d.errors ?? []),
    staleTime: 30_000,
  });

  function handleRefresh() {
    refetchMetrics();
    refetchSelfCheck();
  }

  const sysStatus = metrics ? overallSystemStatus(metrics) : "healthy";
  const aiStatus = metrics ? aiHealthStatus(metrics.ai) : "healthy";
  const uxStatus = metrics ? uxHealthStatus(metrics.ux) : "healthy";

  const overallStatus =
    sysStatus === "critical" || aiStatus === "critical" || uxStatus === "critical" ? "critical" :
    sysStatus === "degraded" || aiStatus === "degraded" || uxStatus === "degraded" ? "degraded" :
    "healthy";

  const confidencePct = Math.round((metrics?.ai.avg_confidence ?? 0) * 100);
  const aiFailRate = metrics && metrics.ai.total_calls_24h > 0
    ? Math.round((metrics.ai.failure_count_24h / metrics.ai.total_calls_24h) * 100)
    : 0;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Monitor className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">System Health Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Real-time observability — system, UX, and AI health
              {metrics && <span className="ml-2 text-xs">· Updated {formatTime(metrics.timestamp)}</span>}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge className={cn("border text-xs font-semibold",
              overallStatus === "healthy" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
              overallStatus === "degraded" ? "bg-amber-100 text-amber-700 border-amber-200" :
              "bg-rose-100 text-rose-700 border-rose-200"
            )}>
              {overallStatus === "healthy" ? "All systems healthy" :
               overallStatus === "degraded" ? "Degraded" : "Critical"}
            </Badge>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </div>
      </motion.div>

      {metrics?.safe_mode && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-300 p-4">
          <Shield className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">Safe Mode Active</p>
            <p className="text-sm text-amber-700">AI complexity is reduced. Non-critical features may be disabled.</p>
          </div>
        </motion.div>
      )}

      {/* ── System Health ───────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="rounded-xl bg-card border border-border p-5">
        <SectionHeader icon={Server} label="System Health" status={sysStatus} />
        {metricsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[0,1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : metrics ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <MetricTile label="Uptime" value={formatUptime(metrics.system.uptime_seconds)} icon={Clock} accent />
              <MetricTile
                label="Error rate (24h)" value={`${metrics.system.error_rate_pct.toFixed(1)}%`}
                icon={AlertTriangle}
                warn={metrics.system.error_rate_pct > 5}
                trend={metrics.system.error_rate_pct > 5 ? "up" : "flat"}
                sub={`${metrics.system.error_count_24h} errors / ${metrics.system.total_requests_24h} requests`}
              />
              <MetricTile
                label="Avg latency" value={`${metrics.system.avg_latency_ms}ms`}
                icon={Zap}
                warn={metrics.system.avg_latency_ms > 1000}
                trend={metrics.system.avg_latency_ms > 500 ? "up" : "flat"}
              />
              <MetricTile
                label="Validation errors (24h)" value={metrics.system.validation_errors_24h}
                icon={AlertCircle}
                warn={metrics.system.validation_errors_24h > 10}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted/30 border border-border p-3">
                <div className="flex justify-between mb-1.5">
                  <span className="text-muted-foreground">Request success rate</span>
                  <span className="font-semibold text-foreground">{(100 - metrics.system.error_rate_pct).toFixed(1)}%</span>
                </div>
                <HealthBar value={100 - metrics.system.error_rate_pct} max={100} color={metrics.system.error_rate_pct > 5 ? "bg-rose-500" : "bg-emerald-500"} />
              </div>
              <div className="rounded-lg bg-muted/30 border border-border p-3">
                <div className="flex justify-between mb-1.5">
                  <span className="text-muted-foreground">Requests in 24h</span>
                  <span className="font-semibold text-foreground">{metrics.system.total_requests_24h.toLocaleString()}</span>
                </div>
                <HealthBar value={metrics.system.total_requests_24h} max={Math.max(10000, metrics.system.total_requests_24h)} color="bg-primary" />
              </div>
            </div>
          </>
        ) : null}
      </motion.div>

      {/* ── AI Health ───────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-xl bg-card border border-border p-5">
        <SectionHeader icon={Brain} label="AI Health" status={aiStatus} />
        {metricsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[0,1,2].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : metrics ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              <MetricTile label="AI calls (24h)" value={metrics.ai.total_calls_24h} icon={Brain} accent />
              <MetricTile
                label="AI failure rate" value={`${aiFailRate}%`}
                icon={AlertTriangle}
                warn={aiFailRate > 10}
                trend={aiFailRate > 10 ? "up" : "flat"}
                sub={`${metrics.ai.failure_count_24h} failures`}
              />
              <MetricTile
                label="Avg confidence"
                value={confidencePct > 0 ? `${confidencePct}%` : "N/A"}
                icon={BarChart2}
                warn={confidencePct > 0 && confidencePct < 65}
                accent={confidencePct >= 85}
                sub={confidencePct >= 85 ? "High confidence" : confidencePct >= 65 ? "Medium confidence" : confidencePct > 0 ? "Low confidence" : "No data"}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted/30 border border-border p-3">
                <div className="flex justify-between mb-1.5">
                  <span className="text-muted-foreground">AI success rate</span>
                  <span className="font-semibold text-foreground">{100 - aiFailRate}%</span>
                </div>
                <HealthBar value={100 - aiFailRate} max={100} color={aiFailRate > 20 ? "bg-rose-500" : aiFailRate > 10 ? "bg-amber-500" : "bg-emerald-500"} />
              </div>
              <div className="rounded-lg bg-muted/30 border border-border p-3">
                <div className="flex justify-between mb-1.5">
                  <span className="text-muted-foreground">Average confidence</span>
                  <span className={cn("font-semibold", confidencePct >= 85 ? "text-emerald-600" : confidencePct >= 65 ? "text-amber-600" : "text-rose-600")}>
                    {confidencePct > 0 ? `${confidencePct}%` : "—"}
                  </span>
                </div>
                <HealthBar value={confidencePct} max={100} color={confidencePct >= 85 ? "bg-emerald-500" : confidencePct >= 65 ? "bg-amber-500" : "bg-rose-500"} />
              </div>
            </div>
          </>
        ) : null}
      </motion.div>

      {/* ── UX Health ───────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="rounded-xl bg-card border border-border p-5">
        <SectionHeader icon={Monitor} label="UX Health" status={uxStatus} />
        {metricsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[0,1].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : metrics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <MetricTile
              label="UX violations (24h)" value={metrics.ux.violations_24h}
              icon={AlertTriangle}
              warn={metrics.ux.violations_24h > 20}
              sub="Missing loading/error states, blank screen risks"
            />
            <MetricTile
              label="Critical violations (24h)" value={metrics.ux.critical_violations_24h}
              icon={XCircle}
              warn={metrics.ux.critical_violations_24h > 0}
              sub="Routes with broken UX contracts"
            />
          </div>
        ) : null}
        {metrics && metrics.ux.violations_24h === 0 && (
          <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> No UX violations recorded in the last 24 hours.
          </div>
        )}
      </motion.div>

      {/* ── Pre-Deployment Self-Check ─────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="rounded-xl bg-card border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-primary" />
          <h2 className="font-bold text-foreground">Pre-Deployment Self-Check</h2>
          {selfCheck && (
            <Badge className={cn("ml-auto text-xs border",
              selfCheck.production_ready ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
              selfCheck.overall === "warn" ? "bg-amber-100 text-amber-700 border-amber-200" :
              "bg-rose-100 text-rose-700 border-rose-200"
            )}>
              {selfCheck.production_ready ? "Production Ready" : selfCheck.overall === "warn" ? "Needs Review" : "Not Ready"}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => refetchSelfCheck()} disabled={selfCheckLoading} className="gap-2 ml-2">
            <RefreshCw className={cn("h-3.5 w-3.5", selfCheckLoading && "animate-spin")} /> Run checks
          </Button>
        </div>

        {selfCheckLoading ? (
          <div className="space-y-2">
            {[0,1,2,3,4].map(i => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}
          </div>
        ) : selfCheck ? (
          <div className="space-y-2">
            {selfCheck.checks.map((check, i) => (
              <motion.div key={check.name} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-3",
                  check.status === "pass" ? "bg-emerald-50/50 border-emerald-100" :
                  check.status === "warn" ? "bg-amber-50 border-amber-100" :
                  "bg-rose-50 border-rose-100"
                )}>
                <StatusIndicator status={check.status} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground">{check.name.replace(/_/g, " ")}</span>
                  {check.message && <p className="text-xs text-muted-foreground truncate">{check.message}</p>}
                </div>
                {check.latency_ms !== undefined && (
                  <span className="text-xs text-muted-foreground">{check.latency_ms}ms</span>
                )}
                <Badge className={cn("text-xs border shrink-0",
                  check.status === "pass" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                  check.status === "warn" ? "bg-amber-100 text-amber-700 border-amber-200" :
                  "bg-rose-100 text-rose-700 border-rose-200"
                )}>{check.status}</Badge>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-6">Click "Run checks" to execute the self-check.</div>
        )}
      </motion.div>

      {/* ── Recent Validation Errors ──────────────────────────────── */}
      {validationErrors && validationErrors.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="rounded-xl bg-card border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <Database className="h-4 w-4 text-primary" />
            <h2 className="font-bold text-foreground">Recent AI Validation Errors</h2>
            <Badge className="ml-auto text-xs bg-rose-100 text-rose-700 border-rose-200 border">{validationErrors.length}</Badge>
          </div>
          <div className="space-y-2">
            {validationErrors.slice(0, 10).map(e => (
              <div key={e.id} className="flex items-start gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-foreground">{e.source}</span>
                  <span className="mx-2 text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{e.error_type}</span>
                  {e.field_missing && <span className="ml-2 text-xs bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-100">field: {e.field_missing}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {e.fallback_used && <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 border">fallback</Badge>}
                  <span className="text-xs text-muted-foreground">{formatTime(e.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Disclaimer ───────────────────────────────────────────── */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground rounded-lg bg-muted/30 border border-border p-3">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        Metrics cover the last 24 hours. Self-check validates live system state. Auto-refreshes every 30 seconds.
        Safe Mode can be toggled from <span className="font-medium">Production Hardening</span>.
      </div>
    </div>
  );
}
