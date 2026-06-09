import { useQuery } from "@tanstack/react-query";
import { fetchJSON } from "@/lib/api";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  CalendarDays, ClipboardList, Users, BookOpen,
  CheckSquare2, ChevronRight, Clock, TrendingUp,
} from "lucide-react";
import { format } from "date-fns";

export default function TeacherMobileHome() {
  const { data, isLoading } = useQuery({
    queryKey: ["mobile-teacher-home"],
    queryFn: () => fetchJSON("/mobile/teacher-home"),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const lessons = data?.todayLessons ?? [];
  const pending = data?.pendingGrading ?? 0;
  const attendance = data?.todayAttendance ?? { present: 0, total: 0 };
  const attendancePct = attendance.total > 0
    ? Math.round((attendance.present / attendance.total) * 100)
    : null;

  return (
    <div className="min-h-screen bg-background pb-20 px-4 pt-4 space-y-5">
      {/* Header */}
      <div>
        <p className="text-xs text-muted-foreground font-medium">
          {format(new Date(), "EEEE, d MMMM yyyy")}
        </p>
        <h1 className="text-xl font-bold text-foreground">Teacher Dashboard</h1>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Today's Lessons",
            value: lessons.length,
            icon: CalendarDays,
            color: "bg-primary/10 text-primary",
          },
          {
            label: "To Grade",
            value: pending,
            icon: ClipboardList,
            color: "bg-orange-50 dark:bg-orange-950/30 text-orange-600",
          },
          {
            label: "Attendance",
            value: attendancePct !== null ? `${attendancePct}%` : "—",
            icon: Users,
            color: "bg-green-50 dark:bg-green-950/30 text-green-600",
          },
        ].map((s) => (
          <div key={s.label} className={`${s.color} rounded-2xl p-3 flex flex-col gap-2`}>
            <s.icon className="w-5 h-5" />
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { href: "/checkin", label: "Mark Attendance", icon: CheckSquare2, primary: true },
          { href: "/grade-flow", label: "Grade Submissions", icon: TrendingUp, primary: false },
          { href: "/teacher-courses", label: "My Courses", icon: BookOpen, primary: false },
          { href: "/teacher/assessments", label: "Assessments", icon: ClipboardList, primary: false },
        ].map((action) => (
          <Link key={action.href} href={action.href}>
            <motion.div
              whileTap={{ scale: 0.96 }}
              className={`rounded-2xl p-4 flex items-center gap-3 min-h-[60px] ${
                action.primary
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border/40 text-foreground"
              }`}
            >
              <action.icon className="w-5 h-5 shrink-0" />
              <span className="text-sm font-semibold">{action.label}</span>
            </motion.div>
          </Link>
        ))}
      </div>

      {/* Today's Schedule */}
      <div className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between border-b border-border/40">
          <h2 className="font-semibold text-sm text-foreground">Today's Schedule</h2>
          <Link href="/plan-grid">
            <span className="text-xs text-primary font-medium">Full plan</span>
          </Link>
        </div>
        {lessons.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">No lessons scheduled for today</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/30">
            {lessons.map((lesson: any, i: number) => (
              <motion.li
                key={lesson.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="px-4 py-3 flex items-center gap-3 min-h-[60px]"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-primary" />
                  {lesson.scheduled_at && (
                    <span className="text-[9px] text-primary font-bold mt-0.5">
                      {format(new Date(lesson.scheduled_at), "HH:mm")}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{lesson.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{lesson.course}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      {/* Attendance Summary */}
      {attendance.total > 0 && (
        <div className="bg-card rounded-2xl border border-border/40 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm text-foreground">Today's Attendance</h2>
            <Link href="/checkin">
              <span className="text-xs text-primary font-medium">Mark now</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-muted/40 rounded-full h-3 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${attendancePct ?? 0}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="h-full bg-primary rounded-full"
              />
            </div>
            <span className="text-sm font-bold text-foreground shrink-0">
              {attendance.present}/{attendance.total}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
