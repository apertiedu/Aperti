import { motion } from "framer-motion";
import { Link } from "wouter";
import { AlertTriangle, TrendingDown, TrendingUp, CheckCircle2, Calendar, Users, BookOpen, Lightbulb, ChevronRight } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";

interface Summary { totalStudents: number; attendanceRate: number; presentToday: number; absentStudents: number }
interface AtRiskStudent { id: number; studentName: string; attendanceRate: number }
interface UpcomingExam { id: number; name: string; examDate: string; subjectName: string }
interface TodaySession { id: number; subjectName: string; studentCount: number; presentToday: number }

interface Props {
  summary: Summary | null;
  atRisk: AtRiskStudent[];
  upcomingExams: UpcomingExam[];
  todaySessions: TodaySession[];
}

interface Insight {
  id: string;
  icon: any;
  priority: "critical" | "warning" | "positive" | "info";
  message: string;
  action?: string;
  href?: string;
}

function buildInsights({ summary, atRisk, upcomingExams, todaySessions }: Props): Insight[] {
  const insights: Insight[] = [];

  if (!summary) return insights;

  const rate = summary.attendanceRate;
  const examsThisWeek = upcomingExams.filter(e => differenceInDays(parseISO(e.examDate), new Date()) <= 7);
  const examsIn3Days = upcomingExams.filter(e => differenceInDays(parseISO(e.examDate), new Date()) <= 3);
  const lowAttendanceSessions = todaySessions.filter(s => s.studentCount > 0 && (s.presentToday / s.studentCount) < 0.6);
  const criticalRisk = atRisk.filter(s => Number(s.attendanceRate) < 50);
  const highRisk = atRisk.filter(s => Number(s.attendanceRate) >= 50 && Number(s.attendanceRate) < 65);

  if (rate < 70) {
    insights.push({
      id: "att-critical", icon: TrendingDown, priority: "critical",
      message: `Attendance at ${rate}% — significantly below target. Immediate parent outreach recommended.`,
      action: "View report", href: "/reports",
    });
  } else if (rate < 80) {
    insights.push({
      id: "att-low", icon: AlertTriangle, priority: "warning",
      message: `Attendance at ${rate}% — below the 80% threshold. Consider contacting at-risk families.`,
      action: "See analytics", href: "/analytics",
    });
  } else if (rate >= 90) {
    insights.push({
      id: "att-great", icon: TrendingUp, priority: "positive",
      message: `Excellent! Attendance is at ${rate}% — your students are showing up consistently.`,
    });
  }

  if (criticalRisk.length > 0) {
    insights.push({
      id: "risk-critical", icon: AlertTriangle, priority: "critical",
      message: `${criticalRisk.length} student${criticalRisk.length > 1 ? "s are" : " is"} below 50% attendance. Urgent intervention needed.`,
      action: "View students", href: "/students",
    });
  } else if (highRisk.length > 0) {
    insights.push({
      id: "risk-high", icon: Users, priority: "warning",
      message: `${highRisk.length} student${highRisk.length > 1 ? "s" : ""} between 50–65% attendance. Consider a check-in conversation.`,
      action: "View students", href: "/students",
    });
  }

  if (examsIn3Days.length > 0) {
    insights.push({
      id: "exam-soon", icon: Calendar, priority: "warning",
      message: `${examsIn3Days[0].name} (${examsIn3Days[0].subjectName}) is in ${differenceInDays(parseISO(examsIn3Days[0].examDate), new Date())} day${differenceInDays(parseISO(examsIn3Days[0].examDate), new Date()) !== 1 ? "s" : ""}. Confirm revision is complete.`,
      action: "View exams", href: "/exams",
    });
  } else if (examsThisWeek.length > 0) {
    insights.push({
      id: "exam-week", icon: BookOpen, priority: "info",
      message: `${examsThisWeek.length} exam${examsThisWeek.length > 1 ? "s" : ""} scheduled this week. Ensure materials are prepared.`,
      action: "View exams", href: "/exams",
    });
  }

  if (lowAttendanceSessions.length > 0) {
    insights.push({
      id: "session-low", icon: AlertTriangle, priority: "warning",
      message: `${lowAttendanceSessions[0].subjectName} has low turnout today (${Math.round((lowAttendanceSessions[0].presentToday / lowAttendanceSessions[0].studentCount) * 100)}% present). Consider following up.`,
      action: "Mark attendance", href: "/attendance",
    });
  }

  if (atRisk.length === 0 && rate >= 85 && upcomingExams.length === 0) {
    insights.push({
      id: "all-good", icon: CheckCircle2, priority: "positive",
      message: "Everything looks great — no at-risk students, strong attendance, and no imminent exams.",
    });
  }

  if (summary.totalStudents === 0) {
    insights.push({
      id: "no-students", icon: Lightbulb, priority: "info",
      message: "Add your first students to unlock attendance tracking, analytics, and more.",
      action: "Add students", href: "/students",
    });
  }

  return insights.slice(0, 4);
}

const PRIORITY_STYLES = {
  critical: { border: "border-red-200", bg: "bg-red-50", icon: "text-red-500", text: "text-red-800", subtext: "text-red-600", action: "text-red-700 hover:text-red-900" },
  warning:  { border: "border-amber-200", bg: "bg-amber-50", icon: "text-amber-500", text: "text-amber-800", subtext: "text-amber-600", action: "text-amber-700 hover:text-amber-900" },
  positive: { border: "border-emerald-200", bg: "bg-emerald-50", icon: "text-emerald-500", text: "text-emerald-800", subtext: "text-emerald-600", action: "text-emerald-700 hover:text-emerald-900" },
  info:     { border: "border-blue-200", bg: "bg-blue-50", icon: "text-blue-500", text: "text-blue-800", subtext: "text-blue-600", action: "text-blue-700 hover:text-blue-900" },
};

export default function ActionableInsights(props: Props) {
  const insights = buildInsights(props);
  if (insights.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.4 }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Insights</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
        {insights.map((insight, i) => {
          const styles = PRIORITY_STYLES[insight.priority];
          const Icon = insight.icon;
          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 + i * 0.05 }}
              className={`flex items-start gap-3 p-3.5 rounded-xl border ${styles.border} ${styles.bg}`}
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${styles.icon}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold leading-snug ${styles.text}`}>{insight.message}</p>
                {insight.action && insight.href && (
                  <Link href={insight.href}>
                    <span className={`mt-1.5 flex items-center gap-1 text-[11px] font-bold cursor-pointer ${styles.action}`}>
                      {insight.action} <ChevronRight className="w-2.5 h-2.5" />
                    </span>
                  </Link>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
