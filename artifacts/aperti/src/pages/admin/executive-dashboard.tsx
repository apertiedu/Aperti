import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  TrendingUp, Users, CreditCard, DollarSign, BarChart3,
  ArrowUpRight, Crown, Activity, Package, Clock
} from "lucide-react";

async function fetchJSON(url: string) {
  const r = await fetch(url, { credentials: "include" });
  return r.json();
}

function MetricCard({ label, value, sub, icon: Icon, color = "primary", delay = 0 }: {
  label: string; value: string | number; sub?: string;
  icon: React.ComponentType<any>; color?: string; delay?: number;
}) {
  const colors: Record<string, string> = {
    primary: "bg-primary/8 text-primary", green: "bg-green-50 text-green-600",
    blue: "bg-blue-50 text-blue-600", amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600", red: "bg-red-50 text-red-600",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-card rounded-2xl border border-border shadow-sm p-5"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      <p className="text-sm text-gray-500 mt-1 font-medium">{label}</p>
    </motion.div>
  );
}

export default function ExecutiveDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["executive-analytics"],
    queryFn: () => fetchJSON("/api/admin/commerce/analytics/executive"),
    refetchInterval: 60000,
  });

  const { data: subData } = useQuery({
    queryKey: ["sub-analytics"],
    queryFn: () => fetchJSON("/api/admin/commerce/analytics/subscriptions"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-primary/60 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const d = data ?? {};
  const planData = subData?.byPlan ?? [];

  const fmt = (n: number) => Number(n ?? 0).toLocaleString("en-EG");
  const fmtEgp = (n: number) => `${fmt(n)} EGP`;
  const churnColor = (d.churnRate ?? 0) > 5 ? "red" : "green";

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" /> Executive Dashboard
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Real-time business intelligence</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard label="MRR"                  value={fmtEgp(d.mrr)}               icon={DollarSign} color="primary"   delay={0.00} />
        <MetricCard label="ARR"                  value={fmtEgp(d.arr)}               icon={TrendingUp}  color="green"  delay={0.05} />
        <MetricCard label="Active Subscriptions" value={fmt(d.activeSubscriptions)}   icon={CreditCard}  color="blue"   delay={0.10} />
        <MetricCard label="Active Users"         value={fmt(d.activeUsers)}           icon={Users}       color="purple" delay={0.15} />
        <MetricCard label="New This Month"       value={fmt(d.newSubscriptionsThisMonth)} icon={ArrowUpRight} color="amber" delay={0.20} />
        <MetricCard label="Churn Rate"           value={`${d.churnRate ?? 0}%`}      icon={Activity}    color={churnColor} delay={0.25} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top plans */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-500" /> Top Plans by Subscribers
          </h3>
          {planData.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No subscription data yet</p>
          ) : (
            <div className="space-y-3">
              {planData.map((plan: any, i: number) => {
                const maxSubs = Math.max(...planData.map((p: any) => parseInt(p.subscribers ?? 0)), 1);
                const pct = Math.round((parseInt(plan.subscribers ?? 0) / maxSubs) * 100);
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{plan.name}</span>
                      <span className="text-gray-500">{plan.subscribers} subscribers · {Number(plan.price_egp).toLocaleString()} EGP/mo</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary/70 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Recent subscriptions */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" /> Recent Subscriptions
          </h3>
          {(d.recentSubscriptions ?? []).length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No recent subscriptions</p>
          ) : (
            <div className="space-y-3">
              {(d.recentSubscriptions ?? []).map((s: any) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{s.display_name || s.username}</p>
                    <p className="text-xs text-gray-400">{s.plan_name}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.status === "active" ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"}`}>
                      {s.status.toUpperCase()}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">{s.created_at ? new Date(s.created_at).toLocaleDateString("en-GB") : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Platform Usage */}
      {(d.platformUsage ?? []).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-500" /> Platform Usage by Resource
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {d.platformUsage.map((u: any) => (
              <div key={u.resource} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-gray-800">{Number(u.total).toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1 capitalize">{u.resource.replace(/_/g, " ")}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
