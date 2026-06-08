import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Building2, Shield, BookOpen, CreditCard,
  BarChart3, Activity, Flag, FileText, Lock, TicketCheck, Library,
  Settings, Scale, Database, ChevronLeft, ChevronRight, Menu, X,
  Layers, ShoppingCart, UserCheck, GraduationCap, Bell, ListTodo,
  Zap, BookMarked,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/admin/os" },
  { label: "Users", icon: Users, href: "/admin/os/users" },
  { label: "Organizations", icon: Building2, href: "/admin/os/organizations" },
  { label: "Roles & Permissions", icon: Shield, href: "/admin/os/roles" },
  { label: "Enrollments", icon: GraduationCap, href: "/admin/os/enrollments" },
  { label: "Courses", icon: BookOpen, href: "/admin/os/courses" },
  { label: "Plans", icon: Layers, href: "/admin/os/plans" },
  { label: "Subscriptions", icon: ShoppingCart, href: "/admin/os/subscriptions" },
  { label: "Payments", icon: CreditCard, href: "/admin/os/payments" },
  { label: "Analytics", icon: BarChart3, href: "/admin/os/analytics" },
  { label: "System Health", icon: Activity, href: "/admin/os/health" },
  { label: "Feature Flags", icon: Flag, href: "/admin/os/features" },
  { label: "Moderation", icon: UserCheck, href: "/admin/os/moderation" },
  { label: "Audit Logs", icon: FileText, href: "/admin/os/audit" },
  { label: "Security", icon: Lock, href: "/admin/os/security" },
  { label: "Support Tickets", icon: TicketCheck, href: "/admin/os/tickets" },
  { label: "Knowledge Base", icon: Library, href: "/admin/os/kb" },
  { label: "Platform Settings", icon: Settings, href: "/admin/os/settings" },
  { label: "Compliance", icon: Scale, href: "/admin/os/compliance" },
  { label: "Backups", icon: Database, href: "/admin/os/backups" },
  { label: "Job Queue", icon: ListTodo, href: "/admin/os/queue" },
  { label: "Performance", icon: Zap, href: "/admin/os/performance" },
  { label: "Docs", icon: BookMarked, href: "/admin/os/docs" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div
      className={cn(
        "flex flex-col h-full bg-white border-r border-gray-100 transition-all duration-300",
        mobile ? "w-64" : collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center gap-3 px-4 py-5 border-b border-gray-100", collapsed && !mobile && "justify-center px-2")}>
        <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <LayoutDashboard className="w-4 h-4 text-white" />
        </div>
        {(!collapsed || mobile) && (
          <div>
            <p className="font-bold text-gray-900 text-sm">Admin OS</p>
            <p className="text-[10px] text-gray-400">Platform Control</p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map((item) => {
          const active = location === item.href || (item.href !== "/admin/os" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <a
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
                  active
                    ? "bg-teal-50 text-teal-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                  collapsed && !mobile && "justify-center px-2"
                )}
                onClick={() => mobile && setMobileOpen(false)}
                title={collapsed && !mobile ? item.label : undefined}
              >
                <item.icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-teal-600" : "text-gray-400")} />
                {(!collapsed || mobile) && <span className="truncate">{item.label}</span>}
              </a>
            </Link>
          );
        })}
      </nav>

      {/* Version footer */}
      {(!collapsed || mobile) && (
        <div className="px-4 py-3 border-t border-gray-100 space-y-0.5">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Aperti Platform</p>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400">v10.0</span>
            {import.meta.env.VITE_COMMIT_HASH && import.meta.env.VITE_COMMIT_HASH !== "dev" && (
              <>
                <span className="text-gray-200">·</span>
                <span className="font-mono text-[10px] text-teal-500 bg-teal-50 px-1.5 py-0.5 rounded">
                  {import.meta.env.VITE_COMMIT_HASH}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Collapse toggle (desktop only) */}
      {!mobile && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-3 border-t border-gray-100 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 h-full z-50 md:hidden"
            >
              <Sidebar mobile />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-4 px-4 md:px-6 py-3 bg-white border-b border-gray-100">
          <button className="md:hidden text-gray-500 hover:text-gray-700" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <Link href="/admin/command">
            <a className="text-xs text-gray-500 hover:text-teal-600 transition-colors">← Classic Admin</a>
          </Link>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
