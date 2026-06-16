import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Shield, AlertTriangle, RefreshCw, ChevronDown, Filter } from "lucide-react";

type RiskLevel = "all" | "low" | "medium" | "high";

interface FraudLog {
  id: number;
  transaction_id: number;
  fraud_risk_score: string;
  risk_level: "low" | "medium" | "high";
  flags: string[] | string;
  recommended_action: string;
  created_at: string;
  amount?: string;
  currency?: string;
  purpose?: string;
  reference_number?: string;
  user_name?: string;
  user_email?: string;
  analyzed_by_name?: string;
}
interface FraudStats {
  total: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  avg_score: string;
}
interface Signal { key: string; weight: number; description: string; }

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    low: "bg-emerald-50 text-emerald-700 border-emerald-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    high: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide", map[level] ?? "bg-muted text-muted-foreground border-border")}>
      {level}
    </span>
  );
}

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, string> = {
    approve: "bg-emerald-50 text-emerald-700",
    manual_review: "bg-amber-50 text-amber-700",
    block: "bg-red-50 text-red-700",
  };
  return (
    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full capitalize", map[action] ?? "bg-muted text-muted-foreground")}>
      {action?.replace(/_/g, " ")}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.6 ? "bg-red-500" : score >= 0.3 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums font-mono text-muted-foreground">{(score).toFixed(2)}</span>
    </div>
  );
}

function AnalyzeModal({ txId, onClose }: { txId: number; onClose: () => void }) {
  const { toast } = useToast();
  const [result, setResult] = useState<{ fraud_analysis: { fraud_risk_score: number; risk_level: string; flags: string[]; recommended_action: string; signal_descriptions: string[] } } | null>(null);

  const analyzeMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/fraud/analyze", {
        method: "POST",
        body: JSON.stringify({ transactionId: txId }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.error) { toast({ title: "Analysis failed", description: data.error, variant: "destructive" }); return; }
      setResult(data);
    },
    onError: () => toast({ title: "Analysis failed", variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-foreground mb-4">Fraud Analysis — Transaction #{txId}</h3>
        {!result ? (
          <button
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg px-4 py-2.5 transition-colors disabled:opacity-50"
          >
            {analyzeMutation.isPending ? "Analyzing…" : "Run Fraud Analysis"}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <RiskBadge level={result.fraud_analysis.risk_level} />
              <ActionBadge action={result.fraud_analysis.recommended_action} />
              <span className="font-mono text-sm font-bold">{result.fraud_analysis.fraud_risk_score.toFixed(3)}</span>
            </div>
            {result.fraud_analysis.flags.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Triggered signals:</p>
                {result.fraud_analysis.signal_descriptions.map((d, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                    <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                    {d}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-emerald-600">No risk signals detected.</p>
            )}
          </div>
        )}
        <button onClick={onClose} className="mt-4 w-full text-sm text-muted-foreground hover:bg-muted rounded-lg py-2 transition-colors">
          Close
        </button>
      </div>
    </div>
  );
}

export default function FraudMonitorPage() {
  const [riskFilter, setRiskFilter] = useState<RiskLevel>("all");
  const [analyzeId, setAnalyzeId] = useState<number | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<{
    logs: FraudLog[];
    stats: FraudStats;
    signals: Signal[];
  }>({
    queryKey: ["fraud-log", riskFilter],
    queryFn: () =>
      apiFetch(`/api/fraud/audit-log${riskFilter !== "all" ? `?risk_level=${riskFilter}` : ""}`).then((r) => r.json()),
    refetchInterval: 60_000,
  });

  const stats = data?.stats;
  const logs = data?.logs ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            Fraud Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automated risk scoring on every InstaPay transaction · last 30 days
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="p-2 border border-border rounded-lg hover:bg-muted transition-colors"
        >
          <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isFetching && "animate-spin")} />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Analyzed", value: stats?.total ?? "—", color: "text-foreground" },
          { label: "High Risk", value: stats?.high_count ?? "—", color: "text-red-600" },
          { label: "Medium Risk", value: stats?.medium_count ?? "—", color: "text-amber-600" },
          { label: "Low Risk", value: stats?.low_count ?? "—", color: "text-emerald-600" },
          { label: "Avg Score", value: stats?.avg_score ? parseFloat(stats.avg_score).toFixed(3) : "—", color: "text-foreground" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-2xl font-bold tabular-nums mt-0.5", color)}>{value}</p>
          </div>
        ))}
      </div>

      {data?.signals && data.signals.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Risk Signal Weights</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.signals.map((s) => (
              <div key={s.key} className="space-y-1">
                <p className="text-[11px] font-medium text-foreground capitalize">{s.key.replace(/_/g, " ")}</p>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${s.weight * 100}%` }} />
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">{s.weight.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Risk level:</span>
        {(["all", "high", "medium", "low"] as RiskLevel[]).map((level) => (
          <button
            key={level}
            onClick={() => setRiskFilter(level)}
            className={cn(
              "text-xs px-3 py-1 rounded-full border transition-colors capitalize",
              riskFilter === level
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {level}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Tx#", "User", "Amount", "Risk Score", "Risk Level", "Action", "Flags", "Analyzed", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground text-sm">Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground text-sm">No fraud analyses yet</td></tr>
            ) : logs.map((log) => {
              const flags: string[] = Array.isArray(log.flags) ? log.flags : (typeof log.flags === "string" ? JSON.parse(log.flags || "[]") : []);
              return (
                <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{log.transaction_id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground text-xs">{log.user_name ?? "—"}</p>
                    <p className="text-[11px] text-muted-foreground">{log.user_email ?? ""}</p>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold tabular-nums">
                    {log.amount ? `${parseFloat(log.amount).toLocaleString()} ${log.currency ?? "EGP"}` : "—"}
                  </td>
                  <td className="px-4 py-3"><ScoreBar score={parseFloat(log.fraud_risk_score)} /></td>
                  <td className="px-4 py-3"><RiskBadge level={log.risk_level} /></td>
                  <td className="px-4 py-3"><ActionBadge action={log.recommended_action} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {flags.slice(0, 2).map((f) => (
                        <span key={f} className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{f}</span>
                      ))}
                      {flags.length > 2 && <span className="text-[10px] text-muted-foreground">+{flags.length - 2}</span>}
                      {flags.length === 0 && <span className="text-[10px] text-muted-foreground">none</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-muted-foreground">{new Date(log.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setAnalyzeId(log.transaction_id)}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                    >
                      Re-analyze <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {analyzeId !== null && <AnalyzeModal txId={analyzeId} onClose={() => setAnalyzeId(null)} />}
    </div>
  );
}
