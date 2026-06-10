import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import {
  Calculator, Activity, DollarSign, Shield, LifeBuoy, FileText,
  Settings, Users, Globe, ChevronRight, Bell, RefreshCw,
  BarChart3, Terminal, Wifi, CreditCard, Clock, Brain, ShieldCheck,
  LayoutDashboard, Bug, Flame,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const tok = () => localStorage.getItem("aperti_token") || "";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function ActivityHeatmap() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-activity-heatmap"],
    queryFn: async () => {
      const res = await fetch("/dashboard/admin/activity-heatmap?days=30", {
        headers: { Authorization: `Bearer ${tok()}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 5 * 60_000,
    retry: false,
  });

  const cells: { dow: number; hour: number; count: number }[] = data?.cells ?? [];

  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  let maxCount = 1;
  cells.forEach(({ dow, hour, count }) => {
    grid[dow][hour] = count;
    if (count > maxCount) maxCount = count;
  });

  const totalLogins = cells.reduce((s, c) => s + c.count, 0);
  const peakCell = cells.reduce((best, c) => (c.count > (best?.count ?? 0) ? c : best), cells[0]);
  const peakLabel = peakCell
    ? `${DAYS[peakCell.dow]} ${peakCell.hour}:00–${peakCell.hour + 1}:00`
    : null;

  function cellColor(count: number) {
    if (count === 0) return "bg-gray-100";
    const intensity = count / maxCount;
    if (intensity < 0.15) return "bg-teal-100";
    if (intensity < 0.30) return "bg-teal-200";
    if (intensity < 0.50) return "bg-teal-300";
    if (intensity < 0.70) return "bg-teal-400";
    if (intensity < 0.85) return "bg-teal-500";
    return "bg-teal-600";
  }

  return (
    <Card className="border-0 shadow-sm bg-white mb-8">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-teal-50 flex items-center justify-center">
              <Flame className="h-4 w-4 text-teal-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Activity Heatmap</h2>
              <p className="text-xs text-gray-400">Login activity by day &amp; hour · last 30 days</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {peakLabel && (
              <span className="hidden sm:flex items-center gap-1 bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                <Flame className="h-3 w-3" /> Peak: {peakLabel}
              </span>
            )}
            <span>{totalLogins.toLocaleString()} logins</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[560px]">
              {/* Hour labels */}
              <div className="flex mb-1 ml-9">
                {HOURS.map(h => (
                  <div key={h} className="flex-1 text-center">
                    {h % 3 === 0 && (
                      <span className="text-[9px] text-gray-400 font-medium">
                        {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {DAYS.map((day, dow) => (
                <div key={day} className="flex items-center gap-1 mb-1">
                  <span className="text-[10px] text-gray-400 font-medium w-8 text-right shrink-0">{day}</span>
                  <div className="flex flex-1 gap-0.5">
                    {HOURS.map(hour => {
                      const count = grid[dow][hour];
                      return (
                        <div
                          key={hour}
                          title={count > 0 ? `${day} ${hour}:00 — ${count} login${count !== 1 ? "s" : ""}` : undefined}
                          className={`flex-1 rounded-sm cursor-default transition-opacity hover:opacity-80 ${cellColor(count)}`}
                          style={{ height: 14 }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Legend */}
              <div className="flex items-center justify-end gap-1.5 mt-3">
                <span className="text-[10px] text-gray-400">Less</span>
                {["bg-gray-100", "bg-teal-100", "bg-teal-200", "bg-teal-300", "bg-teal-400", "bg-teal-500", "bg-teal-600"].map(c => (
                  <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
                ))}
                <span className="text-[10px] text-gray-400">More</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const modules = [
  { to: "/admin/os",                    label: "Admin OS ✦ New",        desc: "Full command center — users, payments, analytics, health",  icon: LayoutDashboard, highlight: true },
  { to: "/admin/world-pilot",           label: "WorldPilot",            desc: "Global platform management",          icon: Globe },
  { to: "/admin/shield-core",           label: "ShieldCore",             desc: "Security & exam integrity",           icon: Shield },
  { to: "/admin/budget-sense",          label: "BudgetSense",            desc: "Financial overview & billing",        icon: Calculator },
  { to: "/admin/auto-scale",            label: "AutoScale",              desc: "Capacity & performance",              icon: Activity },
  { to: "/admin/spend-wise",            label: "SpendWise",              desc: "Expenditure analytics",               icon: DollarSign },
  { to: "/admin/helpdesk",              label: "HelpDesk Admin",         desc: "Support ticket management",           icon: LifeBuoy },
  { to: "/admin/paper-vault",           label: "PaperVault Admin",       desc: "Upload & manage past papers",         icon: FileText },
  { to: "/admin/subpilot-settings",     label: "SubPilot Admin",         desc: "Subscriptions, plans & coupons",      icon: Settings },
  { to: "/admin/quick-switch",          label: "QuickSwitch",            desc: "Preview as any role",                 icon: RefreshCw },
  { to: "/admin/guardian-pulse",        label: "GuardianPulse",          desc: "Parent notification centre",          icon: Bell },
  { to: "/admin/landing-editor",        label: "Landing Editor",         desc: "Edit landing page content live",      icon: Globe },
  { to: "/admin/assistant-permissions", label: "Assistant Permissions",  desc: "Control assistant access levels",     icon: Shield },
  { to: "/admin/teacher-verification", label: "Teacher Verification",    desc: "Grant Verified badges to teachers",   icon: Shield },
  { to: "/admin/ai-analytics",         label: "AI Analytics",             desc: "Monitor AI usage, costs & impact",    icon: Brain },
  { to: "/admin/ai-safety",            label: "AI Safety",                desc: "Review AI outputs & misconceptions",  icon: ShieldCheck },
  { to: "/admin/os/qa/readiness",      label: "QualityOS ✦ New",          desc: "Bug tracker, test runs & launch readiness", icon: Bug, highlight2: true },
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
    { label: "Active Live Sessions", value: liveStats?.activeLiveSessions ?? "—", icon: Wifi, color: "#00796B", live: true },
    { label: "Today's Attendance", value: liveStats?.attendanceRate != null ? `${liveStats.attendanceRate}%` : "—", icon: BarChart3, color: "#00796B" },
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
            {liveStats.activeLiveSessions} active session{liveStats.activeLiveSessions !== 1 ? "s" : ""} in progress
          </p>
        </motion.div>
      )}

      {/* Activity heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <ActivityHeatmap />
      </motion.div>

      {/* Module grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((mod, i) => (
          <motion.div
            key={mod.to}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + i * 0.05 }}
          >
            <Link href={mod.to}>
              <Card className={`border-0 shadow-sm cursor-pointer group hover:shadow-md transition-shadow ${(mod as any).highlight ? "bg-gradient-to-r from-teal-600 to-emerald-600 text-white" : (mod as any).highlight2 ? "bg-gradient-to-r from-violet-600 to-purple-700 text-white" : "bg-white"}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                    style={{ background: (mod as any).highlight || (mod as any).highlight2 ? "rgba(255,255,255,0.2)" : "rgba(0,121,107,0.07)" }}>
                    <mod.icon className={`h-5 w-5 ${(mod as any).highlight || (mod as any).highlight2 ? "text-white" : "text-primary"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${(mod as any).highlight || (mod as any).highlight2 ? "text-white" : "text-gray-900"}`}>{mod.label}</p>
                    <p className={`text-xs truncate ${(mod as any).highlight || (mod as any).highlight2 ? "text-white/70" : "text-gray-400"}`}>{mod.desc}</p>
                  </div>
                  <ChevronRight className={`h-4 w-4 group-hover:translate-x-0.5 transition-all ${(mod as any).highlight || (mod as any).highlight2 ? "text-white/60 group-hover:text-white" : "text-gray-300 group-hover:text-primary"}`} />
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
