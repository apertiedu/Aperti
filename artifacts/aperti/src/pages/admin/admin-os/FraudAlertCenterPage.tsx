import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Radio, RefreshCw, CheckCircle, EyeOff, Eye, Filter } from "lucide-react";

type Severity = "all" | "high" | "medium" | "low";
type Status = "all" | "open" | "reviewed" | "resolved" | "ignored";

interface FraudAlert {
  id: number;
  severity: "low" | "medium" | "high";
  type: string;
  entity_id: string;
  entity_type: string;
  message: string;
  status: "open" | "reviewed" | "resolved" | "ignored";
  metadata: Record<string, unknown>;
  created_at: string;
  resolved_at?: string;
  resolved_by_name?: string;
}

interface AlertStats {
  total: number;
  open_high: number;
  open_medium: number;
  open_low: number;
  total_open: number;
  resolved: number;
  last_24h: number;
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    high:   "bg-red-50 text-red-700 border-red-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    low:    "bg-blue-50 text-blue-700 border-blue-200",
  };
  return (
    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-widest", map[severity] ?? "bg-muted text-muted-foreground border-border")}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open:     "bg-red-50 text-red-700",
    reviewed: "bg-amber-50 text-amber-700",
    resolved: "bg-emerald-50 text-emerald-700",
    ignored:  "bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full capitalize", map[status] ?? "bg-muted text-muted-foreground")}>
      {status}
    </span>
  );
}

function AlertRow({ alert, onAction }: { alert: FraudAlert; onAction: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const mutate = (action: "resolve" | "ignore" | "review") => {
    apiFetch(`/api/fraud-alerts/${alert.id}/${action}`, { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { toast({ title: "Failed", description: d.error, variant: "destructive" }); return; }
        toast({ title: `Alert ${action}d` });
        qc.invalidateQueries({ queryKey: ["fraud-alerts"] });
        onAction();
      });
  };

  const meta = alert.metadata ?? {};

  return (
    <div className={cn(
      "bg-card border rounded-xl p-4 space-y-2 transition-all",
      alert.severity === "high" ? "border-red-200" : alert.severity === "medium" ? "border-amber-200" : "border-border",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <SeverityBadge severity={alert.severity} />
          <StatusBadge status={alert.status} />
          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {alert.type.replace(/_/g, " ")}
          </span>
          {alert.entity_type && (
            <span className="text-[10px] text-muted-foreground">
              {alert.entity_type} #{alert.entity_id}
            </span>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0">{new Date(alert.created_at).toLocaleString()}</span>
      </div>

      <p className="text-sm text-foreground leading-snug">{alert.message}</p>

      {Object.keys(meta).length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {(meta.score !== undefined) && (
            <span className="text-[11px] text-muted-foreground">Risk score: <strong className="text-foreground">{String(meta.score)}</strong></span>
          )}
          {(meta.amount !== undefined) && (
            <span className="text-[11px] text-muted-foreground">Amount: <strong className="text-foreground">{String(meta.amount)} EGP</strong></span>
          )}
          {(meta.user_name !== undefined) && (
            <span className="text-[11px] text-muted-foreground">User: <strong className="text-foreground">{String(meta.user_name)}</strong></span>
          )}
          {Array.isArray(meta.flags) && meta.flags.length > 0 && (
            <span className="text-[11px] text-muted-foreground">Flags: <strong className="text-foreground font-mono">{(meta.flags as string[]).join(", ")}</strong></span>
          )}
        </div>
      )}

      {alert.status === "open" && (
        <div className="flex gap-2 pt-1">
          <button onClick={() => mutate("review")} className="flex items-center gap-1 text-xs text-amber-700 hover:bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 transition-colors">
            <Eye className="h-3 w-3" /> Mark Reviewed
          </button>
          <button onClick={() => mutate("resolve")} className="flex items-center gap-1 text-xs text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors">
            <CheckCircle className="h-3 w-3" /> Resolve
          </button>
          <button onClick={() => mutate("ignore")} className="flex items-center gap-1 text-xs text-muted-foreground hover:bg-muted px-3 py-1.5 rounded-lg border border-border transition-colors">
            <EyeOff className="h-3 w-3" /> Ignore
          </button>
        </div>
      )}
      {alert.status === "reviewed" && (
        <div className="flex gap-2 pt-1">
          <button onClick={() => mutate("resolve")} className="flex items-center gap-1 text-xs text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors">
            <CheckCircle className="h-3 w-3" /> Resolve
          </button>
        </div>
      )}
      {(alert.status === "resolved" || alert.status === "ignored") && alert.resolved_by_name && (
        <p className="text-[11px] text-muted-foreground">{alert.status} by {alert.resolved_by_name} · {alert.resolved_at ? new Date(alert.resolved_at).toLocaleDateString() : ""}</p>
      )}
    </div>
  );
}

export default function FraudAlertCenterPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [severity, setSeverity] = useState<Severity>("all");
  const [status, setStatus] = useState<Status>("open");

  const { data, isLoading, refetch, isFetching } = useQuery<{ alerts: FraudAlert[]; stats: AlertStats }>({
    queryKey: ["fraud-alerts", severity, status],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "100" });
      if (severity !== "all") p.set("severity", severity);
      if (status !== "all") p.set("status", status);
      return apiFetch(`/api/fraud-alerts?${p}`).then((r) => r.json());
    },
    refetchInterval: 15_000,
  });

  const backfillMutation = useMutation({
    mutationFn: () => apiFetch("/api/fraud-alerts/generate-from-log", { method: "POST" }).then((r) => r.json()),
    onSuccess: (d) => {
      if (d.error) { toast({ title: "Backfill failed", description: d.error, variant: "destructive" }); return; }
      toast({ title: `${d.alerts_created} alerts generated from fraud log` });
      qc.invalidateQueries({ queryKey: ["fraud-alerts"] });
    },
  });

  const stats = data?.stats;
  const alerts = data?.alerts ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Radio className="h-5 w-5 text-red-500 animate-pulse" />
            Fraud Alert Center
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Live feed · auto-refreshes every 15 seconds · no silent signals</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => backfillMutation.mutate()}
            disabled={backfillMutation.isPending}
            className="text-xs px-3 py-1.5 border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            {backfillMutation.isPending ? "Syncing…" : "Sync from fraud log"}
          </button>
          <button onClick={() => refetch()} className="p-2 border border-border rounded-lg hover:bg-muted transition-colors">
            <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isFetching && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Open (High)",   value: stats?.open_high   ?? 0, color: "text-red-600", warn: (stats?.open_high ?? 0) > 0 },
          { label: "Open (Medium)", value: stats?.open_medium ?? 0, color: "text-amber-600", warn: false },
          { label: "Total Open",    value: stats?.total_open  ?? 0, color: "text-foreground", warn: false },
          { label: "Last 24h",      value: stats?.last_24h    ?? 0, color: "text-blue-600", warn: false },
        ].map(({ label, value, color, warn }) => (
          <div key={label} className={cn("bg-card border rounded-xl p-4", warn ? "border-red-200" : "border-border")}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-2xl font-bold tabular-nums mt-0.5", color)}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Severity:</span>
          {(["all","high","medium","low"] as Severity[]).map((s) => (
            <button key={s} onClick={() => setSeverity(s)} className={cn("text-xs px-2.5 py-1 rounded-full border capitalize", severity === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Status:</span>
          {(["all","open","reviewed","resolved","ignored"] as Status[]).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={cn("text-xs px-2.5 py-1 rounded-full border capitalize", status === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto mb-3" />
          <p className="text-sm font-medium">No alerts matching this filter</p>
          <p className="text-xs mt-1">All clear — or try changing the filters above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => (
            <AlertRow key={a.id} alert={a} onAction={() => qc.invalidateQueries({ queryKey: ["fraud-alerts"] })} />
          ))}
        </div>
      )}
    </div>
  );
}
