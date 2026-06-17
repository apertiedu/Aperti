import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw, ReceiptText, Clock, CheckCircle2, AlertTriangle,
  Play, Eye, TrendingUp, DollarSign, Users, CalendarClock,
  Info, Zap,
} from "lucide-react";
import { useState } from "react";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Renewal {
  subscription_id: number;
  user_id: number;
  end_date: string;
  auto_renew: boolean;
  plan_name: string;
  plan_price: string;
  discount_pct: string;
  user_name: string;
  user_email: string;
  days_until_expiry: number;
  renewal_invoice_id: number | null;
  renewal_invoice_number: string | null;
  renewal_invoice_status: string | null;
  renewal_invoice_total: string | null;
}

interface Stats {
  created_today: number;
  created_this_week: number;
  created_this_month: number;
  paid_count: number;
  overdue_count: number;
  pending_count: number;
  total_collected: string;
  total_outstanding: string;
  expiring_7_days: number;
}

interface RunResult {
  processed: number;
  created: number;
  skipped: number;
  errors: Array<{ subscriptionId: number; reason: string }>;
  invoices: Array<{
    subscription_id: number;
    invoice_id: number;
    invoice_number: string;
    amount: number;
    due_at: string;
  }>;
  dry_run: boolean;
  ran_at: string;
}

/* ── Helpers ───────────────────────────────────────────────────────────── */
const INV_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  issued:  { bg: "bg-blue-100",    text: "text-blue-700",   label: "Issued" },
  paid:    { bg: "bg-emerald-100", text: "text-emerald-700",label: "Paid" },
  overdue: { bg: "bg-red-100",     text: "text-red-700",    label: "Overdue" },
  void:    { bg: "bg-gray-100",    text: "text-gray-500",   label: "Void" },
};

function urgencyColor(days: number) {
  if (days <= 2) return "text-red-600 font-black";
  if (days <= 4) return "text-orange-600 font-bold";
  return "text-amber-600 font-semibold";
}

function fmt(n: string | number) {
  return `EGP ${parseFloat(String(n)).toFixed(2)}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

/* ── Page ──────────────────────────────────────────────────────────────── */
export default function AutoRenewPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [lastRun, setLastRun] = useState<RunResult | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { data: statsData, isLoading: statsLoading } = useQuery<{ stats: Stats }>({
    queryKey: ["auto-renew-stats"],
    queryFn: async () => {
      const r = await fetch("/api/auto-renew/stats", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const { data: upcomingData, isLoading: upcomingLoading } = useQuery<{ renewals: Renewal[] }>({
    queryKey: ["auto-renew-upcoming"],
    queryFn: async () => {
      const r = await fetch("/api/auto-renew/upcoming", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<{ invoices: any[] }>({
    queryKey: ["auto-renew-history"],
    queryFn: async () => {
      const r = await fetch("/api/auto-renew/history?limit=30", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: showHistory,
  });

  const runMutation = useMutation<RunResult, Error, { dryRun: boolean }>({
    mutationFn: async ({ dryRun }) => {
      const r = await fetch(`/api/auto-renew/run${dryRun ? "?dry=1" : ""}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!r.ok) throw new Error("Job failed");
      return r.json();
    },
    onSuccess: (data) => {
      setLastRun(data);
      qc.invalidateQueries({ queryKey: ["auto-renew-stats"] });
      qc.invalidateQueries({ queryKey: ["auto-renew-upcoming"] });
      qc.invalidateQueries({ queryKey: ["auto-renew-history"] });
      toast({
        title: data.dry_run ? "Dry run complete" : "Auto-renew job complete",
        description: data.dry_run
          ? `Would create ${data.created} invoice(s) for ${data.processed} expiring subscription(s).`
          : `Created ${data.created} invoice(s). ${data.errors.length} error(s).`,
      });
    },
    onError: () => toast({ title: "Job failed", variant: "destructive" }),
  });

  const stats = statsData?.stats;
  const renewals = upcomingData?.renewals ?? [];
  const needsInvoice = renewals.filter((r) => !r.renewal_invoice_id && r.days_until_expiry <= 7);
  const hasInvoice   = renewals.filter((r) => !!r.renewal_invoice_id);

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-4 sm:p-6 space-y-5">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-teal-100 flex items-center justify-center">
            <ReceiptText className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">Auto-Renew Invoices</h1>
            <p className="text-xs text-gray-400">Generates pending invoices 7 days before subscription expiry · Runs daily</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"
            onClick={() => runMutation.mutate({ dryRun: true })}
            disabled={runMutation.isPending}
            className="text-xs gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Dry Run
          </Button>
          <Button size="sm"
            onClick={() => runMutation.mutate({ dryRun: false })}
            disabled={runMutation.isPending}
            className="text-xs gap-1.5 bg-teal-600 hover:bg-teal-700 text-white">
            {runMutation.isPending
              ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Running…</>
              : <><Play className="h-3.5 w-3.5" /> Run Now</>}
          </Button>
        </div>
      </motion.div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {statsLoading ? (
          [...Array(7)].map((_, i) => <div key={i} className="h-20 bg-white animate-pulse rounded-xl" />)
        ) : ([
          { label: "Expiring (7d)",    value: stats?.expiring_7_days ?? 0,   color: "text-amber-700",   bg: "bg-amber-50",   icon: CalendarClock },
          { label: "Today",            value: stats?.created_today ?? 0,      color: "text-teal-700",    bg: "bg-teal-50",    icon: Zap },
          { label: "This Week",        value: stats?.created_this_week ?? 0,  color: "text-blue-700",    bg: "bg-blue-50",    icon: TrendingUp },
          { label: "Pending",          value: stats?.pending_count ?? 0,      color: "text-gray-700",    bg: "bg-gray-50",    icon: Clock },
          { label: "Paid",             value: stats?.paid_count ?? 0,         color: "text-emerald-700", bg: "bg-emerald-50", icon: CheckCircle2 },
          { label: "Overdue",          value: stats?.overdue_count ?? 0,      color: "text-red-700",     bg: "bg-red-50",     icon: AlertTriangle },
          { label: "Collected",        value: fmt(stats?.total_collected ?? 0), color: "text-emerald-700", bg: "bg-emerald-50", icon: DollarSign },
        ].map((k) => (
          <div key={k.label} className={`p-3 rounded-xl text-center ${k.bg}`}>
            <k.icon className={`h-4 w-4 mx-auto mb-1 ${k.color} opacity-70`} />
            <p className={`text-lg font-black leading-tight ${k.color}`}>{k.value}</p>
            <p className={`text-[9px] font-bold uppercase ${k.color} opacity-70`}>{k.label}</p>
          </div>
        )))}
      </div>

      {/* Last run result */}
      <AnimatePresence>
        {lastRun && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className={`rounded-xl border-2 p-4 ${lastRun.dry_run ? "bg-blue-50 border-blue-200" : "bg-emerald-50 border-emerald-200"}`}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className={`h-4 w-4 ${lastRun.dry_run ? "text-blue-600" : "text-emerald-600"}`} />
                <p className={`text-sm font-bold ${lastRun.dry_run ? "text-blue-800" : "text-emerald-800"}`}>
                  {lastRun.dry_run ? "Dry Run Result" : "Job Complete"} · {new Date(lastRun.ran_at).toLocaleTimeString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                <span className="text-gray-700">Processed: <strong>{lastRun.processed}</strong></span>
                <span className="text-emerald-700">Invoices {lastRun.dry_run ? "would create" : "created"}: <strong>{lastRun.created}</strong></span>
                {lastRun.errors.length > 0 && <span className="text-red-700">Errors: <strong>{lastRun.errors.length}</strong></span>}
              </div>
              {lastRun.invoices.length > 0 && (
                <div className="mt-3 space-y-1">
                  {lastRun.invoices.map((inv) => (
                    <div key={inv.invoice_id} className="flex items-center gap-3 text-xs bg-white rounded-lg px-3 py-1.5 border border-gray-100">
                      <ReceiptText className="h-3 w-3 text-teal-500 shrink-0" />
                      <span className="font-mono font-bold">{inv.invoice_number}</span>
                      <span className="text-gray-500">Sub #{inv.subscription_id}</span>
                      <span className="ml-auto font-bold text-teal-700">{fmt(inv.amount)}</span>
                      <span className="text-gray-400">due {fmtDate(inv.due_at)}</span>
                    </div>
                  ))}
                </div>
              )}
              {lastRun.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  {lastRun.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600">Sub #{e.subscriptionId}: {e.reason.slice(0, 120)}</p>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Needs invoice — action required */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Needs Invoice ({needsInvoice.length})
              <span className="text-[10px] text-gray-400 font-normal">Expiring ≤7 days · no renewal invoice yet</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {upcomingLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-gray-50 animate-pulse rounded-lg" />)}</div>
            ) : needsInvoice.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <CheckCircle2 className="h-7 w-7 mx-auto mb-2 text-emerald-300" />
                <p className="text-xs font-semibold">All expiring subscriptions have invoices</p>
              </div>
            ) : (
              <div className="space-y-2">
                {needsInvoice.map((r) => {
                  const price = parseFloat(r.plan_price);
                  const disc  = parseFloat(r.discount_pct) || 0;
                  const total = price - (price * disc / 100);
                  return (
                    <div key={r.subscription_id} className="flex items-center gap-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className={`text-[11px] font-black ${urgencyColor(r.days_until_expiry)} w-12 text-center shrink-0`}>
                        {r.days_until_expiry}d
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{r.user_name}</p>
                        <p className="text-[10px] text-gray-500">{r.plan_name} · expires {fmtDate(r.end_date)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-teal-700">{fmt(total)}</p>
                        {disc > 0 && <p className="text-[9px] text-gray-400">{disc}% off</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Has invoice — invoice already generated */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-teal-500" />
              Invoice Generated ({hasInvoice.length})
              <span className="text-[10px] text-gray-400 font-normal">Renewal invoice already issued</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {upcomingLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-gray-50 animate-pulse rounded-lg" />)}</div>
            ) : hasInvoice.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Clock className="h-7 w-7 mx-auto mb-2 text-gray-200" />
                <p className="text-xs font-semibold">No invoices generated yet</p>
                <p className="text-[10px] mt-1">Run the job to generate invoices for expiring subscriptions</p>
              </div>
            ) : (
              <div className="space-y-2">
                {hasInvoice.map((r) => {
                  const cfg = INV_STATUS[r.renewal_invoice_status ?? "issued"] ?? INV_STATUS.issued;
                  return (
                    <div key={r.subscription_id} className="flex items-center gap-3 p-2.5 bg-white border border-gray-100 rounded-xl">
                      <div className={`text-[11px] font-bold ${urgencyColor(r.days_until_expiry)} w-12 text-center shrink-0`}>
                        {r.days_until_expiry}d
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-gray-900 truncate">{r.user_name}</p>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 font-mono">{r.renewal_invoice_number}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-teal-700">{fmt(r.renewal_invoice_total ?? 0)}</p>
                        <p className="text-[9px] text-gray-400">due {fmtDate(r.end_date)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice history */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gray-400" />
              Renewal Invoice History
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowHistory((v) => !v)}>
              {showHistory ? "Hide" : "Show"} History
            </Button>
          </div>
        </CardHeader>
        <AnimatePresence>
          {showHistory && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <CardContent className="p-3 pt-0">
                {historyLoading ? (
                  <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-50 animate-pulse rounded-lg" />)}</div>
                ) : !historyData?.invoices.length ? (
                  <div className="text-center py-6 text-gray-400 text-xs">No renewal invoices generated yet</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100">
                          {["Invoice #","User","Plan","Amount","Due","Status","Issued"].map((h) => (
                            <th key={h} className="pb-2 px-2 text-left text-[10px] font-bold text-gray-400 uppercase whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.invoices.map((inv) => {
                          const cfg = INV_STATUS[inv.status] ?? INV_STATUS.issued;
                          return (
                            <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                              <td className="py-2 px-2 font-mono font-bold text-teal-700 whitespace-nowrap">{inv.invoice_number}</td>
                              <td className="py-2 px-2 font-semibold truncate max-w-[120px]">{inv.user_name}</td>
                              <td className="py-2 px-2 text-gray-500 truncate max-w-[100px]">{inv.plan_name}</td>
                              <td className="py-2 px-2 font-bold text-gray-800 whitespace-nowrap">{fmt(inv.total)}</td>
                              <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{inv.due_at ? fmtDate(inv.due_at) : "—"}</td>
                              <td className="py-2 px-2">
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                              </td>
                              <td className="py-2 px-2 text-gray-400 whitespace-nowrap">{fmtDate(inv.issued_at)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* How it works */}
      <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
        <Info className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
        <div className="text-[10px] text-gray-400 space-y-0.5">
          <p><strong className="text-gray-600">How it works:</strong> Every 24 hours the scheduler queries active subscriptions with auto-renew enabled that expire in 6–8 days.</p>
          <p>For each one without an existing renewal invoice, it generates a <strong>RENEW-YYYYMM-XXXXXX</strong> invoice, sets it as the subscription's pending invoice, and sends an in-app notification to the subscriber.</p>
          <p>Idempotent — running the job multiple times will never generate duplicate invoices for the same subscription window.</p>
        </div>
      </div>
    </div>
  );
}
