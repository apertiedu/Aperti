import { useQuery } from "@tanstack/react-query";
import { fetchJSON } from "@/lib/api";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Users, DollarSign, AlertCircle, Activity,
  TrendingUp, Shield, Settings, ChevronRight,
} from "lucide-react";

function MetricCard({ label, value, icon: Icon, color, href }: {
  label: string; value: string | number; icon: any; color: string; href?: string;
}) {
  const content = (
    <motion.div
      whileTap={{ scale: 0.97 }}
      className={`${color} rounded-2xl p-4 flex items-center gap-3 min-h-[72px]`}
    >
      <Icon className="w-6 h-6 shrink-0" />
      <div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
      {href && <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />}
    </motion.div>
  );
  return href ? <Link href={href}>{content}</Link> : <div>{content}</div>;
}

export default function AdminMobileHome() {
  const { data, isLoading } = useQuery({
    queryKey: ["mobile-admin-home"],
    queryFn: () => fetchJSON("/mobile/admin-home"),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalUsers = data?.totalUsers ?? 0;
  const mrr = data?.mrr ?? 0;
  const pendingPayments = data?.pendingPayments ?? 0;
  const status = data?.status ?? "healthy";

  const formatCurrency = (n: number) =>
    n >= 1000 ? `EGP ${(n / 1000).toFixed(1)}k` : `EGP ${n.toFixed(0)}`;

  return (
    <div className="min-h-screen bg-background pb-20 px-4 pt-4 space-y-5">
      <div>
        <p className="text-xs text-muted-foreground font-medium">Platform Overview</p>
        <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
      </div>

      {/* Status Badge */}
      <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold ${
        status === "healthy"
          ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
          : "bg-red-50 dark:bg-red-950/30 text-red-700"
      }`}>
        <Activity className="w-4 h-4" />
        System {status === "healthy" ? "Healthy" : "Alert"}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Total Users"
          value={totalUsers.toLocaleString()}
          icon={Users}
          color="bg-primary/10"
          href="/admin/os"
        />
        <MetricCard
          label="MRR (this month)"
          value={formatCurrency(mrr)}
          icon={DollarSign}
          color="bg-green-50 dark:bg-green-950/30"
          href="/admin/executive"
        />
        <MetricCard
          label="Pending Payments"
          value={pendingPayments}
          icon={AlertCircle}
          color={pendingPayments > 0 ? "bg-orange-50 dark:bg-orange-950/30" : "bg-muted/40"}
          href="/admin/commerce"
        />
        <MetricCard
          label="ARR Estimate"
          value={formatCurrency(mrr * 12)}
          icon={TrendingUp}
          color="bg-blue-50 dark:bg-blue-950/30"
        />
      </div>

      {/* Quick Admin Actions */}
      <div className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40">
          <h2 className="font-semibold text-sm text-foreground">Quick Actions</h2>
        </div>
        {[
          { href: "/admin/commerce", label: "Review Payments", sub: "Verify pending InstaPay submissions", icon: DollarSign },
          { href: "/admin/teacher-verification", label: "Verify Teachers", sub: "Review pending teacher applications", icon: Shield },
          { href: "/admin/push", label: "Send Notification", sub: "Push message to users or roles", icon: Activity },
          { href: "/admin/executive", label: "Executive Dashboard", sub: "Revenue trends and plan analytics", icon: TrendingUp },
          { href: "/admin/os", label: "Platform Settings", sub: "Manage accounts, modules, config", icon: Settings },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <motion.div
              whileTap={{ scale: 0.98 }}
              className="px-4 py-3 flex items-center gap-3 border-b border-border/30 last:border-0 min-h-[60px]"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <item.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">{item.sub}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
}
