import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import {
  Calculator, Activity, DollarSign, Shield, LifeBuoy, FileText,
  Settings, Users, Globe, ChevronRight, Bell, RefreshCw,
  BarChart3, Terminal, Wifi, CreditCard, Clock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const tok = () => localStorage.getItem("aperti_token") || "";

const modules = [
  { to: "/admin/world-pilot", label: "WorldPilot", desc: "Global platform management", icon: Globe },
  { to: "/admin/shield-core", label: "ShieldCore", desc: "Security & exam integrity", icon: Shield },
  { to: "/admin/budget-sense", label: "BudgetSense", desc: "Financial overview & billing", icon: Calculator },
  { to: "/admin/auto-scale", label: "AutoScale", desc: "Capacity & performance", icon: Activity },
  { to: "/admin/spend-wise", label: "SpendWise", desc: "Expenditure analytics", icon: DollarSign },
  { to: "/admin/helpdesk", label: "HelpDesk Admin", desc: "Support ticket management", icon: LifeBuoy },
  { to: "/admin/paper-vault", label: "PaperVault Admin", desc: "Upload & manage past papers", icon: FileText },
  { to: "/admin/subpilot-settings", label: "SubPilot Admin", desc: "Subscription approvals", icon: Settings },
  { to: "/admin/quick-switch", label: "QuickSwitch", desc: "Preview as any role", icon: RefreshCw },
  { to: "/admin/guardian-pulse", label: "GuardianPulse", desc: "Parent notification centre", icon: Bell },
];

function LiveStatsBadge({ count, label }: { count: number | string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      {count} {label}
    </span>
  );
}

export default function AdminCommand() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard", { headers: { Authorization: `Bearer ${tok()}` } });
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  const { data: liveStats, dataUpdatedAt } = useQuery({
    queryKey: ["admin-live-stats"],
    queryFn: async () => {
      const res = await fetch("/dashboard/admin/live-stats", {
        headers: { Authorization: `Bearer ${tok()}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
    refetchInterval: 30_000,
  });

  const lastUpdated = liveStats?.lastUpdated
    ? new Date(liveStats.lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  const highlights = [
    { label: "Total Students", value: liveStats?.totalStudents ?? stats?.totalStudents ?? "—", icon: Users, color: "#00796B" },
    { label: "Active Live Sessions", value: liveStats?.activeLiveSessions ?? "—", icon: Wifi, color: "#1976D2", live: true },
    { label: "Today's Attendance", value: liveStats?.attendanceRate != null ? `${liveStats.attendanceRate}%` : "—", icon: BarChart3, color: "#388E3C" },
    { label: "Pending InstaPay", value: liveStats?.pendingInstapay ?? "—", icon: CreditCard, color: liveStats?.pendingInstapay > 0 ? "#D32F2F" : "#757575" },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Terminal className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Command Centre</h1>
              <p className="text-sm text-gray-500">Full platform control at your fingertips</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <Clock className="h-3 w-3" />
                Updated {lastUpdated}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live · 30s refresh
            </span>
          </div>
        </div>
      </motion.div>

      {/* Live stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {highlights.map((h, i) => (
          <motion.div
            key={h.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
          >
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="p-5 flex items-center gap-3">
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${h.color}18` }}
                >
                  <h.icon className="h-4 w-4" style={{ color: h.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-gray-900 leading-none">{h.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-tight">{h.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Live alerts row */}
      {liveStats?.pendingInstapay > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2"
        >
          <CreditCard className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            {liveStats.pendingInstapay} InstaPay submission{liveStats.pendingInstapay !== 1 ? "s" : ""} waiting for approval
          </p>
          <Link href="/admin/subpilot-settings" className="ml-auto text-xs text-amber-700 underline hover:text-amber-900">
            Review
          </Link>
        </motion.div>
      )}

      {liveStats?.activeLiveSessions > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2"
        >
          <Wifi className="h-4 w-4 text-blue-600 shrink-0" />
          <p className="text-sm text-blue-800 font-medium">
            {liveStats.activeLiveSessions} live class session{liveStats.activeLiveSessions !== 1 ? "s" : ""} in progress
          </p>
        </motion.div>
      )}

      {/* Module grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((mod, i) => (
          <motion.div
            key={mod.to}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05 }}
          >
            <Link href={mod.to}>
              <Card className="border-0 shadow-sm bg-white cursor-pointer group hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                    style={{ background: "rgba(0,121,107,0.07)" }}>
                    <mod.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900">{mod.label}</p>
                    <p className="text-xs text-gray-400 truncate">{mod.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
