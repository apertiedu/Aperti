import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Home, BookOpen, BarChart3, MessageSquare, User } from "lucide-react";
import { useAuth } from "@/context/auth";

interface NavItem {
  href: string;
  icon: any;
  label: string;
}

const TEACHER_ITEMS: NavItem[] = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/students", icon: User, label: "Students" },
  { href: "/gradebook", icon: BarChart3, label: "Grades" },
  { href: "/messages", icon: MessageSquare, label: "Inbox" },
  { href: "/my-courses", icon: BookOpen, label: "Courses" },
];

const STUDENT_ITEMS: NavItem[] = [
  { href: "/portal", icon: Home, label: "Home" },
  { href: "/portal/revisit", icon: BookOpen, label: "Revise" },
  { href: "/portal/flashcards", icon: BarChart3, label: "Cards" },
  { href: "/messages", icon: MessageSquare, label: "Inbox" },
  { href: "/portal/recordings", icon: User, label: "More" },
];

const PARENT_ITEMS: NavItem[] = [
  { href: "/parent", icon: Home, label: "Home" },
  { href: "/parent/grades", icon: BarChart3, label: "Grades" },
  { href: "/parent/attendance", icon: BookOpen, label: "Attendance" },
  { href: "/parent/meetings", icon: MessageSquare, label: "Meetings" },
  { href: "/parent/reports", icon: User, label: "Reports" },
];

export default function MobileNavBar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const items: NavItem[] =
    user?.role === "student" ? STUDENT_ITEMS :
    user?.role === "parent" ? PARENT_ITEMS :
    TEACHER_ITEMS;

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    if (href === "/portal") return location === "/portal" || location === "/portal/";
    return location.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border safe-area-bottom md:hidden">
      <div className="flex items-center justify-around px-2 py-1">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <motion.button
                whileTap={{ scale: 0.9 }}
                className={`flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] px-3 py-2 rounded-xl transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all ${
                  active ? "bg-primary/8" : ""
                }`}>
                  <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                </div>
                <span className={`text-[10px] font-semibold leading-none ${active ? "text-primary" : "text-muted-foreground"}`}>
                  {item.label}
                </span>
                {active && (
                  <motion.div
                    layoutId="mobile-nav-indicator"
                    className="absolute bottom-1 w-1 h-1 rounded-full bg-primary"
                    style={{ bottom: 2 }}
                  />
                )}
              </motion.button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
