import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CreditCard, Shield, CheckCircle2, XCircle, AlertTriangle, Clock,
  Lock, RefreshCw, ChevronRight, Activity, Ban, RotateCcw, Zap,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const STATE_CONFIG: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  inactive:             { color: "text-gray-500",   bg: "bg-gray-100",    icon: Clock,         label: "Inactive" },
  pending_payment:      { color: "text-amber-700",  bg: "bg-amber-100",   icon: Clock,         label: "Pending Payment" },
  pending_confirmation: { color: "text-blue-700",   bg: "bg-blue-100",    icon: Lock,          label: "Pending Confirmation" },
  active:               { color: "text-emerald-700",bg: "bg-emerald-100", icon: CheckCircle2,  label: "Active" },
  grace_period:         { color: "text-orange-700", bg: "bg-orange-100",  icon: AlertTriangle, label: "Grace Period" },
  expired:              { color: "text-red-700",    bg: "bg-red-100",     icon: XCircle,       label: "Expired" },
  suspended:            { color: "text-rose-700",   bg: "bg-rose-100",    icon: Ban,           label: "Suspended" },
};

function StateBadge({ status }: { status: string }) {
  const cfg = STATE_CONFIG[status] ?? STATE_CONFIG.inactive;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.color}`}>
      <Icon className="h-3 w-3" />{cfg.label}
    </span>
  );
}

const FSM_FLOW = [
  { from: "inactive",             to: "pending_payment",      trigger: "User initiates checkout" },
  { from: "pending_payment",      to: "pending_confirmation", trigger: "User submits Instapay code" },
  { from: "pending_confirmation", to: "active",               trigger: "Admin confirms + ledger entry created" },
  { from: "active",               to: "grace_period",         trigger: "Subscription expires (auto)" },
  { from: "grace_period",         to: "expired",              trigger: "Grace period (3 days) ends" },
  { from: "active",               to: "suspended",            trigger: "Admin suspends account" },
  { from: "suspended",            to: "active",               trigger: "Admin restores" },
  { from: "expired",              to: "pending_payment",      trigger: "User re-subscribes" },
];

function PendingCard({ sub, onConfirm, onReject, busy }: { sub: any; onConfirm: (id: number) => void; onReject: (id: number) => void; busy: boolean }) {
  return (
    <Card className={`border-0 shadow-sm ${sub.fraud_flagged ? "ring-2 ring-red-300" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-gray-900">{sub.display_name}</p>
              {sub.fraud_flagged && (
                <Badge className="bg-red-100 text-red-800 border-red-200 border text-[10px]">FRAUD FLAG</Badge>
              )}
            </div>
            <p className="text-xs text-gray-400">@{sub.username} · {sub.email}</p>
          </div>
          <StateBadge status={sub.status} />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            { label: "Plan",       value: sub.plan_name },
            { label: "Amount",     value: `EGP ${parseFloat(sub.price_egp ?? "0").toLocaleString()}` },
            { label: "Reference",  value: sub.payment_reference ?? "—" },
            { label: "Instapay",   value: sub.instapay_code ?? "—" },
            { label: "Attempts",   value: sub.payment_attempt_count ?? 0 },
            { label: "Invoice",    value: sub.invoice_number ?? "—" },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] text-gray-400">{label}</p>
              <p className="text-xs font-semibold text-gray-800 truncate">{String(value)}</p>
            </div>
          ))}
        </div>
        {sub.screenshot_url && (
          <a href={sub.screenshot_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline mb-3 block">
            View payment proof
          </a>
        )}
        {sub.fraud_flagged && Array.isArray(sub.fraud_flags) && sub.fraud_flags.length > 0 && (
          <div className="mb-3 p-2 bg-red-50 border border-red-100 rounded-lg">
            <p className="text-[10px] font-bold text-red-700 mb-1">Fraud Flags:</p>
            {sub.fraud_flags.map((f: string, i: number) => (
              <p key={i} className="text-[10px] text-red-600">{f}</p>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs"
            disabled={busy}
            onClick={() => onConfirm(sub.id)}
          >
            <CheckCircle2 className="h-3 w-3" />Confirm
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-red-200 text-red-700 hover:bg-red-50 gap-1 text-xs"
            disabled={busy}
            onClick={() => onReject(sub.id)}
          >
            <XCircle className="h-3 w-3" />Reject
          </Button>
        </div>
        <p className="text-[10px] text-gray-400 mt-2">{new Date(sub.created_at).toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

export default function SubscriptionEngine() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"overview" | "pending" | "all" | "audit">("overview");
  const [filterStatus, setFilterStatus] = useState("all");
  const [busyId, setBusyId] = useState<number | null>(null);

  const { data: overview } = useQuery<any>({
    queryKey: ["sub-engine-overview"],
    queryFn: async () => {
      const r = await fetch("/api/sub-engine/admin/overview", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const { data: pending, isLoading: pendingLoading } = useQuery<any>({
    queryKey: ["sub-engine-pending"],
    queryFn: async () => {
      const r = await fetch("/api/sub-engine/admin/pending-payments", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 15_000,
  });

  const { data: allSubs, isLoading: allLoading } = useQuery<any>({
    queryKey: ["sub-engine-all", filterStatus],
    queryFn: async () => {
      const qs = filterStatus !== "all" ? `?status=${filterStatus}` : "";
      const r = await fetch(`/api/sub-engine/admin/all${qs}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: tab === "all",
    refetchInterval: 60_000,
  });

  const { data: auditLog, isLoading: auditLoading } = useQuery<any>({
    queryKey: ["sub-engine-audit"],
    queryFn: async () => {
      const r = await fetch("/api/sub-engine/admin/audit-log?limit=100", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: tab === "audit",
    refetchInterval: 30_000,
  });

  const confirmMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/sub-engine/admin/confirm/${id}`, {
        method: "POST", credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
    onSuccess: (_, id) => {
      toast({ title: "Subscription activated. Ledger entry created." });
      setBusyId(null);
      qc.invalidateQueries({ queryKey: ["sub-engine-pending"] });
      qc.invalidateQueries({ queryKey: ["sub-engine-overview"] });
      qc.invalidateQueries({ queryKey: ["sub-engine-all"] });
    },
    onError: (err) => {
      toast({ title: (err as Error).message, variant: "destructive" });
      setBusyId(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/sub-engine/admin/reject/${id}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Payment verification failed" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
    onSuccess: () => {
      toast({ title: "Payment rejected. User returned to pending_payment." });
      setBusyId(null);
      qc.invalidateQueries({ queryKey: ["sub-engine-pending"] });
      qc.invalidateQueries({ queryKey: ["sub-engine-overview"] });
    },
    onError: (err) => {
      toast({ title: (err as Error).message, variant: "destructive" });
      setBusyId(null);
    },
  });

  const expiryMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/sub-engine/admin/run-expiry", { method: "POST", credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
    onSuccess: (data) => {
      toast({ title: `Expiry check: ${data.moved_to_grace?.length ?? 0} to grace, ${data.expired?.length ?? 0} expired` });
      qc.invalidateQueries({ queryKey: ["sub-engine-overview"] });
    },
    onError: () => toast({ title: "Expiry check failed", variant: "destructive" }),
  });

  const counts = overview?.counts ?? {};
  const pendingList: any[] = pending?.pending ?? [];
  const allList: any[] = allSubs?.subscriptions ?? [];
  const auditList: any[] = auditLog?.audit_log ?? [];

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "pending",  label: `Pending Confirmations${pendingList.length > 0 ? ` (${pendingList.length})` : ""}` },
    { id: "all",      label: "All Subscriptions" },
    { id: "audit",    label: "Audit Log" },
  ];

  const STATUS_FILTERS = ["all", "active", "pending_payment", "pending_confirmation", "grace_period", "suspended", "expired"];

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Subscription Engine</h1>
              <p className="text-sm text-gray-500">Ledger-backed FSM · strict state control · zero ambiguity</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={expiryMutation.isPending}
            onClick={() => expiryMutation.mutate()}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${expiryMutation.isPending ? "animate-spin" : ""}`} />
            Run Expiry Check
          </Button>
        </div>
      </motion.div>

      {/* State machine flow */}
      <Card className="border-0 shadow-sm mb-6">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">FSM State Flow</p>
          <div className="flex flex-wrap items-center gap-1">
            {FSM_FLOW.map((f, i) => {
              const fromCfg = STATE_CONFIG[f.from];
              const toCfg   = STATE_CONFIG[f.to];
              return (
                <div key={i} className="flex items-center gap-1 text-[10px]">
                  {i > 0 && <span className="text-gray-200 mx-0.5">|</span>}
                  <span className={`px-1.5 py-0.5 rounded ${fromCfg?.bg ?? "bg-gray-100"} ${fromCfg?.color ?? "text-gray-600"} font-semibold`}>{f.from}</span>
                  <ChevronRight className="h-3 w-3 text-gray-300" />
                  <span className={`px-1.5 py-0.5 rounded ${toCfg?.bg ?? "bg-gray-100"} ${toCfg?.color ?? "text-gray-600"} font-semibold`}>{f.to}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Counts strip */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-2 mb-6">
        {[
          { key: "active",               label: "Active",      color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
          { key: "pending_confirmation", label: "Confirm.",    color: "bg-blue-50 text-blue-700 border-blue-200" },
          { key: "pending_payment",      label: "Pmt Pend.",   color: "bg-amber-50 text-amber-700 border-amber-200" },
          { key: "grace_period",         label: "Grace",       color: "bg-orange-50 text-orange-700 border-orange-200" },
          { key: "suspended",            label: "Suspended",   color: "bg-rose-50 text-rose-700 border-rose-200" },
          { key: "expired",              label: "Expired",     color: "bg-red-50 text-red-700 border-red-200" },
          { key: "fraud_flagged",        label: "Fraud",       color: "bg-red-100 text-red-800 border-red-300" },
        ].map(({ key, label, color }) => (
          <div key={key} className={`p-3 rounded-xl border text-center ${color}`}>
            <p className="text-lg font-black">{counts[key] ?? "—"}</p>
            <p className="text-[10px] font-semibold">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 border border-gray-100 shadow-sm w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === t.id ? "bg-teal-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-teal-500" />30-Day Revenue (Ledger Confirmed)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-3xl font-black text-gray-900">EGP {parseFloat(overview?.revenue?.total_confirmed ?? "0").toLocaleString()}</p>
              <p className="text-sm text-gray-400 mt-1">{overview?.revenue?.confirmed_count ?? 0} confirmed payments via ledger</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-500" />System Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              {[
                "Subscription activates ONLY when ledger entry is created",
                "Max 1 active pending invoice per user",
                "Max 3 payment attempts per 10 minutes",
                "Duplicate Instapay codes are blocked at submission",
                "Grace period: 3 days before full expiry",
                "Admin suspension → no self-restore possible",
                "Platform discounts only — no teacher coupon stacking",
              ].map((rule, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-gray-700 py-1 border-b border-gray-50 last:border-0">
                  <Zap className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />{rule}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Recent Audit Events</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {(overview?.recent_audit ?? []).map((a: any) => (
                  <div key={a.id} className="px-4 py-3 hover:bg-gray-50 flex items-center gap-3">
                    <StateBadge status={a.new_status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 truncate">{a.reason}</p>
                      <p className="text-[10px] text-gray-400">{a.user_name ?? "System"} · {a.triggered_by}</p>
                    </div>
                    <p className="text-[10px] text-gray-300 flex-shrink-0">{new Date(a.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pending confirmations */}
      {tab === "pending" && (
        <div>
          {pendingLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-white animate-pulse rounded-xl" />)}
            </div>
          ) : pendingList.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-300" />
              <p className="text-sm font-semibold">No pending confirmations</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingList.map((sub) => (
                <PendingCard
                  key={sub.id}
                  sub={sub}
                  busy={busyId === sub.id || confirmMutation.isPending || rejectMutation.isPending}
                  onConfirm={(id) => { setBusyId(id); confirmMutation.mutate(id); }}
                  onReject={(id) => { setBusyId(id); rejectMutation.mutate(id); }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* All subscriptions */}
      {tab === "all" && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    filterStatus === s ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-500 border-gray-200 hover:border-teal-300"
                  }`}
                >
                  {s === "all" ? "All" : <StateBadge status={s} />}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {allLoading ? (
              <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-xs">User</TableHead>
                      <TableHead className="text-xs">Plan</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs text-right">Days Left</TableHead>
                      <TableHead className="text-xs">Flags</TableHead>
                      <TableHead className="text-xs">Since</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allList.map((sub: any) => (
                      <TableRow key={sub.id} className="hover:bg-gray-50">
                        <TableCell>
                          <p className="text-xs font-semibold text-gray-800">{sub.display_name}</p>
                          <p className="text-[10px] text-gray-400">@{sub.username}</p>
                        </TableCell>
                        <TableCell className="text-xs">{sub.plan_name}</TableCell>
                        <TableCell><StateBadge status={sub.status} /></TableCell>
                        <TableCell className="text-xs text-right font-semibold">
                          EGP {parseFloat(sub.price_egp ?? "0").toLocaleString()}
                        </TableCell>
                        <TableCell className={`text-xs text-right font-bold ${parseFloat(sub.days_remaining ?? "0") < 7 ? "text-amber-600" : "text-gray-700"}`}>
                          {sub.end_date ? Math.max(0, Math.round(parseFloat(sub.days_remaining ?? "0"))) : "—"}
                        </TableCell>
                        <TableCell>
                          {sub.fraud_flagged && (
                            <Badge className="bg-red-100 text-red-800 border-red-200 border text-[9px]">FRAUD</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-[10px] text-gray-400">
                          {new Date(sub.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Audit log */}
      {tab === "audit" && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {auditLoading ? (
              <div className="p-6 space-y-3">{[...Array(8)].map((_, i) => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />)}</div>
            ) : (
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {auditList.map((entry: any) => (
                  <div key={entry.id} className="px-4 py-3 hover:bg-gray-50 flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <StateBadge status={entry.new_status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-semibold text-gray-700">
                          {entry.previous_status} → {entry.new_status}
                        </p>
                        <Badge className="text-[9px] bg-gray-100 text-gray-600 border border-gray-200">{entry.triggered_by}</Badge>
                      </div>
                      <p className="text-[11px] text-gray-600 truncate">{entry.reason}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        User: {entry.user_name ?? `#${entry.user_id}`}
                        {entry.actor_name ? ` · Actor: ${entry.actor_name}` : ""}
                        {` · Sub #${entry.subscription_id}`}
                      </p>
                    </div>
                    <p className="text-[10px] text-gray-300 flex-shrink-0">{new Date(entry.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
