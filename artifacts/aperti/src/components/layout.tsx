import { useLocation, Link } from "wouter";
import {
  LayoutDashboard, QrCode, CalendarDays, ClipboardList, CheckSquare2,
  FileText, Video, Smartphone, Users2, PenLine,
  BookMarked, Layers, Wand2, Palette, FlaskConical, Brain, ScanLine,
  BarChart3, TrendingUp, ClipboardCheck,
  Award, CreditCard, HelpCircle,
  Terminal, Globe, Library, Shield, DollarSign, Cpu, PieChart,
  RefreshCw, Settings, MessageSquare,
  LogOut, School, ChevronLeft, ChevronRight, Search, KeyRound,
  Sun, Moon, Sparkles, Zap,
} from "lucide-react";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import CommandPalette, { useCommandPalette } from "@/components/command-palette";
import NotificationBell from "@/components/notification-bell";
import ChangePasswordModal from "@/components/change-password-modal";
import { useTheme } from "@/context/theme";
import { motion, AnimatePresence } from "framer-motion";
import { useTour } from "@/components/onboarding-tour";

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
  const [collapsed, setCollapsed] = useState(false);
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette();
  const { accent, setAccent, dark, toggleDark, THEMES } = useTheme();
  const { startTour } = useTour();

  const isAdmin = user?.role === "admin";
  const isAssistant = user?.role === "assistant";

  const navGroups: NavGroup[] = [
    {
      label: "Core",
      items: [
        { name: "CoreHub™", href: "/", icon: LayoutDashboard, roles: ["admin","teacher","assistant"] },
        { name: "CheckIn™", href: "/checkin", icon: QrCode, roles: ["admin","teacher","assistant"] },
        { name: "PlanGrid™", href: "/plan-grid", icon: CalendarDays, roles: ["admin","teacher"] },
      ],
    },
    {
      label: "Teaching",
      items: [
        { name: "SubmitFlow™", href: "/submit-flow", icon: ClipboardList, roles: ["admin","teacher"] },
        { name: "GradeFlow™", href: "/grade-flow", icon: CheckSquare2, roles: ["admin","teacher","assistant"] },
        { name: "SchemeCraft™", href: "/scheme-craft", icon: FileText, roles: ["admin","teacher"] },
        { name: "LiveClass™", href: "/live-class", icon: Video, roles: ["admin","teacher"] },
        { name: "TwinControl™", href: "/twin-control", icon: Smartphone, roles: ["admin","teacher"] },
        { name: "ClassForge™", href: "/class-forge", icon: Users2, roles: ["admin","teacher"] },
        { name: "InkSpace™", href: "/inkspace", icon: PenLine, roles: ["admin","teacher","assistant"] },
      ],
    },
    {
      label: "Content",
      items: [
        { name: "QueryVault™", href: "/query-vault", icon: BookMarked, roles: ["admin","teacher"] },
        { name: "CardStack™", href: "/cardstack", icon: Layers, roles: ["admin","teacher"] },
        { name: "Syllabuilder™", href: "/syllabuilder", icon: Wand2, roles: ["admin","teacher"] },
        { name: "ContentCraft™", href: "/content-craft", icon: Palette, roles: ["admin","teacher"] },
        { name: "LabBuilder™", href: "/lab-builder", icon: FlaskConical, roles: ["admin","teacher"] },
        { name: "MarkerMind™", href: "/marker-mind", icon: Brain, roles: ["admin","teacher","assistant"] },
        { name: "ScanScribe™", href: "/scan-scribe", icon: ScanLine, roles: ["admin","teacher","assistant"] },
      ],
    },
    {
      label: "Insights",
      items: [
        { name: "Pulse™", href: "/pulse", icon: BarChart3, roles: ["admin","teacher"] },
        { name: "InsightStream™", href: "/insight-stream", icon: TrendingUp, roles: ["admin","teacher"] },
        { name: "InsightExams™", href: "/insight-exams", icon: ClipboardCheck, roles: ["admin","teacher","assistant"] },
      ],
    },
    {
      label: "Manage",
      items: [
        { name: "KudosEngine™", href: "/kudos-engine", icon: Award, roles: ["admin","teacher"] },
        { name: "SubPilot™", href: "/subpilot", icon: CreditCard, roles: ["admin","teacher"] },
        { name: "HelpDesk™", href: "/helpdesk", icon: HelpCircle, roles: ["admin","teacher","assistant"] },
      ],
    },
    {
      label: "Admin",
      items: [
        { name: "Command Center", href: "/admin/command", icon: Terminal, roles: ["admin"] },
        { name: "WorldPilot™", href: "/admin/world-pilot", icon: Globe, roles: ["admin"] },
        { name: "PaperVault Admin", href: "/admin/paper-vault", icon: Library, roles: ["admin"] },
        { name: "ShieldCore™", href: "/admin/shield-core", icon: Shield, roles: ["admin"] },
        { name: "BudgetSense™", href: "/admin/budget-sense", icon: DollarSign, roles: ["admin"] },
        { name: "AutoScale™", href: "/admin/auto-scale", icon: Cpu, roles: ["admin"] },
        { name: "SpendWise™", href: "/admin/spend-wise", icon: PieChart, roles: ["admin"] },
        { name: "QuickSwitch™", href: "/admin/quick-switch", icon: RefreshCw, roles: ["admin"] },
        { name: "SubPilot Settings", href: "/admin/subpilot-settings", icon: Settings, roles: ["admin"] },
        { name: "HelpDesk Admin", href: "/admin/helpdesk", icon: MessageSquare, roles: ["admin"] },
      ],
    },
  ];

  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !user || item.roles.includes(user.role)),
    }))
    .filter((group) => group.items.length > 0);

  const handleLogout = async () => {
    await logout();
    toast({ title: "Signed out" });
  };

  const roleBadgeColor = {
    admin: "text-purple-600 dark:text-purple-400",
    teacher: "text-primary",
    assistant: "text-emerald-600 dark:text-emerald-400",
    student: "text-primary",
    parent: "text-amber-600 dark:text-amber-400",
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
    )?.name || "CoreHub™";

  return (
    <div className="min-h-screen flex w-full bg-background font-sans">
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* Sidebar */}
      <div
        className={`${collapsed ? "w-14" : "w-60"} bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0 transition-all duration-300 z-20 shrink-0`}
      >
        {/* Logo */}
        <div
          className={`p-3 border-b border-sidebar-border flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2 shrink-0`}
        >
          {!collapsed && (
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shrink-0">
                <School className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-sm tracking-tight text-foreground leading-none">
                  Aperti<span className="text-primary">.</span>
                </h1>
                <p className="text-[10px] text-muted-foreground mt-0.5">Educational OS</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <School className="w-4 h-4" />
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0 p-0.5 rounded"
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Search */}
        {!collapsed && (
          <div className="px-3 pt-2.5 shrink-0">
            <button
              onClick={() => setPaletteOpen(true)}
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
          {filteredGroups.map((group, gi) => (
            <div key={gi} className="space-y-0.5">
              {!collapsed && (
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
                    className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                    } ${collapsed ? "justify-center" : ""}`}
                    title={collapsed ? item.name : undefined}
                  >
                    <item.icon
                      className={`w-3.5 h-3.5 shrink-0 ${!isActive && "group-hover:text-primary"} transition-colors`}
                    />
                    {!collapsed && <span className="truncate">{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border shrink-0">
          {!collapsed && (
            <div className="px-3 py-2 flex items-center justify-between border-b border-border/30">
              <div className="flex items-center gap-1">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setAccent(t.id)}
                    className={`w-3 h-3 rounded-full transition-transform ${accent === t.id ? "ring-2 ring-offset-1 ring-primary scale-110 dark:ring-offset-background" : "hover:scale-125"}`}
                    style={{ backgroundColor: `hsl(${t.primary})` }}
                    title={t.label}
                  />
                ))}
              </div>
              <button
                onClick={toggleDark}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
              >
                {dark ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
              </button>
            </div>
          )}

          {!collapsed ? (
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground text-[11px] h-7"
                  >
                    <KeyRound className="w-3 h-3" />
                    Change Password
                  </Button>
                }
              />
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground text-[11px] h-7"
                onClick={startTour}
              >
                <Sparkles className="w-3 h-3" />
                Replay Tour
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-[11px] h-7"
                onClick={handleLogout}
              >
                <LogOut className="w-3 h-3" />
                Sign out
              </Button>
            </div>
          ) : (
            <div className="p-2 flex flex-col gap-1 items-center">
              <button
                onClick={toggleDark}
                className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded hover:bg-muted"
                title="Toggle theme"
              >
                {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleLogout}
                className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded hover:bg-destructive/10"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-auto relative">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/40 px-5 py-2.5 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground/50 text-xs hidden sm:inline">Aperti</span>
            <span className="text-muted-foreground/50 text-xs hidden sm:inline">/</span>
            <span className="text-foreground text-sm font-medium">{currentPage}</span>
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

        <div className="flex-1 p-5 lg:p-7 max-w-[1400px] mx-auto w-full">
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
    </div>
  );
}
