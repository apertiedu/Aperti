import { useLocation, Link } from "wouter";
import {
  LayoutDashboard, CheckSquare, Users, CalendarClock, FileBarChart,
  School, LogOut, Shield, BookOpen, ClipboardList, BarChart3,
  ChevronLeft, ChevronRight, BookMarked, MessageSquare, Search,
  KeyRound, BookText, FolderOpen, Video, CreditCard, GraduationCap,
  Building2, Layers, Sun, Moon, Library, Wand2, AlertTriangle, Package, Sparkles
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

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette();
  const { accent, setAccent, dark, toggleDark, THEMES } = useTheme();

  const isAssistant = user?.role === "assistant";
  const isAdmin = user?.role === "admin";
  const { startTour } = useTour();

  const navGroups = [
    {
      label: "Core",
      items: [
        { name: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["admin", "teacher", "assistant"] },
        { name: "Mark Attendance", href: "/attendance", icon: CheckSquare, roles: ["admin", "teacher", "assistant"] },
        { name: "Students", href: "/students", icon: Users, roles: ["admin", "teacher", "assistant"] },
      ]
    },
    {
      label: "Academic",
      items: [
        { name: "Sessions", href: "/sessions", icon: CalendarClock, roles: ["admin", "teacher"] },
        { name: "Subjects", href: "/subjects", icon: BookOpen, roles: ["admin", "teacher"] },
        { name: "Exams & Marks", href: "/exams", icon: ClipboardList, roles: ["admin", "teacher", "assistant"] },
        { name: "Homework", href: "/homework", icon: BookText, roles: ["admin", "teacher"] },
      ]
    },
    {
      label: "Tools",
      items: [
        { name: "Question Bank", href: "/question-bank", icon: BookMarked, roles: ["admin", "teacher"] },
        { name: "Exam Generator", href: "/exam-generator", icon: Wand2, roles: ["admin", "teacher"] },
        { name: "Past Papers", href: "/past-papers", icon: Library, roles: ["admin", "teacher"] },
        { name: "Flashcards", href: "/flashcards", icon: Layers, roles: ["admin", "teacher"] },
        { name: "Parent Comms", href: "/parent-comms", icon: MessageSquare, roles: ["admin", "teacher"] },
      ]
    },
    {
      label: "Content",
      items: [
        { name: "Resources", href: "/resources", icon: FolderOpen, roles: ["admin", "teacher"] },
        { name: "Recordings", href: "/recordings", icon: Video, roles: ["admin", "teacher"] },
      ]
    },
    {
      label: "Finance",
      items: [
        { name: "Payments", href: "/payments", icon: CreditCard, roles: ["admin", "teacher"] },
        { name: "Inventory", href: "/inventory", icon: Package, roles: ["admin", "teacher"] },
        { name: "Courses", href: "/courses", icon: GraduationCap, roles: ["admin", "teacher"] },
        { name: "Centers", href: "/centers", icon: Building2, roles: ["admin", "teacher"] },
      ]
    },
    {
      label: "Insights",
      items: [
        { name: "Analytics", href: "/analytics", icon: BarChart3, roles: ["admin", "teacher"] },
        { name: "Reports", href: "/reports", icon: FileBarChart, roles: ["admin", "teacher"] },
        { name: "Risk Report", href: "/risk-report", icon: AlertTriangle, roles: ["admin", "teacher"] },
      ]
    },
    {
      label: "Admin",
      items: [
        { name: "Admin Panel", href: "/admin", icon: Shield, roles: ["admin"] },
      ]
    }
  ];

  const filteredGroups = navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => !user || item.roles.includes(user.role))
  })).filter(group => group.items.length > 0);

  const handleLogout = async () => {
    await logout();
    toast({ title: "Signed out" });
  };

  const roleBadgeColor = {
    admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    teacher: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    assistant: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    student: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  }[user?.role ?? "assistant"] ?? "bg-muted text-muted-foreground";

  const initials = (user?.displayName || user?.username || "U")
    .split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  const flatNav = navGroups.flatMap(g => g.items);
  const currentPage = flatNav.find(item => item.href === location || (item.href !== "/" && location.startsWith(item.href)))?.name || "Dashboard";

  return (
    <div className="min-h-screen flex w-full bg-background font-sans">
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* Sidebar */}
      <div className={`${collapsed ? "w-16" : "w-64"} bg-card border-r border-border flex flex-col h-screen sticky top-0 transition-all duration-300 z-20`}>
        {/* Logo */}
        <div className={`p-4 border-b border-border flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-3 shrink-0`}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground flex-shrink-0 shadow-sm">
                <School className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-base tracking-tight text-foreground leading-none truncate">Aperti</h1>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Education Platform</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground shadow-sm">
              <School className="w-4 h-4" />
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Search trigger */}
        {!collapsed && (
          <div className="px-3 pt-3 shrink-0">
            <button
              onClick={() => setPaletteOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border/70 bg-muted/30 text-xs text-muted-foreground hover:border-primary/40 hover:bg-muted/60 transition-all"
            >
              <Search className="h-3 w-3 shrink-0" />
              <span className="flex-1 text-left truncate">Search...</span>
              <kbd className="bg-muted px-1 py-0.5 rounded text-[9px] font-mono shrink-0">⌘K</kbd>
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto mt-2 px-3 py-2 space-y-4 custom-scrollbar">
          {filteredGroups.map((group, gi) => (
            <div key={gi} className="space-y-1">
              {!collapsed && (
                <p className="px-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-1">{group.label}</p>
              )}
              {group.items.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 card-hover ${
                      isActive 
                        ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-sm" 
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    } ${collapsed ? "justify-center" : ""}`}
                    title={collapsed ? item.name : undefined}
                  >
                    <item.icon className={`w-4 h-4 flex-shrink-0 transition-transform ${!isActive && "group-hover:scale-110 text-muted-foreground group-hover:text-primary"}`} />
                    {!collapsed && <span className="truncate">{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Theme Picker & User Section */}
        <div className="border-t border-border shrink-0">
          {!collapsed && (
            <div className="px-4 py-3 flex items-center justify-between border-b border-border/50 bg-muted/10">
              <div className="flex items-center gap-1.5">
                {THEMES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setAccent(t.id)}
                    className={`w-3.5 h-3.5 rounded-full transition-transform ${accent === t.id ? 'ring-2 ring-offset-1 ring-primary scale-110 dark:ring-offset-background' : 'hover:scale-125'}`}
                    style={{ backgroundColor: `hsl(${t.primary})` }}
                    title={t.label}
                  />
                ))}
              </div>
              <button onClick={toggleDark} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted">
                {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}

          {!collapsed ? (
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-muted/50 border border-border/50">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-xs font-bold shadow-sm shrink-0">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">{user?.displayName || user?.username}</p>
                  <p className={`text-[10px] font-medium truncate ${roleBadgeColor.split(' ')[1] || 'text-muted-foreground'}`}>{user?.role}</p>
                </div>
              </div>
              <ChangePasswordModal
                trigger={
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground text-xs h-8">
                    <KeyRound className="w-3.5 h-3.5" />Change Password
                  </Button>
                }
              />
              <Button
                variant="ghost" size="sm"
                className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground text-xs h-8 transition-colors"
                onClick={startTour}
              >
                <Sparkles className="w-3.5 h-3.5" />Replay Tour
              </Button>
              <Button
                variant="ghost" size="sm"
                className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs h-8 transition-colors"
                onClick={handleLogout}
              >
                <LogOut className="w-3.5 h-3.5" />Sign out
              </Button>
            </div>
          ) : (
            <div className="p-3 flex flex-col gap-2 items-center">
              <button onClick={toggleDark} className="text-muted-foreground hover:text-foreground transition-colors p-2" title="Toggle theme">
                {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button onClick={handleLogout} className="text-muted-foreground hover:text-destructive transition-colors p-2" title="Sign out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-auto bg-muted/20 relative">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/50 px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span className="opacity-60 hidden sm:inline">Aperti</span>
            <span className="opacity-60 hidden sm:inline">/</span>
            <span className="text-foreground">{currentPage}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border/50 shadow-sm bg-background"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Quick search</span>
              <kbd className="hidden sm:inline bg-muted px-1 py-0.5 rounded font-mono text-[9px]">⌘K</kbd>
            </button>
            <NotificationBell />
          </div>
        </div>

        <div className="flex-1 p-6 lg:p-8 max-w-[1400px] mx-auto w-full relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
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