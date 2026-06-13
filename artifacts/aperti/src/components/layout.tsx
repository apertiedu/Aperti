import { useLocation, Link } from "wouter";
import {
  LayoutDashboard, QrCode, CalendarDays, ClipboardList, CheckSquare2, History,
  FileText, Users2,
  BookMarked, Layers, Wand2, Palette, FlaskConical, Brain, ScanLine,
  BarChart3, TrendingUp, ClipboardCheck,
  Award, CreditCard, HelpCircle,
  Terminal, Globe, Library, Shield, DollarSign, Cpu, PieChart, Package,
  RefreshCw, Settings, MessageSquare,
  LogOut, ChevronLeft, ChevronRight, Search, KeyRound,
  Sun, Moon, ShoppingBag, UserCheck, Link2, Bot, Sparkles,
  GraduationCap, TableProperties, Medal, Scale, Archive,
  Bell, Inbox, Hash, Megaphone, Users, Ticket, Menu, X, Activity,
} from "lucide-react";
import { assertRouteValid } from "@/lib/route-registry";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import CommandPalette, { useCommandPalette } from "@/components/command-palette";
import { useRecentPages } from "@/hooks/use-recent-pages";
import NotificationBell from "@/components/notification-bell";
import ChangePasswordModal from "@/components/change-password-modal";
import { useTheme } from "@/context/theme";
import { motion, AnimatePresence } from "framer-motion";
import MobileBottomNav from "@/components/mobile-bottom-nav";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [collapsed, setCollapsedRaw] = useState(() => {
    try { return localStorage.getItem("aperti_sidebar_collapsed") === "1"; } catch { return false; }
  });
  const setCollapsed = (v: boolean) => {
    setCollapsedRaw(v);
    try { localStorage.setItem("aperti_sidebar_collapsed", v ? "1" : "0"); } catch {}
  };
  const [mobileOpen, setMobileOpen] = useState(false);
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette();
  const { dark, toggleDark } = useTheme();
  const { recent, push } = useRecentPages();

  const isAdmin = user?.role === "admin";
  const isAssistant = user?.role === "assistant";

  const navGroups: NavGroup[] = [
    {
      label: "Core",
      items: [
        ...(isAdmin
          ? [{ name: "Command Center", href: "/", icon: Terminal, roles: ["admin"] as string[] }]
          : [{ name: "CoreHub", href: "/", icon: LayoutDashboard, roles: ["teacher","assistant"] as string[] }]
        ),
        { name: "CheckIn", href: "/checkin", icon: QrCode, roles: ["admin","teacher","assistant"] },
        { name: "PlanGrid", href: "/plan-grid", icon: CalendarDays, roles: ["admin","teacher"] },
      ],
    },
    {
      label: "Teaching",
      items: [
        { name: "Assessments", href: "/teacher/assessments", icon: GraduationCap, roles: ["admin","teacher"] },
        { name: "SubmitFlow", href: "/submit-flow", icon: ClipboardList, roles: ["admin","teacher"] },
        { name: "GradeFlow", href: "/grade-flow", icon: CheckSquare2, roles: ["admin","teacher","assistant"] },
        { name: "SchemeCraft", href: "/scheme-craft", icon: FileText, roles: ["admin","teacher"] },
      ],
    },
    {
      label: "Content",
      items: [
        { name: "QueryVault", href: "/query-vault", icon: BookMarked, roles: ["admin","teacher"] },
        { name: "Question Extract", href: "/teacher/questions/extract", icon: Sparkles, roles: ["admin","teacher"] },
        { name: "CardStack", href: "/cardstack", icon: Layers, roles: ["admin","teacher"] },
        { name: "Syllabuilder", href: "/syllabuilder", icon: Wand2, roles: ["admin","teacher"] },
        { name: "ContentCraft", href: "/content-craft", icon: Palette, roles: ["admin","teacher"] },
        { name: "LabBuilder", href: "/lab-builder", icon: FlaskConical, roles: ["admin","teacher"] },
        { name: "MarkerMind", href: "/marker-mind", icon: Brain, roles: ["admin","teacher","assistant"] },
        { name: "ScanScribe", href: "/scan-scribe", icon: ScanLine, roles: ["admin","teacher","assistant"] },
      ],
    },
    {
      label: "Insights",
      items: [
        { name: "Gradebook+", href: "/gradebook-plus", icon: TableProperties, roles: ["admin","teacher"] },
        { name: "Moderation", href: "/teacher/moderation", icon: Scale, roles: ["admin","teacher"] },
        { name: "Pulse", href: "/pulse", icon: BarChart3, roles: ["admin","teacher"] },
        { name: "InsightStream", href: "/insight-stream", icon: TrendingUp, roles: ["admin","teacher"] },
        { name: "InsightExams", href: "/insight-exams", icon: ClipboardCheck, roles: ["admin","teacher","assistant"] },
      ],
    },
    {
      label: "Marketplace",
      items: [
        { name: "Course Marketplace", href: "/courses", icon: ShoppingBag, roles: ["admin","teacher","assistant","parent"] },
        { name: "My Courses", href: "/my-courses", icon: BookMarked, roles: ["admin","teacher"] },
        { name: "Student Approvals", href: "/student-approvals", icon: UserCheck, roles: ["admin","teacher"] },
        { name: "Link Child Account", href: "/parent/link-student", icon: Link2, roles: ["parent"] },
      ],
    },
    {
      label: "Manage",
      items: [
        { name: "Certifications", href: "/certifications", icon: Medal, roles: ["admin","teacher"] },
        { name: "Cert Admin", href: "/admin/certificates", icon: Award, roles: ["admin"] },
        { name: "Archives", href: "/teacher/archives", icon: Archive, roles: ["admin","teacher"] },
        { name: "AutoPilot", href: "/automation", icon: Bot, roles: ["admin","teacher"] },
        { name: "KudosEngine", href: "/kudos-engine", icon: Award, roles: ["admin","teacher"] },
        { name: "HelpDesk", href: "/helpdesk", icon: HelpCircle, roles: ["admin","teacher","assistant"] },
      ],
    },
    {
      label: "Admin",
      items: [
        { name: "Admin Overview",         href: "/admin/command",              icon: Terminal,    roles: ["admin"] },
        { name: "WorldPilot",             href: "/admin/world-pilot",          icon: Globe,       roles: ["admin"] },
        { name: "Landing Editor",         href: "/admin/landing-editor",       icon: Globe,       roles: ["admin"] },
        { name: "PaperVault Admin",        href: "/admin/paper-vault",         icon: Library,     roles: ["admin"] },
        { name: "ShieldCore",             href: "/admin/shield-core",          icon: Shield,      roles: ["admin"] },
        { name: "Assistant Permissions",  href: "/admin/assistant-permissions",icon: KeyRound,    roles: ["admin"] },
        { name: "BudgetSense",            href: "/admin/budget-sense",         icon: DollarSign,  roles: ["admin"] },
        { name: "AutoScale",              href: "/admin/auto-scale",           icon: Cpu,         roles: ["admin"] },
        { name: "SpendWise",              href: "/admin/spend-wise",           icon: PieChart,    roles: ["admin"] },
        { name: "QuickSwitch",            href: "/admin/quick-switch",         icon: RefreshCw,   roles: ["admin"] },
        { name: "HelpDesk Admin",         href: "/admin/helpdesk",             icon: MessageSquare, roles: ["admin"] },
        { name: "GuardianPulse",          href: "/admin/guardian-pulse",       icon: Sparkles,    roles: ["admin"] },
        { name: "Moderation Panel",       href: "/admin/moderation",           icon: Shield,      roles: ["admin"] },
        { name: "Comm Analytics",         href: "/admin/communication-analytics", icon: BarChart3, roles: ["admin"] },
        { name: "Plans & Pricing",          href: "/admin/plans",                icon: Package,     roles: ["admin"] },
        { name: "Commerce Admin",          href: "/admin/commerce",             icon: DollarSign,  roles: ["admin"] },
        { name: "Executive Dashboard",    href: "/admin/executive",            icon: TrendingUp,  roles: ["admin"] },
        { name: "Route Health",            href: "/admin/route-health",         icon: Shield,      roles: ["admin"] },
        { name: "Feature Status",          href: "/admin/feature-status",       icon: Sparkles,    roles: ["admin"] },
        { name: "Data Quality",            href: "/admin/data-quality",         icon: BarChart3,   roles: ["admin"] },
        { name: "Session Slots",           href: "/admin/session-slots",        icon: CalendarDays,roles: ["admin", "teacher"] },
        { name: "Attendance Audit",        href: "/attendance-audit",           icon: Shield,      roles: ["admin", "teacher"] },
        { name: "Enrollment Timeline",     href: "/enrollment-timeline",        icon: History,     roles: ["admin", "teacher"] },
        { name: "System Debug",            href: "/admin/debug",                icon: Terminal,    roles: ["admin"] },
        { name: "Test Runner",             href: "/admin/test-runner",          icon: Activity,    roles: ["admin"] },
        { name: "Feature Registry",        href: "/admin/feature-registry",     icon: Layers,      roles: ["admin"] },
      ],
    },
    {
      label: "Billing",
      items: [
        { name: "Pricing Plans",          href: "/pricing",               icon: CreditCard, roles: ["admin","teacher","assistant"] },
        { name: "My Subscription",        href: "/account/subscription",  icon: CreditCard, roles: ["admin","teacher","assistant"] },
        { name: "Coming Soon",            href: "/coming-soon",           icon: Sparkles,   roles: ["admin","teacher","assistant"] },
        { name: "Revision Notes",         href: "/revision-notes",        icon: FileText,   roles: ["admin","teacher","assistant"] },
      ],
    },
    {
      label: "Communication",
      items: [
        { name: "Inbox",        href: "/inbox",          icon: Inbox,        roles: ["admin","teacher","assistant"] },
        { name: "Announcements",href: "/announcements",  icon: Megaphone,    roles: ["admin","teacher","assistant"] },
        { name: "Study Rooms",  href: "/rooms",          icon: Users,        roles: ["admin","teacher","assistant"] },
        { name: "Support",      href: "/support",        icon: Ticket,       roles: ["admin","teacher","assistant"] },
        { name: "Notifications",href: "/notifications",  icon: Bell,         roles: ["admin","teacher","assistant"] },
        { name: "Messages",     href: "/messages",       icon: MessageSquare,roles: ["admin","teacher","assistant"] },
      ],
    },
  ];

  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!user || !item.roles.includes(user.role)) return false;
        assertRouteValid(item.href, item.name);
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);

  const handleLogout = async () => {
    await logout();
    toast({ title: "Signed out" });
  };

  const roleBadgeColor = {
    admin: "text-primary",
    teacher: "text-primary",
    assistant: "text-primary",
    student: "text-primary",
    parent: "text-primary",
  }[user?.role ?? "teacher"] ?? "text-muted-foreground";

  const initials = (user?.displayName || user?.username || "U")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const flatNav = navGroups.flatMap((g) => g.items);
  const currentPage =
    flatNav.find(
      (item) =>
        location === item.href ||
        (item.href !== "/" && location.startsWith(item.href)),
    )?.name || (isAdmin ? "Command Center" : "CoreHub");

  const breadcrumbGroup =
    navGroups.find((g) =>
      g.items.some(
        (item) =>
          location === item.href ||
          (item.href !== "/" && location.startsWith(item.href)),
      ),
    )?.label ?? null;

  useEffect(() => {
    if (currentPage && location !== "/" && !location.startsWith("/admin/os")) {
      push(location, currentPage);
    }
  }, [location, currentPage]);

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      {/* Logo */}
      <div
        className={`p-3 border-b border-sidebar-border flex items-center ${(!isMobile && collapsed) ? "justify-center" : "justify-between"} gap-2 shrink-0`}
      >
        {(!isMobile && collapsed) ? (
          <span className="font-bold text-sm tracking-tight text-foreground">A</span>
        ) : (
          <div className="overflow-hidden">
            <h1 className="font-bold text-sm tracking-tight text-foreground leading-none">
              Aperti
            </h1>
          </div>
        )}
        {isMobile && (
          <button onClick={() => setMobileOpen(false)} className="text-muted-foreground hover:text-foreground p-1 rounded" aria-label="Close menu">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search */}
      {(isMobile || !collapsed) && (
        <div className="px-3 pt-2.5 shrink-0">
          <button
            onClick={() => { setPaletteOpen(true); if (isMobile) setMobileOpen(false); }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border/60 bg-muted/40 text-xs text-muted-foreground hover:border-primary/30 hover:bg-muted/70 transition-all"
          >
            <Search className="h-3 w-3 shrink-0" />
            <span className="flex-1 text-left">Search modules…</span>
            <kbd className="bg-muted px-1 py-0.5 rounded text-[9px] font-mono">⌘K</kbd>
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto mt-2 px-2 py-1 space-y-3">
        {/* Recent pages */}
        {(isMobile || !collapsed) && recent.length > 0 && (
          <div className="space-y-0.5">
            <p className="px-2 text-[9px] font-bold tracking-widest text-muted-foreground/60 uppercase mb-1">Recent</p>
            {recent.slice(0, 3).map((p) => (
              <Link
                key={p.href}
                href={p.href}
                onClick={() => isMobile && setMobileOpen(false)}
                className="group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-all duration-150 min-h-[32px]"
              >
                <RefreshCw className="w-3 h-3 shrink-0 opacity-50 group-hover:text-primary" />
                <span className="truncate">{p.label}</span>
              </Link>
            ))}
          </div>
        )}
        {filteredGroups.map((group, gi) => (
          <div key={gi} className="space-y-0.5">
            {(isMobile || !collapsed) && (
              <p className="px-2 text-[9px] font-bold tracking-widest text-muted-foreground/60 uppercase mb-1">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const isActive =
                location === item.href ||
                (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => isMobile && setMobileOpen(false)}
                  className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 min-h-[36px] ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                  } ${(!isMobile && collapsed) ? "justify-center" : ""}`}
                  title={(!isMobile && collapsed) ? item.name : undefined}
                >
                  <item.icon
                    className={`w-3.5 h-3.5 shrink-0 ${!isActive && "group-hover:text-primary"} transition-colors`}
                  />
                  {(isMobile || !collapsed) && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border shrink-0">
        {(isMobile || !collapsed) && (
          <div className="px-3 py-2 flex items-center justify-end border-b border-border/30">
            <button
              onClick={toggleDark}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
            >
              {dark ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
            </button>
          </div>
        )}

        {(isMobile || !collapsed) ? (
          <div className="p-2 space-y-1">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/40 border border-border/40">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-bold shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-foreground truncate">
                  {user?.displayName || user?.username}
                </p>
                <p className={`text-[9px] font-medium truncate ${roleBadgeColor}`}>{user?.role}</p>
              </div>
            </div>
            <ChangePasswordModal
              trigger={
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground text-[11px] h-7">
                  <KeyRound className="w-3 h-3" />
                  Change Password
                </Button>
              }
            />
            <Link href="/account/sessions">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground text-[11px] h-7">
                <Shield className="w-3 h-3" />
                Active Sessions
              </Button>
            </Link>
            <Button
              variant="ghost" size="sm"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-[11px] h-7"
              onClick={handleLogout}
            >
              <LogOut className="w-3 h-3" />
              Sign out
            </Button>
          </div>
        ) : (
          <div className="p-2 flex flex-col gap-1 items-center">
            <button onClick={toggleDark} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded hover:bg-muted" title="Toggle theme">
              {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button onClick={handleLogout} className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded hover:bg-destructive/10" title="Sign out">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      {/* Sidebar collapse toggle — desktop only */}
      {!isMobile && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2.5 border-t border-sidebar-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      )}
    </>
  );

  return (
    <div className="min-h-screen flex w-full bg-background font-sans">
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
          <SidebarContent isMobile />
        </SheetContent>
      </Sheet>

      {/* Skip to main content — accessibility */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Desktop Sidebar */}
      <div
        className={`${collapsed ? "w-14" : "w-60"} hidden lg:flex bg-sidebar border-r border-sidebar-border flex-col h-screen sticky top-0 transition-all duration-300 z-20 shrink-0`}
      >
        <SidebarContent />
      </div>

      {/* Main content */}
      <main id="main-content" className="flex-1 flex flex-col min-w-0 overflow-auto relative">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/40 px-4 lg:px-5 py-2.5 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5 text-xs min-w-0">
              <span className="text-muted-foreground/50 font-medium hidden sm:inline shrink-0">Aperti</span>
              {breadcrumbGroup && (
                <>
                  <span className="text-muted-foreground/30 hidden sm:inline">/</span>
                  <span className="text-muted-foreground/60 hidden md:inline shrink-0">{breadcrumbGroup}</span>
                </>
              )}
              <span className="text-muted-foreground/30 hidden sm:inline">/</span>
              <span className="text-foreground font-semibold text-sm truncate">{currentPage}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border/40 bg-background"
            >
              <Search className="h-3 w-3" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline bg-muted px-1 py-0.5 rounded font-mono text-[9px]">⌘K</kbd>
            </button>
            <NotificationBell />
          </div>
        </div>

        <div className="flex-1 p-4 lg:p-7 pb-20 lg:pb-7 max-w-[1400px] mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="w-full h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav />
    </div>
  );
}
