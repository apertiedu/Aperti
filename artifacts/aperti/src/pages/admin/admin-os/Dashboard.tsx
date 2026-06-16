import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Users, CreditCard, Activity, TicketCheck, TrendingUp,
  AlertTriangle, CheckCircle2, Clock, ArrowUpRight, Shield,
  BarChart3, Flag, Zap,
} from "lucide-react";
import { fetchJSON } from "@/lib/api";
import { Link } from "wouter";
import SystemHealthWidget from "@/components/system-health-widget";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({ title, value, subtitle, icon: Icon, color, href }: any) {
  const card = (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer group"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value ?? "—"}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      {href && (
        <div className="flex items-center gap-1 mt-3 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          View details <ArrowUpRight className="w-3 h-3" />
        </div>
      )}
    </motion.div>
  );
  return href ? <Link href={href}><a>{card}</a></Link> : card;
}

function HealthBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    healthy: "bg-green-100 text-green-700",
    degraded: "bg-yellow-100 text-yellow-700",
    critical: "bg-red-100 text-red-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

export default function AdminDashboard() {
  const { data: dash } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => fetchJSON("/api/admin/analytics/dashboard"),
    refetchInterval: 30000,
  });
  const { data: health } = useQuery({
    queryKey: ["admin-health"],
    queryFn: () => fetchJSON("/api/admin/health"),
    refetchInterval: 60000,
  });
  const { data: userStats } = useQuery({
    queryKey: ["admin-user-stats"],
    queryFn: () => fetchJSON("/api/admin/users/stats/overview"),
  });
  const { data: subStats } = useQuery({
    queryKey: ["admin-sub-stats"],
    queryFn: () => fetchJSON("/api/admin/subscriptions/stats/overview"),
  });
  const { data: revenue } = useQuery({
    queryKey: ["admin-revenue"],
    queryFn: () => fetchJSON("/api/admin/payments/revenue/overview"),
  });
  const { data: flags } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: () => fetchJSON("/api/admin/feature-flags"),
  });

  const activeFlags = (flags as any[])?.filter((f: any) => f.enabled).length ?? 0;
  const isLoading = !dash && !health && !userStats && !subStats && !revenue;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Command Center</h1>
        <p className="text-sm text-gray-500 mt-0.5">Real-time overview of Aperti platform health and metrics</p>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-14 rounded-xl w-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl md:col-span-2" />
          </div>
        </div>
      )}

      {/* Health banner */}
      {health && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl p-4 flex items-center gap-3 ${health.status === "healthy" ? "bg-green-50 border border-green-200" : "bg-yellow-50 border border-yellow-200"}`}
        >
          {health.status === "healthy"
            ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            : <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />}
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              System Status: <HealthBadge status={health.status} />
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              API: {health.apiLatency}ms · DB: {health.dbLatency}ms · Memory: {health.memory?.percent}% · Uptime: {Math.floor((health.uptime || 0) / 3600)}h
            </p>
          </div>
          <Link href="/admin/os/health">
            <a className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
              Details <ArrowUpRight className="w-3 h-3" />
            </a>
          </Link>
        </motion.div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Active Users" value={userStats?.active?.toLocaleString()} subtitle={`${userStats?.teachers} teachers · ${userStats?.students} students`} icon={Users} color="bg-primary" href="/admin/os/users" />
        <StatCard title="Active Subscriptions" value={subStats?.active?.toLocaleString()} subtitle={`${subStats?.trial} on trial`} icon={CreditCard} color="bg-blue-500" href="/admin/os/subscriptions" />
        <StatCard title="Monthly Revenue" value={`EGP ${((revenue?.mrr || 0)).toLocaleString()}`} subtitle="This month" icon={TrendingUp} color="bg-emerald-500" href="/admin/os/payments" />
        <StatCard title="Open Tickets" value={dash?.openTickets ?? "—"} subtitle="Pending support" icon={TicketCheck} color="bg-orange-500" href="/admin/os/tickets" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={userStats?.total?.toLocaleString()} subtitle={`${userStats?.suspended} suspended`} icon={Users} color="bg-purple-500" href="/admin/os/users" />
        <StatCard title="Total Subscriptions" value={subStats?.total?.toLocaleString()} subtitle={`${subStats?.expired} expired`} icon={Shield} color="bg-indigo-500" href="/admin/os/subscriptions" />
        <StatCard title="Active Feature Flags" value={activeFlags} subtitle="Features enabled" icon={Flag} color="bg-pink-500" href="/admin/os/features" />
        <StatCard title="Total Revenue" value={`EGP ${((revenue?.totalRevenue || 0)).toLocaleString()}`} subtitle="All time" icon={BarChart3} color="bg-amber-500" href="/admin/os/payments" />
      </div>

      {/* System Health Widget */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <SystemHealthWidget />
        </div>
        <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-bold text-gray-900 mb-3">Operational Intelligence</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: "Active Sessions", value: dash?.activeSessions ?? "—", color: "text-primary" },
              { label: "Avg Response", value: health ? `${health.apiLatency}ms` : "—", color: "text-blue-600" },
              { label: "DB Latency", value: health ? `${health.dbLatency}ms` : "—", color: "text-indigo-600" },
              { label: "Memory", value: health ? `${health.memory?.percent}%` : "—", color: "text-purple-600" },
              { label: "Uptime", value: health ? `${Math.floor((health.uptime || 0) / 3600)}h` : "—", color: "text-emerald-600" },
              { label: "Error Rate", value: dash?.errorRate ?? "0%", color: "text-amber-600" },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 rounded-lg px-3 py-2">
                <p className={`text-sm font-black ${item.color}`}>{item.value}</p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Verify Payments", href: "/admin/os/payments", icon: CreditCard, desc: "Review pending transactions" },
          { label: "User Management", href: "/admin/os/users", icon: Users, desc: "Manage platform users" },
          { label: "Audit Logs", href: "/admin/os/audit", icon: Activity, desc: "Track all actions" },
          { label: "Feature Flags", href: "/admin/os/features", icon: Zap, desc: "Toggle platform features" },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <a className="bg-white rounded-xl border border-gray-100 p-4 hover:border-primary/30 hover:shadow-sm transition-all group">
              <item.icon className="w-6 h-6 text-primary mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-sm font-semibold text-gray-900">{item.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
            </a>
          </Link>
        ))}
      </div>
    </div>
  );
}
