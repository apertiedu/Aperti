import { motion } from "framer-motion";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  BookOpen, CalendarCheck, Users, TrendingUp, Clock, Bell,
  ChevronRight, Zap, Sparkles, MessageSquare, FileText,
  Video, AlertTriangle, CheckCircle2, PlusCircle, BarChart2,
  ClipboardList, Brain,
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/context/auth";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";

const API = "/api";
const tok = () => localStorage.getItem("aperti_token");

async function apiFetch(url: string) {
  const res = await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${tok()}` } });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

function StatsCard({ label, value, icon, sub, loading }: any) {
  if (loading) return (
    <Card><CardContent className="p-4 flex items-center gap-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="space-y-2"><Skeleton className="h-6 w-16" /><Skeleton className="h-3 w-24" /></div>
    </CardContent></Card>
  );
  return (
    <motion.div variants={item}>
      <Card className="card-hover">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">{icon}</div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{value ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
            {sub && <p className="text-xs text-primary mt-0.5">{sub}</p>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function InsightCard({ type, text }: { type: "warning" | "success" | "info"; text: string }) {
  const colors = {
    warning: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
    success: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
    info: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
  };
  const Icon = type === "warning" ? AlertTriangle : type === "success" ? CheckCircle2 : Zap;
  return (
    <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${colors[type]}`}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

export default function CoreHub() {
  const { user } = useAuth();
  const displayName = user?.displayName ?? "Teacher";

  const { data: summary, isLoading: sumLoading } = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => apiFetch("/dashboard/summary"),
  });

  const { data: extended } = useQuery({
    queryKey: ["dashboard", "extended"],
    queryFn: () => apiFetch("/dashboard/extended-summary"),
  });

  const { data: todayClasses, isLoading: todayLoading } = useQuery({
    queryKey: ["dashboard", "today-classes"],
    queryFn: () => apiFetch("/dashboard/today-classes"),
  });

  const { data: queue, isLoading: queueLoading } = useQuery({
    queryKey: ["dashboard", "assignment-queue"],
    queryFn: () => apiFetch("/dashboard/assignment-queue"),
  });

  const { data: trend } = useQuery({
    queryKey: ["dashboard", "attendance-trend"],
    queryFn: () => apiFetch("/dashboard/attendance-trend"),
  });

  const classes: any[] = Array.isArray(todayClasses) ? todayClasses : [];
  const submissions: any[] = Array.isArray(queue) ? queue.slice(0, 6) : [];
  const trendData = Array.isArray(trend)
    ? trend.map((r: any) => ({
        date: new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        rate: r.total > 0 ? Math.round((r.present / r.total) * 100) : 0,
      }))
    : [];

  /* Smart insights (rule-based) */
  const insights: Array<{ type: "warning" | "success" | "info"; text: string }> = [];
  const pendingCount = extended?.pendingGrading ?? 0;
  const attendanceRate = summary?.attendanceRate ?? 0;

  if (pendingCount > 5)
    insights.push({ type: "warning", text: `${pendingCount} submissions waiting to be graded — some students are waiting on feedback.` });
  if (attendanceRate > 0 && attendanceRate < 70)
    insights.push({ type: "warning", text: `Attendance today is ${attendanceRate}% — consider reaching out to absent students.` });
  if (attendanceRate >= 90)
    insights.push({ type: "success", text: `Great session — ${attendanceRate}% attendance today!` });
  if (classes.length === 0)
    insights.push({ type: "info", text: "No classes scheduled today. Use the time to plan or create content." });
  if (extended?.unreadMessages > 0)
    insights.push({ type: "info", text: `You have ${extended.unreadMessages} unread message${extended.unreadMessages > 1 ? "s" : ""} from students or parents.` });

  const quickActions = [
    { label: "New Assignment", icon: <ClipboardList className="h-4 w-4" />, href: "/submit-flow" },
    { label: "Check In", icon: <CalendarCheck className="h-4 w-4" />, href: "/checkin" },
    { label: "Start LiveClass", icon: <Video className="h-4 w-4" />, href: "/live-class" },
    { label: "Query Vault", icon: <Brain className="h-4 w-4" />, href: "/query-vault" },
    { label: "Grade Flow", icon: <CheckCircle2 className="h-4 w-4" />, href: "/grade-flow" },
    { label: "TutorCraft AI", icon: <Sparkles className="h-4 w-4" />, href: "/tutorcraft" },
    { label: "Messages", icon: <MessageSquare className="h-4 w-4" />, href: "/messages" },
    { label: "Analytics", icon: <BarChart2 className="h-4 w-4" />, href: "/pulse" },
  ];

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">
            {getGreeting()}, <span className="text-primary">{displayName}</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/messages">
            <Button variant="outline" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {(extended?.unreadMessages ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white">
                  {extended.unreadMessages}
                </span>
              )}
            </Button>
          </Link>
          <Link href="/tutorcraft">
            <Button size="sm" className="gap-2">
              <Sparkles className="h-4 w-4" /> TutorCraft AI
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Stats row */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard loading={sumLoading} label="Today's Classes" value={summary?.lessonsToday ?? 0} icon={<BookOpen className="h-5 w-5 text-primary" />} />
        <StatsCard loading={sumLoading} label="Students Present" value={`${summary?.studentsPresent ?? 0}`} icon={<Users className="h-5 w-5 text-primary" />} sub={summary?.attendanceRate != null ? `${summary.attendanceRate}% rate` : undefined} />
        <StatsCard loading={false} label="Pending Grading" value={pendingCount} icon={<Clock className="h-5 w-5 text-amber-500" />} />
        <StatsCard loading={false} label="Question Bank" value={extended?.questionBankCount ?? "—"} icon={<FileText className="h-5 w-5 text-primary" />} />
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Today's Schedule */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="xl:col-span-1">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Today's Schedule</CardTitle>
                <Link href="/plan-grid">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                    View all <ChevronRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {todayLoading ? (
                [1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)
              ) : classes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No classes today</p>
              ) : (
                classes.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="w-1 h-10 rounded-full bg-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.subject_name ?? `Lesson ${c.lesson_number}`}</p>
                      <p className="text-xs text-muted-foreground">{c.start_time}{c.end_time ? ` – ${c.end_time}` : ""} · {c.type ?? "Class"}</p>
                    </div>
                    {c.online_link && (
                      <Link href="/live-class">
                        <Button variant="outline" size="sm" className="h-7 text-xs shrink-0">
                          <Video className="h-3 w-3 mr-1" /> Join
                        </Button>
                      </Link>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Attendance Trend Chart */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="xl:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">7-Day Attendance Trend</CardTitle>
              <CardDescription className="text-xs">Daily attendance rate across your classes</CardDescription>
            </CardHeader>
            <CardContent>
              {trendData.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">
                  No attendance data in the last 7 days
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={176}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={(v: any) => [`${v}%`, "Attendance"]} />
                    <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Assignment Queue */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="xl:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Grading Queue</CardTitle>
                <Link href="/grade-flow">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                    Open GradeFlow <ChevronRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {queueLoading ? (
                [1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-lg mb-2" />)
              ) : submissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500 opacity-60" />
                  All caught up — no pending submissions!
                </div>
              ) : (
                <div className="space-y-2">
                  {submissions.map((s: any) => (
                    <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-xs">{s.student_name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.homework_title}</p>
                        <p className="text-xs text-muted-foreground">{s.student_name} · {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : "Just now"}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">Pending</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Smart Insights */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Smart Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {insights.length === 0 ? (
                <p className="text-sm text-muted-foreground">All looks good today!</p>
              ) : (
                insights.map((ins, i) => <InsightCard key={i} {...ins} />)
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {quickActions.map(({ label, icon, href }) => (
                <Link key={href} href={href}>
                  <Button variant="outline" className="w-full h-auto flex-col gap-1.5 py-3 text-xs" size="sm">
                    <span className="text-primary">{icon}</span>
                    <span className="leading-tight text-center">{label}</span>
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
