import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Coins, RefreshCw, Play, CheckCircle, XCircle, ChevronDown } from "lucide-react";

interface Payout {
  id: number;
  teacher_id: number;
  gross_amount: string;
  platform_cut: string;
  net_payout: string;
  status: "pending" | "processing" | "paid" | "cancelled";
  method: string;
  reference?: string;
  period_start: string;
  period_end: string;
  created_at: string;
  processed_at?: string;
  teacher_name?: string;
  teacher_email?: string;
  processed_by_name?: string;
}

interface Overview {
  total_payouts: number;
  pending_count: number;
  paid_count: number;
  total_paid_out: string;
  pending_amount: string;
  teachers_with_payouts: number;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:    "bg-amber-50 text-amber-700 border-amber-200",
    processing: "bg-blue-50 text-blue-700 border-blue-200",
    paid:       "bg-emerald-50 text-emerald-700 border-emerald-200",
    cancelled:  "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide", map[status] ?? "bg-muted text-muted-foreground border-border")}>
      {status}
    </span>
  );
}

function ProcessModal({ payout, onClose }: { payout: Payout; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [reference, setReference] = useState("");

  const processMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/payouts/${payout.id}/process`, {
        method: "POST",
        body: JSON.stringify({ reference: reference || undefined }),
      }).then((r) => r.json()),
    onSuccess: (d) => {
      if (d.error) { toast({ title: "Failed", description: d.error, variant: "destructive" }); return; }
      toast({ title: "Payout marked as paid", description: `Reference: ${d.payout.reference}` });
      qc.invalidateQueries({ queryKey: ["pending-payouts"] });
      qc.invalidateQueries({ queryKey: ["payout-overview"] });
      onClose();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiFetch(`/api/payouts/${payout.id}/cancel`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      toast({ title: "Payout cancelled" });
      qc.invalidateQueries({ queryKey: ["pending-payouts"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border shadow-xl p-6 w-full max-w-md mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-foreground">Process Payout #{payout.id}</h3>
        <div className="bg-muted/40 rounded-xl p-3 space-y-1 text-xs">
          <p><span className="text-muted-foreground">Teacher:</span> {payout.teacher_name ?? `ID ${payout.teacher_id}`}</p>
          <p><span className="text-muted-foreground">Net Payout:</span> <strong>{parseFloat(payout.net_payout).toLocaleString()} EGP</strong></p>
          <p><span className="text-muted-foreground">Method:</span> {payout.method}</p>
          <p><span className="text-muted-foreground">Period:</span> {new Date(payout.period_start).toLocaleDateString()} – {new Date(payout.period_end).toLocaleDateString()}</p>
        </div>
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="InstaPay reference (optional)"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <div className="flex gap-2">
          <button
            onClick={() => processMutation.mutate()}
            disabled={processMutation.isPending}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg py-2.5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CheckCircle className="h-3.5 w-3.5" /> {processMutation.isPending ? "Processing…" : "Mark as Paid"}
          </button>
          <button
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            className="px-4 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors"
          >
            Cancel
          </button>
          <button onClick={onClose} className="px-3 text-sm text-muted-foreground hover:bg-muted rounded-lg transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TeacherPayoutsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [processing, setProcessing] = useState<Payout | null>(null);
  const [calcTeacherId, setCalcTeacherId] = useState("");

  const { data: overviewData, isLoading: ovLoading } = useQuery<{ overview: Overview; platform_cut_percent: number }>({
    queryKey: ["payout-overview"],
    queryFn: () => apiFetch("/api/payouts/overview").then((r) => r.json()),
    refetchInterval: 60_000,
  });

  const { data: pendingData, isLoading: pendLoading, refetch, isFetching } = useQuery<{ payouts: Payout[] }>({
    queryKey: ["pending-payouts"],
    queryFn: () => apiFetch("/api/payouts/pending").then((r) => r.json()),
  });

  const batchMutation = useMutation({
    mutationFn: () => apiFetch("/api/payouts/batch-calculate", { method: "POST" }).then((r) => r.json()),
    onSuccess: (d) => {
      if (d.error) { toast({ title: "Batch failed", description: d.error, variant: "destructive" }); return; }
      toast({ title: "Batch calculation complete", description: `${d.summary.created} payouts created · ${d.summary.skipped} skipped` });
      qc.invalidateQueries({ queryKey: ["pending-payouts"] });
      qc.invalidateQueries({ queryKey: ["payout-overview"] });
    },
  });

  const calcMutation = useMutation({
    mutationFn: (teacherId: number) =>
      apiFetch(`/api/payouts/calculate/${teacherId}`, { method: "POST" }).then((r) => r.json()),
    onSuccess: (d) => {
      if (d.error) { toast({ title: "Failed", description: d.error, variant: "destructive" }); return; }
      toast({ title: "Payout created", description: `${parseFloat(d.payout.net_payout).toLocaleString()} EGP` });
      setCalcTeacherId("");
      qc.invalidateQueries({ queryKey: ["pending-payouts"] });
    },
  });

  const o = overviewData?.overview;
  const payouts = pendingData?.payouts ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Teacher Payout Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Revenue split: <strong>{overviewData?.platform_cut_percent ?? 15}% platform</strong> / <strong>{100 - (overviewData?.platform_cut_percent ?? 15)}% teacher</strong> · derived from ledger only
          </p>
        </div>
        <button onClick={() => refetch()} className="p-2 border border-border rounded-lg hover:bg-muted transition-colors">
          <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isFetching && "animate-spin")} />
        </button>
      </div>

      {ovLoading ? (
        <div className="animate-pulse grid grid-cols-3 gap-3">{[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl" />)}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: "Pending Payouts", value: o?.pending_count ?? 0, sub: `${parseFloat(o?.pending_amount ?? "0").toLocaleString()} EGP`, color: (o?.pending_count ?? 0) > 0 ? "text-amber-600" : "text-foreground" },
            { label: "Paid Out",         value: o?.paid_count ?? 0,    sub: `${parseFloat(o?.total_paid_out ?? "0").toLocaleString()} EGP total`, color: "text-emerald-600" },
            { label: "Teachers",         value: o?.teachers_with_payouts ?? 0, sub: "with payout records", color: "text-foreground" },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={cn("text-2xl font-bold tabular-nums mt-0.5", color)}>{value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => batchMutation.mutate()}
          disabled={batchMutation.isPending}
          className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg px-4 py-2.5 transition-colors disabled:opacity-50"
        >
          <Play className="h-3.5 w-3.5" />
          {batchMutation.isPending ? "Calculating…" : "Batch Calculate All Teachers"}
        </button>
        <div className="flex gap-2">
          <input
            type="number"
            value={calcTeacherId}
            onChange={(e) => setCalcTeacherId(e.target.value)}
            placeholder="Teacher account ID"
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 w-44"
          />
          <button
            onClick={() => calcMutation.mutate(parseInt(calcTeacherId))}
            disabled={calcMutation.isPending || !calcTeacherId}
            className="text-sm font-medium border border-border rounded-lg px-4 py-2 hover:bg-muted transition-colors disabled:opacity-50"
          >
            {calcMutation.isPending ? "…" : "Calculate"}
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Pending Payouts</p>
          <p className="text-xs text-muted-foreground">Ledger-derived — no manual overrides</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["#","Teacher","Gross","Net Payout","Method","Period","Status",""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pendLoading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">Loading…</td></tr>
            ) : payouts.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">No pending payouts — run batch calculate to generate them</td></tr>
            ) : payouts.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">#{p.id}</td>
                <td className="px-4 py-3">
                  <p className="text-xs font-medium text-foreground">{p.teacher_name ?? `#${p.teacher_id}`}</p>
                  <p className="text-[11px] text-muted-foreground">{p.teacher_email ?? ""}</p>
                </td>
                <td className="px-4 py-3 text-xs tabular-nums">{parseFloat(p.gross_amount).toLocaleString()} EGP</td>
                <td className="px-4 py-3 text-xs font-bold tabular-nums text-emerald-600">{parseFloat(p.net_payout).toLocaleString()} EGP</td>
                <td className="px-4 py-3 text-xs capitalize">{p.method}</td>
                <td className="px-4 py-3 text-[11px] text-muted-foreground">
                  {new Date(p.period_start).toLocaleDateString()} – {new Date(p.period_end).toLocaleDateString()}
                </td>
                <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                <td className="px-4 py-3">
                  {p.status === "pending" && (
                    <button
                      onClick={() => setProcessing(p)}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                    >
                      Pay <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {processing && <ProcessModal payout={processing} onClose={() => setProcessing(null)} />}
    </div>
  );
}
