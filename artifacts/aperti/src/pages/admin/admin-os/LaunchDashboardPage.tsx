import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/auth";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Users, DollarSign, AlertTriangle, Activity, Clock, Shield,
  RefreshCw, CheckCircle2, XCircle, CreditCard, UserCheck,
  TrendingUp, Database, Server, Zap, ArrowRight, Bell,
} from "lucide-react";

interface DashData {
  users: { activeToday: number; totalActive: number; newToday: number };
  students: { total: number; newToday: number };
  revenue: { today: number; thisMonth: number };
  subscriptions: { active: number };
  pendingApprovals: { payments: number; enrollments: number; total: number };
  errors: { failedLoginsLast24h: number; problemReportsLast24h: number };
  system: { status: string; dbLatencyMs: number; memoryUsedPct: number; uptimeSeconds: number };
  generatedAt: string;
}

interface DbIntegrityResult {
  healthy: boolean;
  issues: { severity: string; table: string; count: number; description: string }[];
  checkedAt: string;
}

function StatCard({ icon, label, value, sub, color = "primary", href }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string; href?: string;
}) {
  const colors: Record<string, string> = {
    primary: "bg-primary/8 text-primary",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    green: "bg-emerald-50 text-emerald-600",
    purple: "bg-purple-50 text-purple-600",
  };
  const inner = (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow h-full">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${colors[color] || colors.primary}`}>
        {icon}
      </div>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      <p className="text-xs text-gray-500 font-medium mt-1.5">{label}</p>
    </div>
  );
  return href ? <Link href={href}><a>{inner}</a></Link> : inner;
}

function SystemStatus({ status, latencyMs, memPct, uptime }: { status: string; latencyMs: number; memPct: number; uptime: number }) {
  const isHealthy = status === "healthy";
  const isDegraded = status === "degraded";
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900">System Health</h3>
        <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
          isHealthy ? "bg-emerald-50 text-emerald-700" : isDegraded ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isHealthy ? "bg-emerald-500" : isDegraded ? "bg-amber-500" : "bg-red-500"} animate-pulse`} />
          {isHealthy ? "All Systems Operational" : isDegraded ? "Degraded Performance" : "Critical Issue"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-400 mb-1">DB Latency</p>
          <p className={`text-lg font-bold ${latencyMs < 100 ? "text-emerald-600" : latencyMs < 500 ? "text-amber-600" : "text-red-600"}`}>
            {latencyMs}ms
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Memory</p>
          <p className={`text-lg font-bold ${memPct < 70 ? "text-emerald-600" : memPct < 85 ? "text-amber-600" : "text-red-600"}`}>
            {memPct}%
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Uptime</p>
          <p className="text-lg font-bold text-gray-700">{days > 0 ? `${days}d ${hours}h` : `${hours}h`}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { label: "API", ok: latencyMs < 500 },
          { label: "Database", ok: latencyMs < 500 },
          { label: "Storage", ok: true },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg ${s.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {s.ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function PendingApprovals({ payments, enrollments }: { payments: number; enrollments: number }) {
  const total = payments + enrollments;
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">Pending Approvals</h3>
        {total > 0 && (
          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{total} pending</span>
        )}
      </div>
      <div className="space-y-2">
        <Link href="/admin/os/payments">
          <a className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors group">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              <span className="text-sm text-gray-700">Payment Approvals</span>
            </div>
            <div className="flex items-center gap-2">
              {payments > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">{payments}</span>}
              <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-primary transition-colors" />
            </div>
          </a>
        </Link>
        <Link href="/admin/os/enrollments">
          <a className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors group">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-gray-700">Enrollment Requests</span>
            </div>
            <div className="flex items-center gap-2">
              {enrollments > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{enrollments}</span>}
              <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 transition-colors" />
            </div>
          </a>
        </Link>
      </div>
      {total === 0 && <p className="text-xs text-gray-400 text-center mt-2">All caught up — no pending items</p>}
    </div>
  );
}

function DbIntegrityWidget({ token }: { token: string | null }) {
  const [result, setResult] = useState<DbIntegrityResult | null>(null);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/launch-dashboard/db-integrity", { credentials: "include" });
      if (res.ok) setResult(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { check(); }, []);

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">Database Integrity</h3>
        <button onClick={check} disabled={loading} className="text-xs text-primary hover:text-primary flex items-center gap-1">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
      {result ? (
        result.healthy ? (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-sm text-emerald-700 font-medium">No integrity issues found</span>
          </div>
        ) : (
          <div className="space-y-2">
            {result.issues.map((issue, i) => (
              <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${
                issue.severity === "high" ? "bg-red-50 text-red-700" :
                issue.severity === "medium" ? "bg-amber-50 text-amber-700" :
                "bg-gray-50 text-gray-600"
              }`}>
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold">{issue.count}x</span> {issue.description}
                  <span className="text-xs opacity-70 ml-1">({issue.table})</span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="flex items-center justify-center h-16">
          <RefreshCw className="w-4 h-4 text-gray-300 animate-spin" />
        </div>
      )}
    </div>
  );
}

export default function LaunchDashboardPage() {
  const { token } = useAuth();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/launch-dashboard", { credentials: "include" });
      if (res.ok) {
        setData(await res.json());
        setLastRefresh(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, [load]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Founder Launch Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">The one screen you check daily — everything at a glance</p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && <p className="text-xs text-gray-400">Updated {lastRefresh.toLocaleTimeString()}</p>}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-primary border border-primary/25 rounded-lg hover:bg-primary/8 disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {data ? (
        <>
          {/* KPI Row */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<Users className="w-4 h-4" />} label="Active Users (24h)" value={data.users.activeToday} sub={`${data.users.newToday} new today`} color="primary" />
            <StatCard icon={<DollarSign className="w-4 h-4" />} label="Revenue This Month" value={`EGP ${data.revenue.thisMonth.toLocaleString()}`} sub={`EGP ${data.revenue.today} today`} color="green" href="/admin/os/founder-revenue" />
            <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Active Subscriptions" value={data.subscriptions.active} sub={`${data.students.total} total students`} color="blue" href="/admin/os/subscriptions" />
            <StatCard icon={<Bell className="w-4 h-4" />} label="Pending Approvals" value={data.pendingApprovals.total} sub="payments + enrollments" color={data.pendingApprovals.total > 0 ? "amber" : "green"} />
          </motion.div>

          {/* Error & Security Row */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<Shield className="w-4 h-4" />} label="Failed Logins (24h)" value={data.errors.failedLoginsLast24h} color={data.errors.failedLoginsLast24h > 20 ? "red" : "teal"} href="/admin/os/security" />
            <StatCard icon={<AlertTriangle className="w-4 h-4" />} label="Problem Reports (24h)" value={data.errors.problemReportsLast24h} color={data.errors.problemReportsLast24h > 5 ? "red" : "teal"} href="/admin/os/problem-reports" />
            <StatCard icon={<Database className="w-4 h-4" />} label="DB Latency" value={`${data.system.dbLatencyMs}ms`} color={data.system.dbLatencyMs < 100 ? "green" : data.system.dbLatencyMs < 500 ? "amber" : "red"} />
            <StatCard icon={<Server className="w-4 h-4" />} label="Memory Usage" value={`${data.system.memoryUsedPct}%`} color={data.system.memoryUsedPct < 70 ? "green" : data.system.memoryUsedPct < 85 ? "amber" : "red"} />
          </motion.div>

          {/* Detail Cards Row */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SystemStatus
              status={data.system.status}
              latencyMs={data.system.dbLatencyMs}
              memPct={data.system.memoryUsedPct}
              uptime={data.system.uptimeSeconds}
            />
            <PendingApprovals payments={data.pendingApprovals.payments} enrollments={data.pendingApprovals.enrollments} />
            <DbIntegrityWidget token={token} />
          </motion.div>

          {/* Quick Nav */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { label: "Approve Payments", href: "/admin/os/payments", icon: CreditCard, color: "text-primary" },
                { label: "User Management", href: "/admin/os/users", icon: Users, color: "text-blue-600" },
                { label: "Route Health", href: "/admin/os/route-health", icon: Activity, color: "text-emerald-600" },
                { label: "Security Audit", href: "/admin/os/security", icon: Shield, color: "text-purple-600" },
                { label: "Launch Certification", href: "/admin/os/launch-certification", icon: CheckCircle2, color: "text-amber-600" },
                { label: "Error Intelligence", href: "/admin/os/error-intelligence", icon: AlertTriangle, color: "text-red-600" },
                { label: "Performance", href: "/admin/os/performance", icon: Zap, color: "text-orange-500" },
                { label: "Founder Analytics", href: "/admin/os/founder-revenue", icon: TrendingUp, color: "text-primary" },
              ].map(item => (
                <Link key={item.href} href={item.href}>
                  <a className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors group">
                    <item.icon className={`w-4 h-4 ${item.color}`} />
                    <span className="text-xs text-gray-600 group-hover:text-gray-900 font-medium">{item.label}</span>
                  </a>
                </Link>
              ))}
            </div>
          </motion.div>
        </>
      ) : (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Activity className="w-8 h-8 text-gray-200 mx-auto mb-2 animate-pulse" />
            <p className="text-sm text-gray-400">Loading dashboard data…</p>
          </div>
        </div>
      )}
    </div>
  );
}
