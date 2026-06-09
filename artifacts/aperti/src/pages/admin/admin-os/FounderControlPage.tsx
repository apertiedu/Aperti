import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON } from "@/lib/api";
import { useLocation } from "wouter";
import {
  Users, TrendingUp, BookOpen, DollarSign, AlertCircle,
  Layers, Activity, Zap, ArrowUpRight, ArrowDownRight,
  BarChart3, ShieldCheck,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

function StatCard({
  label, value, sub, icon: Icon, color = "teal", trend, onClick,
}: {
  label: string; value: string | number; sub?: string;
  icon: any; color?: string; trend?: number; onClick?: () => void;
}) {
  const colors: Record<string, string> = {
    teal: "bg-teal-50 text-teal-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    green: "bg-green-50 text-green-600",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm p-5 border border-gray-100 ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${trend >= 0 ? "text-green-600" : "text-rose-500"}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm font-medium text-gray-700 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </motion.div>
  );
}

export default function FounderControlPage() {
  const [, nav] = useLocation();
  const { data: ov, isLoading } = useQuery({
    queryKey: ["founder-overview"],
    queryFn: () => fetchJSON("/api/founder/overview"),
  });
  const { data: rev } = useQuery({
    queryKey: ["founder-revenue"],
    queryFn: () => fetchJSON("/api/founder/revenue"),
  });
  const { data: alerts } = useQuery({
    queryKey: ["founder-alerts"],
    queryFn: () => fetchJSON("/api/founder/alerts"),
    refetchInterval: 30000,
  });

  const unread = (alerts?.alerts ?? []).filter((a: any) => !a.is_read).length;
  const monthly = (rev?.monthly ?? []).slice(-6);
  const users = ov?.users ?? {};
  const content = ov?.content ?? {};
  const revenue = ov?.revenue ?? {};
  const readiness = ov?.readiness;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Founder Control Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">Full platform overview — real-time operational data</p>
        </div>
        {unread > 0 && (
          <button
            onClick={() => nav("/admin/os/founder-alerts")}
            className="flex items-center gap-2 bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg text-sm font-medium border border-rose-100 hover:bg-rose-100 transition-colors"
          >
            <AlertCircle className="w-4 h-4" />
            {unread} unread alert{unread !== 1 ? "s" : ""}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <>
          {/* Users */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Users</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Active Students" value={users.students ?? 0} icon={Users} color="teal" sub={`+${users.new7d ?? 0} this week`} />
              <StatCard label="Active Teachers" value={users.teachers ?? 0} icon={Users} color="blue" />
              <StatCard label="Active Parents" value={users.parents ?? 0} icon={Users} color="purple" />
              <StatCard label="New (30d)" value={users.new30d ?? 0} icon={TrendingUp} color="green" />
            </div>
          </div>

          {/* Revenue */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Revenue</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="MTD Revenue" value={`EGP ${parseFloat(revenue.mtd ?? 0).toLocaleString()}`} icon={DollarSign} color="green"
                onClick={() => nav("/admin/os/founder-revenue")} />
              <StatCard label="YTD Revenue" value={`EGP ${parseFloat(revenue.ytd ?? 0).toLocaleString()}`} icon={DollarSign} color="amber"
                onClick={() => nav("/admin/os/founder-revenue")} />
              <StatCard label="Active Subs" value={content.activeSubs ?? 0} icon={Layers} color="blue"
                onClick={() => nav("/admin/os/founder-growth")} />
              <StatCard label="Open Tickets" value={ov?.support?.openTickets ?? 0} icon={AlertCircle} color="rose" />
            </div>
          </div>

          {/* Content */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Content & Platform</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Courses" value={content.courses ?? 0} icon={BookOpen} color="teal" />
              <StatCard label="Questions" value={(content.questions ?? 0).toLocaleString()} icon={BarChart3} color="purple" />
              <StatCard label="Assessments" value={content.assessments ?? 0} icon={Activity} color="blue" />
              <StatCard label="Readiness" value={`${readiness ?? "—"}%`} icon={ShieldCheck} color="green" />
            </div>
          </div>
        </>
      )}

      {/* Revenue trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Revenue Trend (6mo)</h3>
            <button onClick={() => nav("/admin/os/founder-revenue")}
              className="text-xs text-teal-600 hover:underline flex items-center gap-1">
              Full report <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          {monthly.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No revenue data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthly} barSize={20}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => [`EGP ${parseFloat(v).toLocaleString()}`, "Revenue"]} />
                <Bar dataKey="revenue" fill="#0D9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Quick Links</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Revenue Deep Dive", href: "/admin/os/founder-revenue", icon: DollarSign, color: "text-green-600 bg-green-50" },
              { label: "Growth Analytics", href: "/admin/os/founder-growth", icon: TrendingUp, color: "text-blue-600 bg-blue-50" },
              { label: "Content Quality", href: "/admin/os/content-quality", icon: BookOpen, color: "text-purple-600 bg-purple-50" },
              { label: "AI Costs", href: "/admin/os/ai-costs", icon: Zap, color: "text-amber-600 bg-amber-50" },
              { label: "Founder Alerts", href: "/admin/os/founder-alerts", icon: AlertCircle, color: "text-rose-600 bg-rose-50" },
              { label: "Launch Command", href: "/admin/os/launch-command", icon: ShieldCheck, color: "text-teal-600 bg-teal-50" },
            ].map((link) => (
              <button key={link.href} onClick={() => nav(link.href)}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-teal-200 hover:bg-teal-50/30 transition-all text-left group">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${link.color}`}>
                  <link.icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-teal-700">{link.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
