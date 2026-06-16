import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { RefreshCw, ChevronDown, Filter, CheckCircle, XCircle, Scale } from "lucide-react";

type Status = "all" | "pending" | "approved" | "partial" | "rejected";

interface RefundRequest {
  id: number;
  transaction_id: number;
  status: "pending" | "approved" | "partial" | "rejected";
  refund_amount: string;
  reason: string;
  rules_triggered: string[] | string;
  requested_at?: string;
  created_at: string;
  decided_at?: string;
  original_amount?: string;
  currency?: string;
  requester_name?: string;
  requester_email?: string;
  decided_by_name?: string;
  course_name?: string;
}

interface RefundRule {
  id: number;
  name: string;
  condition_type: string;
  condition_value: string;
  action: string;
  refund_percent: number;
  priority: number;
  is_active: boolean;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    partial: "bg-blue-50 text-blue-700 border-blue-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide", map[status] ?? "bg-muted text-muted-foreground border-border")}>
      {status}
    </span>
  );
}

function ProcessModal({ request, onClose }: { request: RefundRequest; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [action, setAction] = useState<"approved" | "partial" | "rejected">("approved");
  const [notes, setNotes] = useState("");

  const processMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/refunds/${request.id}/process`, {
        method: "POST",
        body: JSON.stringify({ action, notes }),
      }).then((r) => r.json()),
    onSuccess: (d) => {
      if (d.error) { toast({ title: "Error", description: d.error, variant: "destructive" }); return; }
      toast({ title: "Refund processed", description: `Status set to ${action}` });
      qc.invalidateQueries({ queryKey: ["admin-refunds"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border shadow-xl p-6 w-full max-w-md mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-foreground">Process Refund — Request #{request.id}</h3>
        <div className="bg-muted/40 rounded-xl p-3 space-y-1 text-xs">
          <p><span className="text-muted-foreground">Student:</span> {request.requester_name ?? "—"}</p>
          <p><span className="text-muted-foreground">Original:</span> {request.original_amount} {request.currency ?? "EGP"}</p>
          <p><span className="text-muted-foreground">Refund amount:</span> {parseFloat(request.refund_amount).toLocaleString()} EGP</p>
          <p><span className="text-muted-foreground">Rules:</span> {
            (Array.isArray(request.rules_triggered) ? request.rules_triggered : JSON.parse(request.rules_triggered || "[]")).join(", ") || "none"
          }</p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Decision</p>
          <div className="flex gap-2">
            {(["approved", "partial", "rejected"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAction(a)}
                className={cn(
                  "flex-1 text-xs py-2 rounded-lg border font-medium capitalize transition-colors",
                  action === a
                    ? a === "rejected" ? "bg-red-50 text-red-700 border-red-300" : a === "partial" ? "bg-blue-50 text-blue-700 border-blue-300" : "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={notes}
          onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
          placeholder="Optional notes…"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          rows={2}
        />
        <div className="flex gap-2">
          <button
            onClick={() => processMutation.mutate()}
            disabled={processMutation.isPending}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg py-2.5 transition-colors disabled:opacity-50"
          >
            {processMutation.isPending ? "Processing…" : "Confirm"}
          </button>
          <button onClick={onClose} className="px-4 text-sm text-muted-foreground hover:bg-muted rounded-lg transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RefundManagementPage() {
  const [statusFilter, setStatusFilter] = useState<Status>("all");
  const [processing, setProcessing] = useState<RefundRequest | null>(null);
  const [tab, setTab] = useState<"requests" | "rules">("requests");

  const { data: reqData, isLoading, refetch, isFetching } = useQuery<{ refund_requests: RefundRequest[] }>({
    queryKey: ["admin-refunds", statusFilter],
    queryFn: () =>
      apiFetch(`/api/refunds${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`).then((r) => r.json()),
  });

  const { data: rulesData } = useQuery<{ rules: RefundRule[] }>({
    queryKey: ["refund-rules"],
    queryFn: () => apiFetch("/api/refunds/rules").then((r) => r.json()),
  });

  const requests = reqData?.refund_requests ?? [];
  const rules = rulesData?.rules ?? [];

  const counts = requests.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Refund Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Rule-based automatic refund evaluation · admin override</p>
        </div>
        <button onClick={() => refetch()} className="p-2 border border-border rounded-lg hover:bg-muted transition-colors">
          <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isFetching && "animate-spin")} />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Pending", value: counts.pending ?? 0, color: "text-amber-600" },
          { label: "Approved", value: counts.approved ?? 0, color: "text-emerald-600" },
          { label: "Partial", value: counts.partial ?? 0, color: "text-blue-600" },
          { label: "Rejected", value: counts.rejected ?? 0, color: "text-red-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-2xl font-bold tabular-nums mt-0.5", color)}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-border">
        {(["requests", "rules"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium capitalize transition-colors",
              tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "requests" && (
        <>
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            {(["all", "pending", "approved", "partial", "rejected"] as Status[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "text-xs px-3 py-1 rounded-full border capitalize transition-colors",
                  statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["#", "Student", "Course", "Amount", "Refund", "Status", "Rules", "Date", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground text-sm">Loading…</td></tr>
                ) : requests.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground text-sm">No refund requests</td></tr>
                ) : requests.map((r) => {
                  const rules2: string[] = Array.isArray(r.rules_triggered) ? r.rules_triggered : JSON.parse(r.rules_triggered || "[]");
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{r.id}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium">{r.requester_name ?? "—"}</p>
                        <p className="text-[11px] text-muted-foreground">{r.requester_email ?? ""}</p>
                      </td>
                      <td className="px-4 py-3 text-xs">{r.course_name ?? "—"}</td>
                      <td className="px-4 py-3 text-xs tabular-nums">{r.original_amount ? `${parseFloat(r.original_amount).toLocaleString()} ${r.currency ?? "EGP"}` : "—"}</td>
                      <td className="px-4 py-3 text-xs font-semibold tabular-nums text-primary">{parseFloat(r.refund_amount).toLocaleString()} EGP</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {rules2.slice(0, 1).map((rule) => <span key={rule} className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{rule}</span>)}
                          {rules2.length > 1 && <span className="text-[10px] text-muted-foreground">+{rules2.length - 1}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {r.status === "pending" && (
                          <button
                            onClick={() => setProcessing(r)}
                            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                          >
                            Review <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
                          </button>
                        )}
                        {r.status !== "pending" && (
                          <span className="text-[11px] text-muted-foreground">{r.decided_by_name ? `by ${r.decided_by_name}` : "auto"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "rules" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Name", "Condition", "Value", "Action", "Refund %", "Priority", "Active"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium text-foreground text-xs">{rule.name}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{rule.condition_type}</td>
                  <td className="px-4 py-3 text-xs font-mono">{rule.condition_value}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase", rule.action === "full" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : rule.action === "partial" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-red-50 text-red-700 border-red-200")}>
                      {rule.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-bold tabular-nums">{rule.refund_percent}%</td>
                  <td className="px-4 py-3 text-xs tabular-nums">{rule.priority}</td>
                  <td className="px-4 py-3">
                    {rule.is_active ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">No refund rules configured</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {processing && <ProcessModal request={processing} onClose={() => setProcessing(null)} />}
    </div>
  );
}
