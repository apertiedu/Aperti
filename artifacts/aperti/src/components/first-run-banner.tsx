import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export type UserRole = "teacher" | "student" | "parent" | "admin";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  href?: string;
  action?: string;
  done?: boolean;
}

const CHECKLISTS: Record<UserRole, { welcome: string; subtitle: string; items: ChecklistItem[] }> = {
  teacher: {
    welcome: "Welcome to Aperti",
    subtitle: "Get your classroom running in minutes.",
    items: [
      { id: "profile", label: "Complete your profile", description: "Add a bio and your subjects", href: "/settings/profile", action: "Go to Profile" },
      { id: "course", label: "Create your first course", description: "Set up sessions, subjects, and capacity", href: "/my-courses", action: "Create Course" },
      { id: "student", label: "Invite your first student", description: "Share your enrolment link or import by CSV", href: "/students", action: "Invite Students" },
      { id: "assignment", label: "Publish an assignment", description: "Create homework or a class task", href: "/assessment-hub", action: "Create Assignment" },
      { id: "explore", label: "Explore AI tools", description: "Try SnapGrade, TutorCraft, or ContentCraft", href: "/tutorcraft", action: "Explore AI" },
    ],
  },
  student: {
    welcome: "Welcome to Aperti",
    subtitle: "Your learning journey starts here.",
    items: [
      { id: "profile", label: "Complete your profile", description: "Add a photo and your subjects", href: "/settings/profile", action: "Go to Profile" },
      { id: "course", label: "Join your first course", description: "Enter your enrolment code or browse courses", href: "/my-courses", action: "Browse Courses" },
      { id: "tools", label: "Explore study tools", description: "Try flashcards, revision planner, or AI tutor", href: "/study-stream", action: "Study Tools" },
      { id: "exam", label: "Check your exam schedule", description: "See upcoming tests and deadlines", href: "/assessment-hub", action: "View Exams" },
    ],
  },
  parent: {
    welcome: "Welcome to Aperti",
    subtitle: "Stay close to your child's education.",
    items: [
      { id: "profile", label: "Complete your profile", description: "Add your name and notification preferences", href: "/settings/profile", action: "Go to Profile" },
      { id: "link", label: "Link your child's account", description: "Use a pairing code to connect", href: "/parent/link-child", action: "Link Child" },
      { id: "attendance", label: "Check attendance overview", description: "See sessions attended and missed", href: "/parent/attendance", action: "View Attendance" },
      { id: "grades", label: "Review latest grades", description: "See recent results and progress", href: "/parent/grades", action: "View Grades" },
    ],
  },
  admin: {
    welcome: "Welcome to Aperti Admin",
    subtitle: "Configure your platform and manage your institution.",
    items: [
      { id: "settings", label: "Configure platform settings", description: "Branding, limits, and preferences", href: "/admin/settings", action: "Platform Settings" },
      { id: "teachers", label: "Invite teachers", description: "Send invitations or import by CSV", href: "/admin/teachers", action: "Manage Teachers" },
      { id: "plans", label: "Review subscription plans", description: "Set pricing and feature access", href: "/admin/commerce", action: "Manage Plans" },
      { id: "health", label: "Review platform health", description: "Check system status and AI reliability", href: "/admin/platform-health", action: "Platform Health" },
    ],
  },
};

interface FirstRunBannerProps {
  role: UserRole;
  completedItems?: string[];
  onDismiss?: () => void;
  onItemComplete?: (id: string) => void;
  className?: string;
}

export function FirstRunBanner({ role, completedItems = [], onDismiss, className = "" }: FirstRunBannerProps) {
  const [expanded, setExpanded] = useState(true);
  const config = CHECKLISTS[role];
  const done = config.items.filter(i => completedItems.includes(i.id)).length;
  const total = config.items.length;
  const pct = Math.round((done / total) * 100);
  const allDone = done === total;

  if (allDone) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={`rounded-2xl border border-border bg-card shadow-sm overflow-hidden ${className}`}
      >
        <div
          className="flex items-center justify-between p-4 cursor-pointer select-none"
          onClick={() => setExpanded(e => !e)}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/30 shrink-0">
              <Sparkles size={16} className="text-teal-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">{config.welcome}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{config.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-3">
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-teal-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <span className="text-xs text-muted-foreground font-medium">{done}/{total}</span>
            </div>
            {expanded ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
            {onDismiss && (
              <button
                onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                {config.items.map((item, i) => {
                  const isDone = completedItems.includes(item.id);
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isDone ? "bg-emerald-50/50 dark:bg-emerald-950/10" : "bg-muted/30 hover:bg-muted/50"}`}
                    >
                      <div className="shrink-0">
                        {isDone
                          ? <CheckCircle2 size={18} className="text-emerald-500" />
                          : <Circle size={18} className="text-muted-foreground/40" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium leading-tight ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {item.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                      </div>
                      {!isDone && item.href && (
                        <Link href={item.href}>
                          <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7 shrink-0 text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/30">
                            {item.action}
                            <ArrowRight size={11} />
                          </Button>
                        </Link>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

interface WelcomeHeroProps {
  name?: string;
  role: UserRole;
  onGetStarted?: () => void;
  className?: string;
}

export function WelcomeHero({ name, role, onGetStarted, className = "" }: WelcomeHeroProps) {
  const greetings: Record<UserRole, { title: string; sub: string }> = {
    teacher: { title: `Welcome${name ? `, ${name}` : ""}`, sub: "Your teaching hub is ready. Let's set everything up." },
    student: { title: `Welcome${name ? `, ${name}` : ""} to Aperti`, sub: "Your learning journey starts here. Let's get you set up." },
    parent: { title: `Welcome${name ? `, ${name}` : ""}`, sub: "Track your child's progress, attendance, and grades all in one place." },
    admin: { title: "Platform Ready", sub: "Your Aperti instance is configured and ready for your institution." },
  };
  const g = greetings[role];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`relative rounded-2xl overflow-hidden border border-teal-100 dark:border-teal-900 ${className}`}
      style={{ background: "linear-gradient(135deg, #0D948812 0%, #0ea5e908 50%, transparent 100%)" }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-teal-500/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-teal-300/5 blur-2xl" />
      </div>
      <div className="relative p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-xs text-teal-700 dark:text-teal-400 font-medium mb-3">
              <Sparkles size={11} />
              Getting started
            </div>
            <h2 className="text-2xl font-bold text-foreground leading-tight">{g.title}</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-md">{g.sub}</p>
          </div>
          {onGetStarted && (
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2 shrink-0"
              onClick={onGetStarted}
            >
              Get Started
              <ArrowRight size={15} />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
