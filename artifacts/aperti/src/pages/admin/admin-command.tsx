import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import {
  Calculator, Activity, DollarSign, Shield, LifeBuoy, FileText,
  Settings, Users, Globe, ChevronRight, Bell, RefreshCw,
  BarChart3, Terminal,
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

  const highlights = [
    { label: "Total Students", value: stats?.totalStudents ?? "—", icon: Users, color: "#00796B" },
    { label: "Active Sessions", value: stats?.totalSessions ?? "—", icon: Activity, color: "#1976D2" },
    { label: "Avg Attendance", value: stats?.avgAttendanceRate != null ? `${Math.round(stats.avgAttendanceRate)}%` : "—", icon: BarChart3, color: "#388E3C" },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Terminal className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Command Centre</h1>
            <p className="text-sm text-gray-500">Full platform control at your fingertips</p>
          </div>
        </div>
      </motion.div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {highlights.map((h, i) => (
          <motion.div
            key={h.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
          >
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="p-5 flex items-center gap-4">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${h.color}15` }}
                >
                  <h.icon className="h-5 w-5" style={{ color: h.color }} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{h.value}</p>
                  <p className="text-xs text-gray-400">{h.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

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
                  <div className="h-10 w-10 rounded-xl bg-primary/8 group-hover:bg-primary/15 flex items-center justify-center shrink-0 transition-colors"
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
