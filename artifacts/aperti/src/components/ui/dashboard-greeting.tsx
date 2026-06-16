import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface DashboardGreetingProps {
  name?: string;
  role?: string;
  subtitle?: string;
  className?: string;
  compact?: boolean;
}

function getGreeting(): { text: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour >= 5  && hour < 12) return { text: "Good morning",   emoji: "🌅" };
  if (hour >= 12 && hour < 17) return { text: "Good afternoon", emoji: "☀️" };
  if (hour >= 17 && hour < 21) return { text: "Good evening",   emoji: "🌆" };
  return { text: "Good night", emoji: "🌙" };
}

function getContextualMessage(role?: string): string {
  const hour = new Date().getHours();
  const day = new Date().getDay();
  const isWeekend = day === 0 || day === 6;
  const isMonday  = day === 1;
  const isFriday  = day === 5;

  if (role === "student") {
    if (isMonday)  return "Fresh week, fresh start. Check your assignments.";
    if (isFriday)  return "Almost the weekend — stay focused.";
    if (isWeekend) return "Weekend catch-up session? You're dedicated.";
    if (hour < 9)  return "Early start — great for focused study.";
    if (hour > 20) return "Late-night session? Don't forget to rest.";
    return "Ready to keep learning?";
  }

  if (role === "teacher") {
    if (isMonday)  return "New week — let's check your class progress.";
    if (isFriday)  return "Review week highlights before the weekend.";
    if (isWeekend) return "Preparing ahead? That's dedication.";
    if (hour < 9)  return "Early planner — your students are lucky.";
    return "Your dashboard is up to date.";
  }

  if (role === "parent") {
    if (isMonday)  return "Check how your child's week is starting.";
    if (isFriday)  return "See how the week wrapped up.";
    return "Stay informed about your child's progress.";
  }

  return "Platform activity is up to date.";
}

function getDayLabel(): string {
  return new Date().toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" });
}

export function DashboardGreeting({ name, role, subtitle, className, compact = false }: DashboardGreetingProps) {
  const { text } = getGreeting();
  const message  = subtitle ?? getContextualMessage(role);
  const dayLabel = getDayLabel();

  if (compact) {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
        className={cn("flex flex-col", className)}>
        <h1 className="text-lg font-bold text-gray-900">
          {text}{name ? `, ${name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-xs text-gray-400">{dayLabel}</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={cn("space-y-0.5", className)}>
      <div className="flex items-baseline gap-2">
        <h1 className="text-2xl font-bold text-gray-900">
          {text}{name ? `, ${name.split(" ")[0]}` : ""}
        </h1>
      </div>
      <p className="text-sm text-gray-400">{dayLabel} · {message}</p>
    </motion.div>
  );
}

interface QuickActionsBarProps {
  actions: Array<{
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    variant?: "primary" | "secondary";
  }>;
  className?: string;
}

export function QuickActionsBar({ actions, className }: QuickActionsBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.08 }}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {actions.map((action, i) => (
        <motion.button
          key={i}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          onClick={action.onClick}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
            action.variant === "primary"
              ? "bg-primary text-primary-foreground hover:opacity-90"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          )}
        >
          {action.icon}
          {action.label}
        </motion.button>
      ))}
    </motion.div>
  );
}
