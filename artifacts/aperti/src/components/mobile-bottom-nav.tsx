import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/auth";
import {
  Home, BookOpen, Brain, Layers, User,
  LayoutDashboard, Users, CheckSquare2, BarChart3,
  MessageSquare, FileText, Bell, Settings,
  DollarSign, UserCheck,
} from "lucide-react";
import { motion } from "framer-motion";

interface NavTab {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STUDENT_TABS: NavTab[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/course-hub", label: "Courses", icon: BookOpen },
  { href: "/practice", label: "Practice", icon: Brain },
  { href: "/revision-notes", label: "Notes", icon: Layers },
  { href: "/settings", label: "Profile", icon: User },
];

const TEACHER_TABS: NavTab[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/teacher-courses", label: "Courses", icon: BookOpen },
  { href: "/checkin", label: "Students", icon: Users },
  { href: "/teacher/assessments", label: "Assess", icon: CheckSquare2 },
  { href: "/settings", label: "Profile", icon: User },
];

const PARENT_TABS: NavTab[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/parent/grades", label: "Grades", icon: BarChart3 },
  { href: "/parent/messages", label: "Messages", icon: MessageSquare },
  { href: "/parent/reports", label: "Reports", icon: FileText },
  { href: "/parent/settings", label: "Profile", icon: User },
];

const ADMIN_TABS: NavTab[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/os", label: "Users", icon: Users },
  { href: "/admin/commerce", label: "Payments", icon: DollarSign },
  { href: "/admin/teacher-verification", label: "Verify", icon: UserCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function MobileBottomNav() {
  const { user } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  const tabs: NavTab[] =
    user.role === "student" ? STUDENT_TABS
    : user.role === "parent" ? PARENT_TABS
    : user.role === "admin" ? ADMIN_TABS
    : TEACHER_TABS;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border/60 safe-area-inset-bottom">
      <div className="flex items-stretch h-16">
        {tabs.map((tab) => {
          const isActive =
            location === tab.href ||
            (tab.href !== "/" && location.startsWith(tab.href));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-1 relative min-h-[44px]"
            >
              {isActive && (
                <motion.div
                  layoutId="mobile-tab-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-b-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <tab.icon
                className={`w-5 h-5 transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              />
              <span
                className={`text-[10px] font-medium leading-none transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
