import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/context/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, MessageSquare, Calendar, Bell, MoreHorizontal,
  BookOpen, BarChart3, ClipboardList, GraduationCap, Brain,
  AlertTriangle, CreditCard, Settings, LogOut, ChevronRight,
  ChevronLeft, Users, FileText, Bot, Sun, Moon, Folder,
} from "lucide-react";
import { useTheme } from "@/context/theme";
import { io as SocketIO, Socket } from "socket.io-client";
import { useToast } from "@/hooks/use-toast";

const TEAL = "#0D9488";

const authFetch = (url: string, opts?: RequestInit) =>
  fetch(url, {
    ...opts,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(opts?.headers || {}),
    },
  });

const mobileBottomNav = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/parent/messages", label: "Messages", icon: MessageSquare },
  { href: "/parent/meetings", label: "Calendar", icon: Calendar },
  { href: "/parent/notifications", label: "Alerts", icon: Bell },
  { href: "/parent/more", label: "More", icon: MoreHorizontal },
];

const sidebarSections = [
  {
    title: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/parent/notifications", label: "Notifications", icon: Bell },
      { href: "/parent/interventions", label: "Alerts", icon: AlertTriangle },
    ],
  },
  {
    title: "Academic",
    items: [
      { href: "/parent/grades", label: "Grades", icon: BarChart3 },
      { href: "/parent/attendance", label: "Attendance", icon: ClipboardList },
      { href: "/parent/assignments", label: "Assignments", icon: BookOpen },
      { href: "/parent/exams", label: "Exam Readiness", icon: GraduationCap },
      { href: "/parent/revision", label: "Revision", icon: Brain },
    ],
  },
  {
    title: "Communication",
    items: [
      { href: "/parent/messages", label: "Messages", icon: MessageSquare },
      { href: "/parent/meetings", label: "Meetings", icon: Calendar },
    ],
  },
  {
    title: "Schedule & Files",
    items: [
      { href: "/parent/calendar", label: "Family Calendar", icon: Calendar },
      { href: "/parent/documents", label: "Documents", icon: Folder },
    ],
  },
  {
    title: "Reports & Tools",
    items: [
      { href: "/parent/reports", label: "Reports", icon: FileText },
      { href: "/parent/ai-assistant", label: "AI Assistant", icon: Bot },
      { href: "/parent/billing", label: "Billing", icon: CreditCard },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/parent/settings", label: "Settings", icon: Settings },
    ],
  },
];

const allMobileNav = sidebarSections.flatMap(s => s.items);

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { dark, toggleDark } = useTheme();
  const [collapsed, setCollapsedRaw] = useState(() => {
    try { return localStorage.getItem("aperti_sidebar_collapsed") === "1"; } catch { return false; }
  });
  const setCollapsed = (v: boolean) => {
    setCollapsedRaw(v);
    try { localStorage.setItem("aperti_sidebar_collapsed", v ? "1" : "0"); } catch {}
  };
  const [sheetOpen, setSheetOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  // ── Live Socket.IO notifications ─────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    const socket: Socket = SocketIO("/parent", {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join", user.id);
    });

    socket.on("notification", (notif: any) => {
      // Invalidate notification query so badge re-fetches
      qc.invalidateQueries({ queryKey: ["parent-notif-count"] });
      qc.invalidateQueries({ queryKey: ["parent-notifications"] });

      toast({
        title: notif.title || "New notification",
        description: notif.message,
        duration: 5000,
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id]);

  const { data: notifData } = useQuery({
    queryKey: ["parent-notif-count"],
    queryFn: () => authFetch("/api/parent/notifications").then(r => r.json()),
    select: (data: any[]) => data?.filter(n => !n.is_read).length ?? 0,
    refetchInterval: 30000,
  });

  const unreadCount: number = (notifData as any) ?? 0;
  const initials = (user?.displayName || user?.username || "P").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-300 shrink-0 ${collapsed ? "w-14" : "w-56"}`}
        aria-label="Sidebar navigation"
      >
        {/* Logo */}
        <div className={`h-14 flex items-center border-b border-gray-100 dark:border-gray-800 ${collapsed ? "justify-center px-2" : "px-4 gap-2"}`}>
          {!collapsed && (
            <>
              <span className="font-black text-base text-gray-900 dark:text-white">Aperti<span style={{ color: TEAL }}>.</span></span>
              <span className="text-xs text-gray-400 ml-1">Parent</span>
            </>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`ml-auto p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors ${collapsed ? "ml-0" : ""}`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-4 px-2" aria-label="Main navigation">
          {sidebarSections.map(section => (
            <div key={section.title}>
              {!collapsed && (
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 px-2 mb-1">{section.title}</p>
              )}
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const active = location === item.href;
                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        className={`flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all cursor-pointer ${
                          active
                            ? "text-white font-semibold"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                        }`}
                        style={active ? { background: TEAL } : undefined}
                        aria-current={active ? "page" : undefined}
                        title={collapsed ? item.label : undefined}
                      >
                        <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {!collapsed && <span className="text-xs font-medium truncate">{item.label}</span>}
                        {!collapsed && item.label === "Notifications" && unreadCount > 0 && (
                          <span className="ml-auto text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 font-bold">{unreadCount}</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className={`border-t border-gray-100 dark:border-gray-800 p-2 space-y-1`}>
          <button
            onClick={toggleDark}
            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${collapsed ? "justify-center" : ""}`}
            aria-label="Toggle dark mode"
          >
            {dark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
            {!collapsed && <span>{dark ? "Light mode" : "Dark mode"}</span>}
          </button>
          <button
            onClick={logout}
            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors ${collapsed ? "justify-center" : ""}`}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 h-12 flex items-center px-4 justify-between shrink-0">
          <span className="font-black text-base text-gray-900 dark:text-white">Aperti<span style={{ color: TEAL }}>.</span></span>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Link href="/parent/notifications">
                <div className="relative">
                  <Bell className="h-5 w-5 text-gray-500" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">{unreadCount}</span>
                </div>
              </Link>
            )}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
              style={{ background: TEAL }}
            >
              {initials}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto pb-16 md:pb-0" id="main-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 z-50"
        aria-label="Mobile navigation"
      >
        <div className="flex justify-around items-center h-14 max-w-lg mx-auto px-1">
          {mobileBottomNav.map((item) => {
            if (item.href === "/parent/more") {
              return (
                <Sheet key="more" open={sheetOpen} onOpenChange={setSheetOpen}>
                  <SheetTrigger asChild>
                    <button
                      className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-gray-400 rounded-lg"
                      aria-label="More options"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                      <span className="text-[9px] font-medium">More</span>
                    </button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-[75vh]">
                    <SheetHeader>
                      <SheetTitle className="text-left text-sm">All Sections</SheetTitle>
                    </SheetHeader>
                    <nav className="mt-3 grid grid-cols-3 gap-2 overflow-y-auto pb-6">
                      {allMobileNav.map(item => {
                        const active = location === item.href;
                        return (
                          <Link key={item.href} href={item.href} onClick={() => setSheetOpen(false)}>
                            <div
                              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-colors ${
                                active ? "border-teal-200 bg-teal-50 text-teal-700" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                              }`}
                            >
                              <item.icon className="h-5 w-5" />
                              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </nav>
                    <button onClick={() => { logout(); setSheetOpen(false); }} className="w-full flex items-center justify-center gap-2 mt-2 p-3 rounded-xl border border-red-100 text-red-500 text-sm">
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </SheetContent>
                </Sheet>
              );
            }

            const active = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <button
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors relative ${
                    active ? "text-teal-600" : "text-gray-400"
                  }`}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                >
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                  <span className="text-[9px] font-medium">{item.label}</span>
                  {item.label === "Alerts" && unreadCount > 0 && (
                    <span className="absolute -top-0.5 right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">{unreadCount}</span>
                  )}
                </button>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
