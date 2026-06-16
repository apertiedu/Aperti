import { useQuery } from "@tanstack/react-query";
import { fetchJSON } from "@/lib/api";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  CheckSquare2, Clock, Target, Brain, ChevronRight,
  CalendarDays, Flame, BookOpen, Bell,
} from "lucide-react";
import { formatDistanceToNow, isPast } from "date-fns";

function ProgressRing({ value, max, size = 80, stroke = 8 }: { value: number; max: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const fill = max > 0 ? (value / max) * circ : 0;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted/20" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="currentColor" strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ - fill}
        strokeLinecap="round" className="text-primary transition-all duration-700"
      />
    </svg>
  );
}

export default function StudentMobileHome() {
  const { data, isLoading } = useQuery({
    queryKey: ["mobile-student-home"],
    queryFn: () => fetchJSON("/mobile/student-home"),
  });

  const tasks = data?.todayTasks ?? [];
  const assessments = data?.upcomingAssessments ?? [];
  const notifications = data?.notifications ?? [];
  const goals = data?.goals ?? [];
  const unread = notifications.filter((n: any) => !n.is_read).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 px-4 pt-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium">Good morning 👋</p>
          <h1 className="text-xl font-bold text-foreground">Today's Plan</h1>
        </div>
        <div className="relative">
          <Link href="/notifications">
            <button className="w-11 h-11 rounded-full bg-muted/60 flex items-center justify-center min-h-[44px] min-w-[44px]">
              <Bell className="w-5 h-5 text-muted-foreground" />
            </button>
          </Link>
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </div>
      </div>

      {/* Revision Progress + Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1 bg-card rounded-2xl p-3 flex flex-col items-center justify-center border border-border/40 shadow-sm">
          <div className="relative">
            <ProgressRing value={goals[0]?.current_value ?? 0} max={goals[0]?.target_value ?? 100} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">
                {goals[0]?.target_value ? Math.round(((goals[0]?.current_value ?? 0) / goals[0].target_value) * 100) : 0}%
              </span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center leading-tight">Revision Goal</p>
        </div>
        <div className="col-span-2 grid grid-rows-2 gap-3">
          <div className="bg-primary/10 rounded-2xl p-3 flex items-center gap-3">
            <CheckSquare2 className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-lg font-bold text-foreground">{tasks.length}</p>
              <p className="text-[10px] text-muted-foreground">Tasks due</p>
            </div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-950/30 rounded-2xl p-3 flex items-center gap-3 border border-orange-100 dark:border-orange-900/40">
            <CalendarDays className="w-5 h-5 text-orange-500 shrink-0" />
            <div>
              <p className="text-lg font-bold text-foreground">{assessments.length}</p>
              <p className="text-[10px] text-muted-foreground">Upcoming exams</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { href: "/practice", icon: Brain, label: "Quick Practice", color: "bg-primary/8 dark:bg-primary/95/30 text-primary dark:text-primary/60" },
          { href: "/flashcards", icon: Flame, label: "Flashcards", color: "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300" },
          { href: "/mentor", icon: Target, label: "Ask Mentor", color: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300" },
          { href: "/revision-notes", icon: BookOpen, label: "My Notes", color: "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300" },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <motion.div
              whileTap={{ scale: 0.96 }}
              className={`${item.color} rounded-2xl p-4 flex items-center gap-3 min-h-[60px]`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="text-sm font-semibold">{item.label}</span>
            </motion.div>
          </Link>
        ))}
      </div>

      {/* Today's Tasks */}
      {tasks.length > 0 && (
        <div className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-border/40">
            <h2 className="font-semibold text-sm text-foreground">Today's Tasks</h2>
            <Link href="/my-homework">
              <span className="text-xs text-primary font-medium">See all</span>
            </Link>
          </div>
          <ul className="divide-y divide-border/30">
            {tasks.map((task: any, i: number) => (
              <motion.li
                key={task.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="px-4 py-3 flex items-center gap-3 min-h-[52px]"
              >
                <div className={`w-5 h-5 rounded-full border-2 shrink-0 ${
                  task.status === "submitted" ? "border-primary bg-primary" : "border-muted-foreground/40"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                  <p className="text-[11px] text-muted-foreground">{task.subject}</p>
                </div>
                {task.due_date && (
                  <span className={`text-[10px] font-semibold shrink-0 ${
                    isPast(new Date(task.due_date)) ? "text-red-500" : "text-muted-foreground"
                  }`}>
                    {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
                  </span>
                )}
              </motion.li>
            ))}
          </ul>
        </div>
      )}

      {/* Upcoming Assessments */}
      {assessments.length > 0 && (
        <div className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40">
            <h2 className="font-semibold text-sm text-foreground">Upcoming Assessments</h2>
          </div>
          <ul className="divide-y divide-border/30">
            {assessments.map((a: any) => (
              <li key={a.id} className="px-4 py-3 flex items-center gap-3 min-h-[52px]">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {a.date ? formatDistanceToNow(new Date(a.date), { addSuffix: true }) : "Date TBD"}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {tasks.length === 0 && assessments.length === 0 && (
        <div className="bg-card rounded-2xl border border-border/40 shadow-sm p-8 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Flame className="w-7 h-7 text-primary" />
          </div>
          <p className="font-semibold text-foreground">All caught up!</p>
          <p className="text-sm text-muted-foreground">No pending tasks. Start a practice session to stay sharp.</p>
          <Link href="/practice">
            <button className="mt-1 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold min-h-[44px]">
              Start Practice
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
