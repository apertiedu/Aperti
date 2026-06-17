import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, BarChart2, RefreshCw, Activity, DollarSign, Percent, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const fade = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

function Stat({ label, value, sub, icon: Icon, accent = "teal" }: { label: string; value: string; sub?: string; icon: any; accent?: string }) {
  const colors: Record<string, string> = {
    teal: "bg-teal-50 text-teal-600",
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${colors[accent]}`}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        </div>
        <p className="text-2xl font-black text-gray-900">{value}</p>
        <p className="text-xs font-semibold text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function MiniBar({ label, pct, count, color = "bg-teal-500" }: { label: string; pct: number; count: number; color?: string }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="text-gray-400">{count.toLocaleString()} ({pct}%)</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

export default function SubscriptionAnalytics() {
  const { toast } = useToast();

  const { data: overview, isLoading, refetch } = useQuery<any>({
    queryKey: ["sub-analytics-overview"],
    queryFn: async () => {
      const r = await fetch("/api/sub-analytics/overview", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const { data: trend } = useQuery<any>({
    queryKey: ["sub-analytics-trend"],
    queryFn: async () => {
      const r = await fetch("/api/sub-analytics/revenue-trend", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const { data: funnel } = useQuery<any>({
    queryKey: ["sub-analytics-funnel"],
    queryFn: async () => {
      const r = await fetch("/api/sub-analytics/funnel", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const { data: split } = useQuery<any>({
    queryKey: ["sub-analytics-split"],
    queryFn: async () => {
      const r = await fetch("/api/sub-analytics/teacher-split", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const { data: churn } = useQuery<any>({
    queryKey: ["sub-analytics-churn"],
    queryFn: async () => {
      const r = await fetch("/api/sub-analytics/churn", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const snapshotMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/sub-analytics/snapshot", { method: "POST", credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
    onSuccess: (data) => {
      toast({ title: `Snapshot saved — MRR: EGP ${data.snapshot?.mrr?.toLocaleString() ?? 0}` });
      refetch();
    },
    onError: (e) => toast({ title: (e as Error).message, variant: "destructive" }),
  });

  const ov = overview ?? {};
  const trendData: any[] = trend?.trend ?? [];
  const funnelData: any[] = funnel?.funnel ?? [];
  const splitData: any[] = split?.split ?? [];
  const churnData: any[] = churn?.churn_by_month ?? [];

  const maxRevenue = Math.max(...trendData.map((t) => parseFloat(t.revenue ?? "0")), 1);

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div {...fade} className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-teal-100 flex items-center justify-center">
            <BarChart2 className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subscription Analytics</h1>
            <p className="text-sm text-gray-400">Ledger-confirmed data only — no pending payments</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />Refresh
          </Button>
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
            disabled={snapshotMutation.isPending}
            onClick={() => snapshotMutation.mutate()}>
            <Activity className="h-3.5 w-3.5" />Save Snapshot
          </Button>
        </div>
      </motion.div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="MRR (Ledger)" value={`EGP ${(ov.mrr ?? 0).toLocaleString()}`} sub="Confirmed payments only" icon={DollarSign} accent="teal" />
        <Stat label="ARR" value={`EGP ${(ov.arr ?? 0).toLocaleString()}`} sub="Annualized MRR" icon={TrendingUp} accent="emerald" />
        <Stat label="Active Subscriptions" value={(ov.active_subscriptions ?? 0).toLocaleString()} sub={`${ov.auto_renew_enabled ?? 0} auto-renew`} icon={Users} accent="blue" />
        <Stat label="Churn Rate" value={`${ov.churn_rate ?? 0}%`} sub={`Retention: ${ov.retention_rate ?? 0}%`} icon={Percent} accent="amber" />
        <Stat label="New This Month" value={(ov.new_this_month ?? 0).toLocaleString()} icon={ArrowUpRight} accent="purple" />
        <Stat label="Churned This Month" value={(ov.churned_this_month ?? 0).toLocaleString()} icon={Activity} accent="rose" />
        <Stat label="Trial Conversion" value={`${ov.conversion_rate ?? 0}%`} sub="Trial → Paid" icon={Percent} accent="teal" />
        <Stat label="Total Revenue" value={`EGP ${(ov.total_confirmed_revenue ?? 0).toLocaleString()}`} sub="All-time ledger" icon={DollarSign} accent="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Revenue Trend */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">12-Month Revenue Trend (Ledger Confirmed)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {trendData.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-xs text-gray-400">No revenue data yet</div>
            ) : (
              <div className="flex items-end gap-1 h-32">
                {trendData.map((t, i) => {
                  const h = Math.max(4, Math.round((parseFloat(t.revenue ?? "0") / maxRevenue) * 100));
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full relative group">
                        <motion.div
                          className="w-full bg-teal-500 rounded-t-sm"
                          style={{ height: `${h}%`, minHeight: 4, maxHeight: 128 }}
                          initial={{ scaleY: 0, originY: 1 }}
                          animate={{ scaleY: 1 }}
                          transition={{ delay: i * 0.05 }}
                        />
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity pointer-events-none">
                          EGP {parseFloat(t.revenue).toLocaleString()}
                        </div>
                      </div>
                      <p className="text-[8px] text-gray-400 rotate-45 origin-left">{t.month?.slice(5)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscription Funnel */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Subscription Funnel</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {funnelData.map((stage, i) => (
              <MiniBar
                key={i}
                label={stage.stage}
                pct={stage.pct}
                count={stage.count}
                color={["bg-blue-400", "bg-teal-500", "bg-emerald-500", "bg-emerald-700"][i] ?? "bg-gray-400"}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Revenue Split */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue by Plan</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {splitData.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-6">No active subscribers yet</div>
            ) : (
              <div className="space-y-3">
                {splitData.map((row: any, i: number) => {
                  const maxRev = Math.max(...splitData.map((r: any) => parseFloat(r.total_revenue ?? "0")), 1);
                  const pct = Math.round(parseFloat(row.total_revenue ?? "0") / maxRev * 100);
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-gray-700">{row.plan_name}</span>
                        <span className="text-gray-400">EGP {parseFloat(row.total_revenue ?? "0").toLocaleString()} · {row.subscriber_count} subs</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full">
                        <motion.div
                          className="h-full bg-teal-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, delay: i * 0.05 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Churn Trend */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Churn by Month</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {churnData.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-6">No churn data yet</div>
            ) : (
              <div className="divide-y">
                {churnData.slice(-6).map((row: any, i: number) => (
                  <div key={i} className="py-2 flex items-center justify-between text-xs">
                    <span className="text-gray-600 font-medium">{row.month}</span>
                    <div className="flex gap-4">
                      <span className="text-rose-600 font-semibold">{row.churned} churned</span>
                      <span className="text-emerald-600 font-semibold">{row.retained_active} retained</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
