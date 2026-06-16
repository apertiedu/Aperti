import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Shield, CheckCircle, XCircle, Clock, AlertTriangle,
  Users, Tag, FileText, RefreshCw, ChevronDown, Search,
} from "lucide-react";

type Tab = "pending" | "history" | "discounts" | "assignments" | "audit";

interface Transaction {
  id: number; amount: string; currency: string; status: string;
  purpose: string; reference_number: string | null; screenshot_url: string | null;
  created_at: string; username?: string; display_name?: string; email?: string;
  target_id?: number; approver_role?: string; approver_name?: string; decided_at?: string;
  approval_action?: string;
}
interface Coupon {
  id: number; code: string; scope: string; discount_type: string;
  discount_percent: string; max_uses: number | null; used_count: number;
  expiry_date: string | null; is_active: boolean; creator_name?: string;
  teacher_id?: number;
}
interface Assignment {
  id: number; assistant_id: number; teacher_id: number; course_ids: number[];
  active: boolean; created_at: string; assistant_name: string; assistant_email: string; teacher_name?: string;
}
interface AuditEntry {
  id: number; actor_id: number; actor_role: string; action: string;
  target_id: string | null; target_type: string | null;
  ip_address: string | null; result: "success" | "blocked";
  created_at: string; actor_name?: string; metadata?: Record<string, unknown>;
}
interface Dashboard {
  pending: { total: number; course_count: number; subscription_count: number; total_amount: string };
  approvalStats: Array<{ action: string; role: string; count: number }>;
  discountStats: Array<{ scope: string; total_codes: number; total_uses: number }>;
  activeAssistants: number;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blocked: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize", map[status] ?? "bg-muted text-muted-foreground border-border")}>
      {status}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    admin: "bg-purple-50 text-purple-700 border-purple-200",
    super_admin: "bg-purple-50 text-purple-700 border-purple-200",
    teacher: "bg-blue-50 text-blue-700 border-blue-200",
    assistant: "bg-teal-50 text-teal-700 border-teal-200",
    user: "bg-gray-50 text-gray-700 border-gray-200",
  };
  return (
    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize", map[role] ?? "bg-muted text-muted-foreground border-border")}>
      {role}
    </span>
  );
}

function ApproveModal({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");

  const approveMutation = useMutation({
    mutationFn: (action: "approve" | "reject") =>
      apiFetch(`/api/secure-payments/${tx.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      }).then((r) => r.json()),
    onSuccess: (_, action) => {
      toast({ title: action === "approve" ? "Transaction approved" : "Transaction rejected", description: `Reference: ${tx.reference_number ?? tx.id}` });
      qc.invalidateQueries({ queryKey: ["sp-pending"] });
      qc.invalidateQueries({ queryKey: ["sp-dashboard"] });
      onClose();
    },
    onError: (err) => toast({ title: "Action failed", description: (err as Error).message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-foreground mb-4">Review Transaction #{tx.id}</h3>
        <div className="space-y-2 text-sm mb-4">
          {[
            ["User", tx.display_name ?? tx.username ?? "—"],
            ["Amount", `${tx.amount} ${tx.currency}`],
            ["Purpose", tx.purpose.replace(/_/g, " ")],
            ["Reference", tx.reference_number ?? "—"],
            ["Submitted", new Date(tx.created_at).toLocaleDateString()],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium capitalize">{v}</span>
            </div>
          ))}
          {tx.screenshot_url && (
            <a href={tx.screenshot_url} target="_blank" rel="noreferrer" className="text-primary text-xs underline">
              View payment screenshot
            </a>
          )}
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)…"
          rows={2}
          className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary resize-none mb-4"
        />
        <div className="flex gap-2">
          <button
            onClick={() => approveMutation.mutate("approve")}
            disabled={approveMutation.isPending}
            className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
          >
            <CheckCircle className="h-4 w-4" /> Approve
          </button>
          <button
            onClick={() => approveMutation.mutate("reject")}
            disabled={approveMutation.isPending}
            className="flex-1 flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" /> Reject
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSecurityPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: dashboard, isLoading: dashLoading } = useQuery<Dashboard>({
    queryKey: ["sp-dashboard"],
    queryFn: () => apiFetch("/api/secure-payments/dashboard").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const { data: pending, isLoading: pendingLoading, refetch: refetchPending } = useQuery<{ transactions: Transaction[] }>({
    queryKey: ["sp-pending"],
    queryFn: () => apiFetch("/api/secure-payments/pending").then((r) => r.json()),
    enabled: tab === "pending",
    refetchInterval: 15_000,
  });

  const { data: history } = useQuery<{ transactions: Transaction[] }>({
    queryKey: ["sp-history"],
    queryFn: () => apiFetch("/api/secure-payments/history").then((r) => r.json()),
    enabled: tab === "history",
  });

  const { data: discounts, refetch: refetchDiscounts } = useQuery<{ coupons: Coupon[] }>({
    queryKey: ["sp-discounts"],
    queryFn: () => apiFetch("/api/secure-discounts").then((r) => r.json()),
    enabled: tab === "discounts",
  });

  const { data: assignments, refetch: refetchAssignments } = useQuery<{ assignments: Assignment[] }>({
    queryKey: ["sp-assignments"],
    queryFn: () => apiFetch("/api/assistant-assignments").then((r) => r.json()),
    enabled: tab === "assignments",
  });

  const { data: auditData } = useQuery<{ logs: AuditEntry[] }>({
    queryKey: ["sp-audit"],
    queryFn: () => apiFetch("/api/secure-payments/audit-log").then((r) => r.json()),
    enabled: tab === "audit",
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/secure-discounts/${id}/deactivate`, { method: "PATCH" }).then((r) => r.json()),
    onSuccess: () => { toast({ title: "Discount deactivated" }); refetchDiscounts(); },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/assistant-assignments/${id}/revoke`, { method: "PATCH" }).then((r) => r.json()),
    onSuccess: () => { toast({ title: "Assignment revoked" }); refetchAssignments(); qc.invalidateQueries({ queryKey: ["sp-dashboard"] }); },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const tabs: Array<{ id: Tab; label: string; icon: React.ElementType; badge?: number }> = [
    { id: "pending", label: "Pending", icon: Clock, badge: dashboard?.pending?.total ?? 0 },
    { id: "history", label: "History", icon: FileText },
    { id: "discounts", label: "Discounts", icon: Tag },
    { id: "assignments", label: "Assistants", icon: Users, badge: dashboard?.activeAssistants ?? 0 },
    { id: "audit", label: "Audit Log", icon: Shield },
  ];

  const filteredPending = (pending?.transactions ?? []).filter(
    (t) => !search || (t.display_name ?? t.username ?? "").toLowerCase().includes(search.toLowerCase()) || (t.reference_number ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Payment Security
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Role-isolated approvals · scoped discounts · full audit trail
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Pending", value: dashLoading ? "…" : (dashboard?.pending?.total ?? 0), sub: "awaiting approval", warn: (dashboard?.pending?.total ?? 0) > 0 },
          { label: "Course Payments", value: dashLoading ? "…" : (dashboard?.pending?.course_count ?? 0), sub: "course enrollments" },
          { label: "Platform Payments", value: dashLoading ? "…" : (dashboard?.pending?.subscription_count ?? 0), sub: "subscriptions" },
          { label: "Active Assistants", value: dashLoading ? "…" : (dashboard?.activeAssistants ?? 0), sub: "assigned scopes" },
        ].map(({ label, value, sub, warn }) => (
          <div key={label} className={cn("bg-card border rounded-xl p-4", warn ? "border-amber-200" : "border-border")}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-2xl font-bold tabular-nums mt-0.5", warn ? "text-amber-600" : "text-foreground")}>{value}</p>
            <p className="text-[11px] text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {badge !== undefined && badge > 0 && (
              <span className="ml-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-semibold">{badge}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "pending" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or reference…" className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <button onClick={() => refetchPending()} className="p-2 border border-border rounded-lg hover:bg-muted transition-colors">
              <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", pendingLoading && "animate-spin")} />
            </button>
          </div>
          {filteredPending.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {pendingLoading ? "Loading…" : "No pending transactions"}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["ID", "User", "Amount", "Purpose", "Reference", "Submitted", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPending.map((tx) => (
                    <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{tx.id}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{tx.display_name ?? tx.username}</p>
                        <p className="text-[11px] text-muted-foreground">{tx.email}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums">{parseFloat(tx.amount).toLocaleString()} {tx.currency}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", tx.purpose === "course_enrollment" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-violet-50 text-violet-700 border-violet-200")}>
                          {tx.purpose === "course_enrollment" ? "Course" : "Subscription"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{tx.reference_number ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelected(tx)}
                          className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                        >
                          Review <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["ID", "User", "Amount", "Purpose", "Status", "Decided by", "Date"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(history?.transactions ?? []).map((tx) => (
                <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{tx.id}</td>
                  <td className="px-4 py-3 font-medium">{tx.display_name ?? tx.username}</td>
                  <td className="px-4 py-3 tabular-nums font-semibold">{parseFloat(tx.amount).toLocaleString()} {tx.currency}</td>
                  <td className="px-4 py-3 text-xs capitalize">{(tx.purpose ?? "").replace(/_/g, " ")}</td>
                  <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-foreground">{tx.approver_name ?? "—"}</span>
                      {tx.approver_role && <RoleBadge role={tx.approver_role} />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{tx.decided_at ? new Date(tx.decided_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
              {!history?.transactions?.length && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">No history yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "discounts" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Code", "Scope", "Type", "Value", "Uses", "Expires", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(discounts?.coupons ?? []).map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono font-semibold text-xs">{c.code}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", c.scope === "platform_subscription" ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-blue-50 text-blue-700 border-blue-200")}>
                      {c.scope === "platform_subscription" ? "Platform" : "Teacher Courses"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs capitalize">{c.discount_type}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums">
                    {c.discount_type === "percentage" ? `${parseFloat(c.discount_percent)}%` : `${parseFloat(c.discount_percent)} EGP`}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums">{c.used_count} / {c.max_uses ?? "∞"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : "Never"}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.is_active ? "verified" : "rejected"} /></td>
                  <td className="px-4 py-3">
                    {c.is_active && (
                      <button
                        onClick={() => deactivateMutation.mutate(c.id)}
                        className="text-[11px] text-red-500 hover:text-red-600 font-medium transition-colors"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!discounts?.coupons?.length && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">No discount codes</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "assignments" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Assistant", "Teacher", "Courses", "Assigned", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(assignments?.assignments ?? []).map((a) => {
                const courseIds: number[] = Array.isArray(a.course_ids) ? a.course_ids : JSON.parse(String(a.course_ids ?? "[]"));
                return (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{a.assistant_name}</p>
                      <p className="text-[11px] text-muted-foreground">{a.assistant_email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">{a.teacher_name ?? `Teacher #${a.teacher_id}`}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{courseIds.length} course{courseIds.length !== 1 ? "s" : ""}: {courseIds.join(", ")}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => revokeMutation.mutate(a.id)}
                        className="text-[11px] text-red-500 hover:text-red-600 font-medium transition-colors"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!assignments?.assignments?.length && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground text-sm">No assistant assignments</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "audit" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Actor", "Role", "Action", "Target", "IP", "Result", "Time"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(auditData?.logs ?? []).map((log) => (
                <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium text-xs">{log.actor_name ?? `User #${log.actor_id}`}</td>
                  <td className="px-4 py-3"><RoleBadge role={log.actor_role} /></td>
                  <td className="px-4 py-3 font-mono text-[11px] text-foreground">{log.action}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{log.target_type} {log.target_id ? `#${log.target_id}` : ""}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{log.ip_address ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={log.result} /></td>
                  <td className="px-4 py-3 text-[11px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {!auditData?.logs?.length && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">No audit entries yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && <ApproveModal tx={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
