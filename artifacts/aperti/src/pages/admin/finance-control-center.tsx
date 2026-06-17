import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  DollarSign, Users, TrendingUp, AlertTriangle, ShieldAlert, LifeBuoy,
  FlaskConical, Activity, CreditCard, CheckCircle2, XCircle, ArrowRight,
  Lock, Zap, RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const fade = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };
const transition = (delay = 0) => ({ transition: { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] } });

function KpiCard({ label, value, sub, icon: Icon, accent, href }: { label: string; value: string | number; sub?: string; icon: any; accent: string; href?: string }) {
  const accentMap: Record<string, string> = {
    teal:    "from-teal-500 to-teal-600",
    emerald: "from-emerald-500 to-emerald-600",
    blue:    "from-blue-500 to-blue-600",
    amber:   "from-amber-500 to-amber-600",
    rose:    "from-rose-500 to-rose-600",
    purple:  "from-purple-500 to-purple-600",
    orange:  "from-orange-500 to-orange-600",
  };
  const card = (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4">
        <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${accentMap[accent]} flex items-center justify-center mb-3`}>
          <Icon className="h-4.5 w-4.5 text-white" />
        </div>
        <p className="text-2xl font-black text-gray-900">{value}</p>
        <p className="text-xs font-semibold text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

function QuickLink({ icon: Icon, label, href, desc, color = "teal" }: { icon: any; label: string; href: string; desc: string; color?: string }) {
  const colors: Record<string, string> = {
    teal:   "bg-teal-50 text-teal-700 border-teal-100",
    blue:   "bg-blue-50 text-blue-700 border-blue-100",
    amber:  "bg-amber-50 text-amber-700 border-amber-100",
    rose:   "bg-rose-50 text-rose-700 border-rose-100",
    purple: "bg-purple-50 text-purple-700 border-purple-100",
    orange: "bg-orange-50 text-orange-700 border-orange-100",
  };
  return (
    <Link href={href}>
      <div className={`p-4 rounded-xl border flex items-start gap-3 hover:shadow-sm transition-all cursor-pointer group ${colors[color]}`}>
        <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">{label}</p>
          <p className="text-xs opacity-70 mt-0.5">{desc}</p>
        </div>
        <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
      </div>
    </Link>
  );
}

export default function FinanceControlCenter() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: analytics } = useQuery<any>({
    queryKey: ["fcc-analytics"],
    queryFn: async () => {
      const r = await fetch("/api/sub-analytics/overview", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const { data: engineData } = useQuery<any>({
    queryKey: ["fcc-engine"],
    queryFn: async () => {
      const r = await fetch("/api/sub-engine/admin/overview", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const { data: recentEvents } = useQuery<any>({
    queryKey: ["fcc-events"],
    queryFn: async () => {
      const r = await fetch("/api/billing-events/recent?limit=15", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 15_000,
  });

  const { data: recoveries } = useQuery<any>({
    queryKey: ["fcc-recoveries"],
    queryFn: async () => {
      const r = await fetch("/api/payment-recovery/admin/all?status=retry_scheduled", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const { data: experiments } = useQuery<any>({
    queryKey: ["fcc-experiments"],
    queryFn: async () => {
      const r = await fetch("/api/pricing-experiments/admin/all", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const expiryMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/sub-engine/admin/run-expiry", { method: "POST", credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
    onSuccess: (d) => {
      toast({ title: `Expiry: ${d.moved_to_grace?.length ?? 0} to grace, ${d.expired?.length ?? 0} expired` });
      qc.invalidateQueries({ queryKey: ["fcc-engine"] });
    },
  });

  const snapshotMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/sub-analytics/snapshot", { method: "POST", credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
    onSuccess: () => { toast({ title: "Analytics snapshot saved" }); qc.invalidateQueries({ queryKey: ["fcc-analytics"] }); },
  });

  const ov = analytics ?? {};
  const eng = engineData?.counts ?? {};
  const events: any[] = recentEvents?.events ?? [];
  const recoveryCount = recoveries?.counts?.scheduled ?? 0;
  const activeExps = (experiments?.experiments ?? []).filter((e: any) => e.status === "active").length;
  const fraudCount = eng.fraud_flagged ?? 0;
  const pendingConfirm = eng.pending_confirmation ?? 0;

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div {...fade} {...transition(0)} className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Finance Control Center</h1>
            <p className="text-sm text-gray-400">Ledger · Events · Analytics · Fraud · Recovery · Experiments</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" disabled={expiryMutation.isPending}
            onClick={() => expiryMutation.mutate()}>
            <RefreshCw className={`h-3.5 w-3.5 ${expiryMutation.isPending ? "animate-spin" : ""}`} />
            Run Expiry Check
          </Button>
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
            disabled={snapshotMutation.isPending}
            onClick={() => snapshotMutation.mutate()}>
            <Activity className="h-3.5 w-3.5" />Save Snapshot
          </Button>
        </div>
      </motion.div>

      {/* Alerts bar */}
      {(fraudCount > 0 || pendingConfirm > 0 || recoveryCount > 0) && (
        <motion.div {...fade} {...transition(0.05)} className="mb-6 flex flex-wrap gap-2">
          {fraudCount > 0 && (
            <Link href="/admin/subscription-engine">
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer hover:bg-red-100 transition-colors">
                <AlertTriangle className="h-3.5 w-3.5" />{fraudCount} fraud-flagged subscription{fraudCount !== 1 ? "s" : ""}
              </div>
            </Link>
          )}
          {pendingConfirm > 0 && (
            <Link href="/admin/subscription-engine">
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer hover:bg-blue-100 transition-colors">
                <Lock className="h-3.5 w-3.5" />{pendingConfirm} pending confirmation{pendingConfirm !== 1 ? "s" : ""}
              </div>
            </Link>
          )}
          {recoveryCount > 0 && (
            <Link href="/admin/payment-recovery">
              <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-700 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer hover:bg-orange-100 transition-colors">
                <LifeBuoy className="h-3.5 w-3.5" />{recoveryCount} recovery scheduled
              </div>
            </Link>
          )}
        </motion.div>
      )}

      {/* Revenue KPIs */}
      <motion.div {...fade} {...transition(0.1)}>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Revenue Overview</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KpiCard label="MRR" value={`EGP ${(ov.mrr ?? 0).toLocaleString()}`} sub="Ledger-confirmed" icon={DollarSign} accent="teal" href="/admin/subscription-analytics" />
          <KpiCard label="ARR" value={`EGP ${(ov.arr ?? 0).toLocaleString()}`} sub="Annualized" icon={TrendingUp} accent="emerald" href="/admin/subscription-analytics" />
          <KpiCard label="Active" value={ov.active_subscriptions ?? 0} sub="+ grace period" icon={Users} accent="blue" href="/admin/subscription-engine" />
          <KpiCard label="Churn Rate" value={`${ov.churn_rate ?? 0}%`} sub={`Retention ${ov.retention_rate ?? 0}%`} icon={TrendingUp} accent="amber" href="/admin/subscription-analytics" />
        </div>
      </motion.div>

      {/* FSM State strip */}
      <motion.div {...fade} {...transition(0.15)}>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Subscription States</p>
        <div className="grid grid-cols-3 md:grid-cols-7 gap-2 mb-6">
          {[
            { key: "active",               label: "Active",      c: "bg-emerald-50 text-emerald-700" },
            { key: "pending_confirmation", label: "Confirming",  c: "bg-blue-50 text-blue-700" },
            { key: "pending_payment",      label: "Pending",     c: "bg-amber-50 text-amber-700" },
            { key: "grace_period",         label: "Grace",       c: "bg-orange-50 text-orange-700" },
            { key: "suspended",            label: "Suspended",   c: "bg-rose-50 text-rose-700" },
            { key: "expired",              label: "Expired",     c: "bg-red-50 text-red-700" },
            { key: "fraud_flagged",        label: "Fraud",       c: "bg-red-100 text-red-800" },
          ].map(({ key, label, c }) => (
            <div key={key} className={`p-2 rounded-xl text-center ${c}`}>
              <p className="text-lg font-black">{eng[key] ?? 0}</p>
              <p className="text-[10px] font-semibold">{label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Recent Billing Events */}
        <motion.div {...fade} {...transition(0.2)} className="lg:col-span-2">
          <Card className="border-0 shadow-sm h-full">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />Billing Events
              </CardTitle>
              <Link href="/admin/billing-events">
                <span className="text-xs text-teal-600 hover:underline flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></span>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y max-h-64 overflow-y-auto">
                {events.map((e: any) => (
                  <div key={e.id} className="px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3">
                    <span className="text-[11px] font-bold text-blue-600 flex-shrink-0">{e.type}</span>
                    <span className="text-xs text-gray-500 truncate flex-1">{e.user_name ?? "system"}</span>
                    <span className="text-[10px] text-gray-300 flex-shrink-0">{new Date(e.created_at).toLocaleTimeString()}</span>
                  </div>
                ))}
                {events.length === 0 && <div className="px-4 py-8 text-center text-xs text-gray-400">No events yet</div>}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Navigation */}
        <motion.div {...fade} {...transition(0.25)}>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Quick Navigation</p>
          <div className="space-y-2">
            <QuickLink icon={CreditCard}  label="Subscription Engine"       href="/admin/subscription-engine"   desc="FSM states, confirm payments, audit log"        color="teal" />
            <QuickLink icon={TrendingUp}  label="Analytics"                 href="/admin/subscription-analytics" desc="MRR, churn, retention, funnel"                 color="blue" />
            <QuickLink icon={LifeBuoy}    label="Payment Recovery"          href="/admin/payment-recovery"      desc="Rescue failed payments, retry queue"             color="orange" />
            <QuickLink icon={FlaskConical}label="Pricing Experiments"       href="/admin/pricing-experiments"   desc={`${activeExps} active A/B test${activeExps !== 1 ? "s" : ""}`} color="purple" />
            <QuickLink icon={Activity}    label="Billing Event Stream"      href="/admin/billing-events"        desc="Append-only audit of all financial events"       color="blue" />
            <QuickLink icon={ShieldAlert} label="Fraud Alerts"              href="/admin/subscription-engine"   desc={fraudCount > 0 ? `${fraudCount} flagged` : "No flags"}  color="rose" />
          </div>
        </motion.div>
      </div>

      {/* Active Experiments snapshot */}
      {activeExps > 0 && (
        <motion.div {...fade} {...transition(0.3)}>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-purple-500" />Active Pricing Experiments ({activeExps})
              </CardTitle>
              <Link href="/admin/pricing-experiments">
                <span className="text-xs text-teal-600 hover:underline flex items-center gap-1">Manage <ArrowRight className="h-3 w-3" /></span>
              </Link>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(experiments?.experiments ?? []).filter((e: any) => e.status === "active").slice(0, 3).map((exp: any) => (
                  <div key={exp.id} className="p-3 bg-purple-50 rounded-xl">
                    <p className="text-xs font-bold text-purple-800 mb-1">{exp.name}</p>
                    <div className="flex gap-3 text-[11px] text-purple-600">
                      <span>{exp.total_assigned ?? 0} assigned</span>
                      <span>{exp.total_converted ?? 0} converted</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
