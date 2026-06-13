import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Building2, Shield, BookOpen, CreditCard,
  BarChart3, Activity, Flag, FileText, Lock, TicketCheck, Library,
  Settings, Scale, Database, ChevronLeft, ChevronRight, Menu, X,
  Layers, ShoppingCart, UserCheck, GraduationCap, ListTodo,
  Zap, BookMarked, UserCog, AlertTriangle, ShieldCheck, Grid3X3,
  Rocket, Package, TestTube, Map, Layout, Quote, HelpCircle,
  Calendar, Palette, Megaphone, TrendingUp, PieChart, Globe, Star,
  Bug, FlaskConical, History, ClipboardList,
  Crown, DollarSign, Bell, Tag, Award, ShieldAlert, Network,
  Clock, TrendingDown, CalendarCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/admin/os" },

  { label: "— Users & Access", header: true },
  { label: "Users", icon: Users, href: "/admin/os/users" },
  { label: "User Access", icon: UserCheck, href: "/admin/os/user-access" },
  { label: "Assistants", icon: UserCog, href: "/admin/os/assistants" },

  { label: "— Governance", header: true },
  { label: "Roles & Permissions", icon: Shield, href: "/admin/os/roles" },
  { label: "Enrollments", icon: GraduationCap, href: "/admin/os/enrollments" },

  { label: "— Growth & Launch", header: true },
  { label: "Growth Dashboard",    icon: TrendingUp,   href: "/admin/os/growth" },
  { label: "Feature Registry",    icon: Package,      href: "/admin/os/feature-registry" },
  { label: "Waitlists",           icon: Users,        href: "/admin/os/waitlists" },
  { label: "Beta Program",        icon: TestTube,     href: "/admin/os/beta" },
  { label: "Release Notes",       icon: FileText,     href: "/admin/os/release-notes" },
  { label: "Roadmap",             icon: Map,          href: "/admin/os/roadmap-admin" },
  { label: "Landing CMS",         icon: Layout,       href: "/admin/os/landing-cms" },
  { label: "FAQs",                icon: HelpCircle,   href: "/admin/os/faqs" },
  { label: "Events",              icon: Calendar,     href: "/admin/os/events" },
  { label: "Demo & Branding",     icon: Palette,      href: "/admin/os/demo-branding" },
  { label: "Campaigns",           icon: Megaphone,    href: "/admin/os/campaigns" },
  { label: "Conversion Analytics",icon: PieChart,     href: "/admin/os/conversion" },
  { label: "Feature Adoption",    icon: BarChart3,    href: "/admin/os/adoption" },
  { label: "Announcements",       icon: Megaphone,    href: "/admin/os/announcements" },
  { label: "Platform Status",     icon: Globe,        href: "/admin/os/platform-status" },
  { label: "Features & Access", icon: Grid3X3, href: "/admin/os/features-matrix" },
  { label: "Conflict Center", icon: AlertTriangle, href: "/admin/os/conflicts" },
  { label: "Integrity Check", icon: ShieldCheck, href: "/admin/os/integrity" },

  { label: "— Platform", header: true },
  { label: "Organizations", icon: Building2, href: "/admin/os/organizations" },
  { label: "Courses", icon: BookOpen, href: "/admin/os/courses" },
  { label: "Plans", icon: Layers, href: "/admin/os/plans" },
  { label: "Subscriptions", icon: ShoppingCart, href: "/admin/os/subscriptions" },
  { label: "Payments", icon: CreditCard, href: "/admin/os/payments" },

  { label: "— Quality & Testing", header: true },
  { label: "Bug Tracker",         icon: Bug,          href: "/admin/os/qa/bugs" },
  { label: "Test Cases",          icon: FlaskConical, href: "/admin/os/qa/test-cases" },
  { label: "Test Runs",           icon: History,      href: "/admin/os/qa/test-runs" },
  { label: "Launch Readiness",    icon: Rocket,       href: "/admin/os/qa/readiness" },
  { label: "Security Scan",       icon: ShieldCheck,  href: "/admin/os/qa/security" },

  { label: "— Trust & Content", header: true },
  { label: "Content Governance",  icon: ClipboardList, href: "/admin/os/content-governance" },
  { label: "Testimonials",        icon: Quote,         href: "/admin/os/testimonials" },

  { label: "— Operations", header: true },
  { label: "Analytics", icon: BarChart3, href: "/admin/os/analytics" },
  { label: "System Health", icon: Activity, href: "/admin/os/health" },
  { label: "AI Usage", icon: Zap, href: "/admin/os/ai-usage" },
  { label: "Feature Flags", icon: Flag, href: "/admin/os/features" },
  { label: "Audit Logs", icon: FileText, href: "/admin/os/audit" },
  { label: "Security", icon: Lock, href: "/admin/os/security" },
  { label: "Support Tickets", icon: TicketCheck, href: "/admin/os/tickets" },
  { label: "Problem Reports", icon: AlertTriangle, href: "/admin/os/problem-reports" },
  { label: "Knowledge Base", icon: Library, href: "/admin/os/kb" },
  { label: "Compliance", icon: Scale, href: "/admin/os/compliance" },
  { label: "Backups", icon: Database, href: "/admin/os/backups" },
  { label: "Job Queue", icon: ListTodo, href: "/admin/os/queue" },
  { label: "Performance", icon: Zap, href: "/admin/os/performance" },
  { label: "Platform Settings", icon: Settings, href: "/admin/os/settings" },
  { label: "Docs", icon: BookMarked, href: "/admin/os/docs" },
  { label: "Launch Audit", icon: Rocket, href: "/admin/os/launch-audit" },

  { label: "— Founder Control", header: true },
  { label: "Founder Overview",    icon: Crown,       href: "/admin/os/founder" },
  { label: "Revenue Dashboard",   icon: DollarSign,  href: "/admin/os/founder-revenue" },
  { label: "Growth Analytics",    icon: TrendingUp,  href: "/admin/os/founder-growth" },
  { label: "Content Quality",     icon: Award,       href: "/admin/os/content-quality" },
  { label: "AI Cost Management",  icon: Zap,         href: "/admin/os/ai-costs" },
  { label: "Notification Rules",  icon: Bell,        href: "/admin/os/notification-rules" },
  { label: "Founder Alerts",      icon: AlertTriangle, href: "/admin/os/founder-alerts" },
  { label: "Error Logs",          icon: Bug,         href: "/admin/os/error-logs" },
  { label: "Launch Command",      icon: Rocket,      href: "/admin/os/launch-command" },
  { label: "Launch Blockers",     icon: ShieldAlert, href: "/admin/os/launch-blockers" },
  { label: "Launch Certification",icon: Rocket,      href: "/admin/os/launch-certification" },
  { label: "Releases",            icon: Tag,         href: "/admin/os/releases" },

  { label: "— Phase 30 Intelligence", header: true },
  { label: "Error Intelligence",   icon: ShieldAlert, href: "/admin/os/error-intelligence" },
  { label: "Learning Efficiency",  icon: TrendingUp,  href: "/admin/os/learning-efficiency" },
  { label: "Content Validation",   icon: ShieldCheck, href: "/admin/os/ai-content-validation" },
  { label: "Resource Relationships", icon: Network,   href: "/admin/os/resource-relationships" },

  { label: "— Phase 32 Zero-Defect", header: true },
  { label: "Launch Dashboard",     icon: Rocket,      href: "/admin/os/launch-dashboard" },
  { label: "Route Health",         icon: Activity,    href: "/admin/os/route-health" },
  { label: "Platform Config",      icon: Settings,    href: "/admin/os/platform-config" },

  { label: "— Production Hardening", header: true },
  { label: "System Inventory",     icon: Package,     href: "/admin/os/system-inventory" },

  { label: "— Intelligence & Health", header: true },
  { label: "Debug Center",         icon: Bug,         href: "/admin/os/debug-center" },
  { label: "Analytics Deep Dive",  icon: BarChart3,   href: "/admin/os/analytics-extended" },
  { label: "Stability Score",      icon: Activity,    href: "/admin/os/stability-score" },
  { label: "Slow Queries",         icon: Clock,       href: "/admin/os/slow-queries" },
  { label: "Friction Analytics",   icon: TrendingDown,href: "/admin/os/friction-analytics" },
  { label: "Weekly Audit",         icon: CalendarCheck,href:"/admin/os/weekly-audit" },
  { label: "Database Health",      icon: Database,    href: "/admin/os/db-health" },
  { label: "No Mock Data Audit",   icon: ShieldCheck, href: "/admin/os/no-mock-data" },
] as const;

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
        {collapsed && !mobile ? (
          <span className="font-bold text-sm text-gray-900">A<span className="text-teal-600">.</span></span>
        ) : (
          <div>
            <p className="font-bold text-gray-900 text-sm">Admin OS</p>
            <p className="text-[10px] text-gray-400">Platform Control</p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map((item: any) => {
          if (item.header) {
            if (collapsed && !mobile) return null;
            return (
              <div key={item.label} className="px-3 pt-4 pb-1">
                <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">{item.label.replace("— ", "")}</p>
              </div>
            );
          }
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
            <span className="text-[10px] text-gray-400">v11.0</span>
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
