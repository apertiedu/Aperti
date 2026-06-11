import { apiFetch } from "@/lib/api";
import { useState, useEffect } from "react";
import {
  Users, UserCheck, UserX, TrendingUp, BarChart3, Scan, Calendar,
  ArrowRight, Clock, ClipboardList, AlertTriangle, Wifi, Building2,
  BookOpen, ChevronRight, ExternalLink, Zap, Target, GraduationCap,
  CheckCircle2, Circle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays, parseISO } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useAuth } from "@/context/auth";
import { Link } from "wouter";
import { motion } from "framer-motion";
import ActionableInsights from "@/components/actionable-insights";
import TrustStatusBar from "@/components/trust-status-bar";
import TeacherDailyFocus from "@/components/teacher-daily-focus";
import PlanStatusStrip from "@/components/plan-status-strip";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Summary = { totalStudents: number; attendanceRate: number; presentToday: number; absentStudents: number; totalSessions: number };
type Activity = { id: number; studentName: string; studentCode: string; lessonNumber: number; status: string; markedAt: string };
type WeeklyStats = { byLesson: { lessonNumber: number; present: number; absent: number }[] };
type TodaySession = { id: number; lessonNumber: number; dayOfWeek: string; startTime: string; type: string; capacity: number | null; onlineLink: string | null; subjectName: string; studentCount: number; presentToday: number };
type UpcomingExam = { id: number; name: string; examDate: string; totalMarks: number; timeLimitMinutes: number | null; subjectName: string; questionCount: number };
type AtRiskStudent = { id: number; studentName: string; studentCode: string; totalSessions: number; presentCount: number; attendanceRate: number };

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const fadeUp = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 280, damping: 24 } } } as any;

function AnimatedCounter({ value, duration = 1 }: { value: number | string; duration?: number }) {
  const [count, setCount] = useState(0);
  const isPercent = typeof value === "string" && value.endsWith("%");
  const target = typeof value === "string" ? parseFloat(value) : value;
  useEffect(() => {
    let frame = 0;
    const total = Math.round(duration * 60);
    const t = setInterval(() => {
      frame++;
      const p = frame / total;
      const ease = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setCount(Math.round(target * ease));
      if (frame === total) { clearInterval(t); setCount(target); }
    }, 1000 / 60);
    return () => clearInterval(t);
  }, [target, duration]);
  return <span>{count}{isPercent ? "%" : ""}</span>;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function ExamCountdown({ examDate }: { examDate: string }) {
  const days = differenceInDays(parseISO(examDate), new Date());
  if (days === 0) return <Badge className="bg-red-500 text-white text-xs">Today</Badge>;
  if (days === 1) return <Badge className="bg-orange-500 text-white text-xs">Tomorrow</Badge>;
  if (days <= 3) return <Badge className="bg-amber-500 text-white text-xs">{days}d</Badge>;
  return <Badge variant="secondary" className="text-xs">{days}d</Badge>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([]);
  const [upcomingExams, setUpcomingExams] = useState<UpcomingExam[]>([]);
  const [atRisk, setAtRisk] = useState<AtRiskStudent[]>([]);

  const [loading, setLoading] = useState({ summary: true, activity: true, stats: true, today: true, exams: true, risk: true });
  const setDone = (k: keyof typeof loading) => setLoading(l => ({ ...l, [k]: false }));

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const today = DAY_NAMES[new Date().getDay()];
  const dateStr = format(new Date(), "EEEE, dd MMMM yyyy");

  useEffect(() => {
    apiFetch("/api/dashboard/summary", { credentials: "include" })
      .then(r => r.ok ? r.json() : null).then(d => { setSummary(d); setDone("summary"); });
    apiFetch("/api/dashboard/recent-activity?limit=8", { credentials: "include" })
      .then(r => r.ok ? r.json() : []).then(d => { setRecentActivity(d); setDone("activity"); });
    apiFetch(`/api/dashboard/weekly-stats?weekStart=${weekStartStr}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null).then(d => { setWeeklyStats(d); setDone("stats"); });
    apiFetch("/api/dashboard/today-sessions", { credentials: "include" })
      .then(r => r.ok ? r.json() : []).then(d => { setTodaySessions(d); setDone("today"); });
    apiFetch("/api/dashboard/upcoming-exams", { credentials: "include" })
      .then(r => r.ok ? r.json() : []).then(d => { setUpcomingExams(d); setDone("exams"); });
    apiFetch("/api/dashboard/at-risk", { credentials: "include" })
      .then(r => r.ok ? r.json() : []).then(d => { setAtRisk(d); setDone("risk"); });
  }, [weekStartStr]);

  const kpis = [
    { title: "Total Students", value: summary?.totalStudents ?? 0, icon: Users, color: "text-blue-600", bg: "bg-blue-100/60 dark:bg-blue-900/30", border: "border-blue-200 dark:border-blue-800/50" },
    { title: "Attendance Rate", value: `${summary?.attendanceRate ?? 0}%`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-100/60 dark:bg-emerald-900/30", border: "border-emerald-200 dark:border-emerald-800/50" },
    { title: "Present Today", value: summary?.presentToday ?? 0, icon: UserCheck, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
    { title: "Total Absences", value: summary?.absentStudents ?? 0, icon: UserX, color: "text-red-600", bg: "bg-red-100/60 dark:bg-red-900/30", border: "border-red-200 dark:border-red-800/50" },
  ];

  const chartData = weeklyStats?.byLesson.map(l => ({
    name: `L${l.lessonNumber}`, Present: l.present, Absent: l.absent,
  })) ?? [];

  const quickActions = [
    { href: "/attendance", label: "Mark Attendance", icon: Scan, color: "from-primary to-indigo-600" },
    { href: "/students", label: "Students", icon: Users, color: "from-blue-500 to-blue-700" },
    { href: "/exams", label: "Exams & Marks", icon: ClipboardList, color: "from-violet-500 to-purple-700" },
    { href: "/analytics", label: "Analytics", icon: BarChart3, color: "from-emerald-500 to-teal-600" },
  ];

  const attendanceWarning = (summary?.attendanceRate ?? 100) < 80;

  return (
    <div className="space-y-6 pb-8">

      {/* ── Trust Status Bar ── */}
      <TrustStatusBar />

      {/* ── Hero greeting ── */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            {getGreeting()}, {user?.displayName?.split(" ")[0] ?? user?.username} 👋
          </h1>
          <p className="text-muted-foreground mt-1.5 flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4" /> {dateStr}
          </p>
        </div>
        {attendanceWarning && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-semibold text-red-700 dark:text-red-400">Attendance below 80%</span>
          </motion.div>
        )}
      </motion.div>

      {/* ── Plan status strip (shows only when near limit or expiry) ── */}
      <PlanStatusStrip />

      {/* ── Teacher Daily Focus (teachers only) ── */}
      {(user?.role === "teacher" || user?.role === "assistant") && (
        <TeacherDailyFocus />
      )}

      {/* ── Quick actions ── */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickActions.map(qa => (
          <motion.div key={qa.href} variants={fadeUp}>
            <Link href={qa.href}>
              <div className={`bg-gradient-to-br ${qa.color} text-white rounded-2xl p-4 cursor-pointer hover:opacity-90 hover:-translate-y-0.5 transition-all shadow-sm group flex items-center gap-3`}>
                <div className="bg-white/20 rounded-xl p-2 group-hover:scale-110 transition-transform">
                  <qa.icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold leading-tight">{qa.label}</span>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {/* ── KPI cards ── */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading.summary ? (
          [...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)
        ) : (
          kpis.map((k, i) => (
            <motion.div key={i} variants={fadeUp}>
              <Card className={`border ${k.border} shadow-sm hover:shadow-md transition-shadow`}>
                <CardContent className="p-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{k.title}</p>
                    <p className={`text-3xl font-black ${k.color}`}><AnimatedCounter value={k.value} /></p>
                  </div>
                  <div className={`${k.bg} p-3 rounded-xl shrink-0`}>
                    <k.icon className={`w-5 h-5 ${k.color}`} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </motion.div>

      {/* ── Actionable Insights ── */}
      {!loading.summary && !loading.risk && !loading.exams && (
        <ActionableInsights
          summary={summary}
          atRisk={atRisk}
          upcomingExams={upcomingExams}
          todaySessions={todaySessions}
        />
      )}

      {/* ── Today's Schedule ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <div className="bg-primary/10 p-1.5 rounded-lg"><Clock className="w-4 h-4 text-primary" /></div>
              Today's Schedule
              <Badge variant="secondary" className="ml-1 text-xs">{today}</Badge>
            </CardTitle>
            <Link href="/timetable">
              <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground hover:text-foreground">
                Full timetable <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {loading.today ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
            ) : todaySessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <div className="bg-muted p-3 rounded-full mb-3"><Clock className="w-5 h-5 opacity-40" /></div>
                <p className="text-sm font-medium">No sessions scheduled for today</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {todaySessions.map((s, i) => {
                  const attended = s.studentCount > 0 ? Math.round((s.presentToday / s.studentCount) * 100) : 0;
                  return (
                    <motion.div key={s.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                      <div className="border border-border rounded-xl p-3.5 hover:border-primary/30 hover:bg-muted/30 transition-all group">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-sm font-bold text-foreground">{s.subjectName}</p>
                            <p className="text-xs text-muted-foreground">Lesson {s.lessonNumber}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {s.type === "online" ? (
                              <span className="flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                                <Wifi className="w-3 h-3" /> Online
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">
                                <Building2 className="w-3 h-3" /> Centre
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.startTime}</span>
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{s.studentCount}</span>
                          </div>
                          {s.studentCount > 0 && (
                            <span className={`text-xs font-bold ${attended >= 75 ? "text-emerald-600" : attended >= 50 ? "text-amber-600" : "text-red-600"}`}>
                              {attended}% here
                            </span>
                          )}
                        </div>
                        {s.type === "online" && s.onlineLink && (
                          <a href={s.onlineLink} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline font-medium" onClick={e => e.stopPropagation()}>
                            <ExternalLink className="w-3 h-3" /> Join link
                          </a>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Charts + Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-2">
          <Card className="border-border/60 shadow-sm h-full flex flex-col">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1.5 rounded-lg"><BarChart3 className="w-4 h-4 text-emerald-600" /></div>
                This Week's Attendance
              </CardTitle>
              <Link href="/attendance">
                <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground hover:text-foreground">
                  View <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="flex-1 min-h-[240px] pt-2">
              {loading.stats ? (
                <div className="h-full skeleton rounded-xl" />
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{ top: 6, right: 6, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontWeight: 600 }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} allowDecimals={false} />
                    <Tooltip cursor={{ fill: "hsl(var(--muted)/0.4)" }} contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 24px rgb(0 0 0/0.08)", fontWeight: 500, fontSize: 13 }} />
                    <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "13px", fontWeight: 600 }} />
                    <Bar dataKey="Present" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={36} animationDuration={1200} />
                    <Bar dataKey="Absent" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} maxBarSize={36} animationDuration={1200} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[240px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl gap-2">
                  <BarChart3 className="w-8 h-8 opacity-20" />
                  <p className="text-sm font-medium">No attendance data this week</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activity */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="border-border/60 shadow-sm h-full flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <div className="bg-muted p-1.5 rounded-lg"><Zap className="w-4 h-4 text-muted-foreground" /></div>
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto max-h-[260px] custom-scrollbar p-2">
              {loading.activity ? (
                <div className="space-y-2 p-2">{[...Array(5)].map((_, i) => <div key={i} className="h-11 skeleton rounded-lg" />)}</div>
              ) : recentActivity.length > 0 ? (
                <div className="space-y-0.5">
                  {recentActivity.map((a, i) => (
                    <motion.div key={a.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.04 }}
                      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${a.status === "Present" ? "bg-emerald-500" : "bg-red-500"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{a.studentName}</p>
                        <p className="text-xs text-muted-foreground">{a.studentCode} · L{a.lessonNumber}</p>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground shrink-0">{format(new Date(a.markedAt), "HH:mm")}</span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-center gap-2">
                  <div className="bg-muted p-3 rounded-full"><Clock className="w-5 h-5 opacity-30" /></div>
                  <p className="text-sm font-medium">No activity yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Upcoming Exams + At-Risk Students ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Upcoming Exams */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <Card className="border-border/60 shadow-sm h-full flex flex-col">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <div className="bg-violet-100 dark:bg-violet-900/30 p-1.5 rounded-lg"><GraduationCap className="w-4 h-4 text-violet-600" /></div>
                Upcoming Exams
                <span className="text-xs text-muted-foreground font-normal ml-1">next 14 days</span>
              </CardTitle>
              <Link href="/exams">
                <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground hover:text-foreground">
                  All <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-0 flex-1">
              {loading.exams ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
              ) : upcomingExams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                  <div className="bg-muted p-3 rounded-full"><GraduationCap className="w-5 h-5 opacity-30" /></div>
                  <p className="text-sm font-medium">No exams in the next 14 days</p>
                  <Link href="/exams">
                    <Button variant="outline" size="sm" className="mt-1 text-xs gap-1">
                      Schedule one <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingExams.map((e, i) => (
                    <motion.div key={e.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.06 }}>
                      <Link href="/exams">
                        <div className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 transition-all cursor-pointer group">
                          <div className="bg-violet-100 dark:bg-violet-900/40 p-2 rounded-lg shrink-0">
                            <ClipboardList className="w-4 h-4 text-violet-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">{e.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                              <BookOpen className="w-3 h-3" />{e.subjectName}
                              <span>·</span>{e.questionCount}Q
                              <span>·</span>{e.totalMarks} marks
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <ExamCountdown examDate={e.examDate} />
                            <span className="text-xs text-muted-foreground">{format(parseISO(e.examDate), "dd MMM")}</span>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* At-Risk Students */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="border-border/60 shadow-sm h-full flex flex-col">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <div className="bg-red-100 dark:bg-red-900/30 p-1.5 rounded-lg"><AlertTriangle className="w-4 h-4 text-red-600" /></div>
                At-Risk Students
                <span className="text-xs text-muted-foreground font-normal ml-1">{"<"}75% attendance</span>
              </CardTitle>
              <Link href="/analytics">
                <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground hover:text-foreground">
                  Analytics <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-0 flex-1">
              {loading.risk ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
              ) : atRisk.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-full">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">All students on track</p>
                  <p className="text-xs text-muted-foreground">No one below 75% attendance</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {atRisk.map((s, i) => {
                    const rate = Number(s.attendanceRate);
                    const color = rate < 50 ? "bg-red-500" : rate < 65 ? "bg-orange-500" : "bg-amber-500";
                    return (
                      <motion.div key={s.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55 + i * 0.06 }}>
                        <Link href={`/students/${s.id}`}>
                          <div className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-red-300 dark:hover:border-red-700 hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-all cursor-pointer group">
                            <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                              <span className="text-xs font-black text-red-600">{s.studentCode}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors">{s.studentName}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${rate}%` }} />
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className={`text-sm font-black ${rate < 50 ? "text-red-600" : rate < 65 ? "text-orange-600" : "text-amber-600"}`}>{rate}%</span>
                              <p className="text-xs text-muted-foreground">{s.presentCount}/{s.totalSessions}</p>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                  <Link href="/risk-report">
                    <Button variant="outline" size="sm" className="w-full mt-1 text-xs gap-1 border-dashed">
                      <Target className="w-3.5 h-3.5" /> Full Risk Report
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Footer quick nav ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: "/reports", label: "Reports", icon: BarChart3, desc: "Weekly summaries" },
            { href: "/parent-comms", label: "Parent Comms", icon: Target, desc: "WhatsApp messages" },
            { href: "/question-bank", label: "Question Bank", icon: BookOpen, desc: "Reusable questions" },
            { href: "/timetable", label: "Timetable", icon: Calendar, desc: "Session overview" },
          ].map(item => (
            <Link key={item.href} href={item.href}>
              <div className="p-3.5 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/40 transition-all cursor-pointer group flex items-center gap-3">
                <div className="bg-muted p-2 rounded-lg group-hover:bg-primary/10 transition-colors">
                  <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
