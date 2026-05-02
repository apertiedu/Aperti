import { useLocation, Link } from "wouter";
import {
  LayoutDashboard, CheckSquare, Users, CalendarClock, FileBarChart,
  School, LogOut, Shield, BookOpen, ClipboardList, BarChart3, Settings,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [collapsed, setCollapsed] = useState(false);

  const isAdmin = user?.role === "admin";
  const isAssistant = user?.role === "assistant";

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["admin", "teacher", "assistant"] },
    { name: "Mark Attendance", href: "/attendance", icon: CheckSquare, roles: ["admin", "teacher", "assistant"] },
    { name: "Students", href: "/students", icon: Users, roles: ["admin", "teacher", "assistant"] },
    { name: "Sessions", href: "/sessions", icon: CalendarClock, roles: ["admin", "teacher"] },
    { name: "Subjects", href: "/subjects", icon: BookOpen, roles: ["admin", "teacher"] },
    { name: "Exams & Marks", href: "/exams", icon: ClipboardList, roles: ["admin", "teacher", "assistant"] },
    { name: "Analytics", href: "/analytics", icon: BarChart3, roles: ["admin", "teacher"] },
    { name: "Reports", href: "/reports", icon: FileBarChart, roles: ["admin", "teacher"] },
    { name: "Admin Panel", href: "/admin", icon: Shield, roles: ["admin"] },
  ].filter(item => !user || (item.roles as string[]).includes(user.role));

  const handleLogout = async () => {
    await logout();
    toast({ title: "Signed out" });
  };

  const roleBadgeColor = {
    admin: "bg-purple-100 text-purple-700",
    teacher: "bg-blue-100 text-blue-700",
    assistant: "bg-green-100 text-green-700",
  }[user?.role ?? "assistant"] ?? "bg-muted text-muted-foreground";

  return (
    <div className="min-h-screen flex w-full bg-background font-sans">
      <div className={`${collapsed ? "w-16" : "w-64"} bg-card border-r border-border flex flex-col h-screen sticky top-0 transition-all duration-200`}>
        {/* Logo */}
        <div className={`p-4 border-b border-border flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-3`}>
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground flex-shrink-0">
                <School className="w-4 h-4" />
              </div>
              <div>
                <h1 className="font-bold text-base tracking-tight text-foreground leading-none">Aperti</h1>
                <p className="text-[10px] text-muted-foreground mt-0.5">Education Platform</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <School className="w-4 h-4" />
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                } ${collapsed ? "justify-center" : ""}`}
                title={collapsed ? item.name : undefined}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom user section */}
        {!collapsed && (
          <div className="p-3 border-t border-border space-y-2">
            <div className="px-3 py-2 rounded-lg bg-muted/50">
              <p className="text-xs font-medium text-foreground truncate">{user?.displayName || user?.username}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${roleBadgeColor}`}>
                  {user?.role}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">@{user?.username}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs h-8"
              onClick={handleLogout}
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </Button>
          </div>
        )}
        {collapsed && (
          <div className="p-3 border-t border-border">
            <button onClick={handleLogout} className="w-full flex justify-center text-muted-foreground hover:text-destructive transition-colors p-2" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <main className="flex-1 flex flex-col min-h-screen overflow-auto">
        <div className="flex-1 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
