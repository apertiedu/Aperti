import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  BookOpen, CalendarCheck, Users, TrendingUp, Clock, Bell,
  ChevronRight, Zap, Sparkles, MessageSquare, FileText,
  Video, AlertTriangle, CheckCircle2, BarChart2,
  ClipboardList, Brain, Rocket, Settings2, Search, X,
  GraduationCap, QrCode,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/auth";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { apiFetch } from "@/lib/api";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const WIDGET_IDS = ["stats", "quick_start", "schedule", "attendance_trend", "grading_queue", "insights", "quick_actions"] as const;
type WidgetId = typeof WIDGET_IDS[number];
const WIDGET_LABELS: Record<WidgetId, string> = {
  stats: "Stats Row",
  quick_start: "Quick Start Guide",
  schedule: "Today's Schedule",
  attendance_trend: "Attendance Trend",
  grading_queue: "Grading Queue",
  insights: "Smart Insights",
  quick_actions: "Quick Actions",
};
const WIDGET_KEY = "aperti_corehub_widgets";

function loadWidgets(): Record<WidgetId, boolean> {
  try {
    const stored = JSON.parse(localStorage.getItem(WIDGET_KEY) || "{}");
    const defaults: Record<WidgetId, boolean> = {
      stats: true, quick_start: true, schedule: true,
      attendance_trend: true, grading_queue: true, insights: true, quick_actions: true,
    };
    return { ...defaults, ...stored };
  } catch {
    return { stats: true, quick_start: true, schedule: true, attendance_trend: true, grading_queue: true, insights: true, quick_actions: true };
  }
}
function saveWidgets(v: Record<WidgetId, boolean>) {
  try { localStorage.setItem(WIDGET_KEY, JSON.stringify(v)); } catch {}
}

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

type Student = { id: number; name: string; student_code: string; qr_code?: string };

function QuickStudentLookup() {
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: results = [], isLoading } = useQuery<Student[]>({
    queryKey: ["student-quick-lookup", q],
    queryFn: () => apiFetch(`/api/students?search=${encodeURIComponent(q)}&limit=6`),
    enabled: q.length >= 2,
    staleTime: 10000,
  });

  useEffect(() => {
    if (q.length >= 2) setOpen(true);
    else setOpen(false);
  }, [q]);

  const pick = (s: Student) => {
    navigate(`/students/${s.id}`);
    setQ(""); setOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => q.length >= 2 && setOpen(true)}
          placeholder="Quick lookup: name, code, or QR ID…"
          className="pl-9 pr-8 h-9 text-sm bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
        />
        {q && (
          <button onClick={() => { setQ(""); setOpen(false); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && q.length >= 2 && (
        <div className="absolute z-50 top-10 left-0 right-0 bg-background border border-border rounded-xl shadow-lg overflow-hidden">
          {isLoading ? (
            <div className="p-3 text-xs text-muted-foreground text-center">Searching…</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground text-center">No students found for "{q}"</div>
          ) : (
            results.map(s => (
              <button key={s.id} onClick={() => pick(s)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/60 transition-colors text-left">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <GraduationCap className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.student_code}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ))
          )}
          <Link href="/students">
            <div className="flex items-center justify-center gap-1.5 py-2 border-t border-border text-xs text-primary hover:bg-primary/5 transition-colors">
              <Users className="h-3 w-3" /> View all students
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}

function WidgetTogglePanel({ visible, onToggle, onClose }: {
  visible: Record<WidgetId, boolean>;
  onToggle: (id: WidgetId) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-10 z-50 bg-background border border-border rounded-xl shadow-lg p-4 w-64">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-foreground">Customize Widgets</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2.5">
        {WIDGET_IDS.map(id => (
          <div key={id} className="flex items-center justify-between">
            <Label htmlFor={`widget-${id}`} className="text-sm cursor-pointer">{WIDGET_LABELS[id]}</Label>
            <Switch id={`widget-${id}`} checked={visible[id]} onCheckedChange={() => onToggle(id)} />
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-3">Changes are saved automatically.</p>
    </div>
  );
}

export default function CoreHub() {
  const { user } = useAuth();
  const displayName = user?.displayName ?? "Teacher";
  const [widgetVisible, setWidgetVisible] = useState<Record<WidgetId, boolean>>(loadWidgets);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const show = (id: WidgetId) => widgetVisible[id] !== false;

  const toggleWidget = (id: WidgetId) => {
    setWidgetVisible(prev => {
      const updated = { ...prev, [id]: !prev[id] };
      saveWidgets(updated);
      return updated;
    });
  };

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
    { label: "Query Vault", icon: <Brain className="h-4 w-4" />, href: "/query-vault" },
    { label: "Grade Flow", icon: <CheckCircle2 className="h-4 w-4" />, href: "/grade-flow" },
    { label: "TutorCraft AI", icon: <Sparkles className="h-4 w-4" />, href: "/tutorcraft" },
    { label: "Messages", icon: <MessageSquare className="h-4 w-4" />, href: "/messages" },
    { label: "Analytics", icon: <BarChart2 className="h-4 w-4" />, href: "/pulse" },
    { label: "Student QR", icon: <QrCode className="h-4 w-4" />, href: "/students" },
  ];

  const isNewUser = !sumLoading && (summary?.lessonsToday ?? 0) === 0 && (summary?.studentsPresent ?? 0) === 0 && (summary?.studentsTotal ?? 0) === 0;

  const quickStartSteps = [
    { step: 1, icon: Users, label: "Add your first student", desc: "Register or invite students to your workspace", href: "/students", done: (summary?.studentsTotal ?? 0) > 0 },
    { step: 2, icon: BookOpen, label: "Create a subject", desc: "Organise your teaching by subject or class", href: "/subjects", done: false },
    { step: 3, icon: CalendarCheck, label: "Schedule a session", desc: "Plan your first lesson in PlanGrid", href: "/plan-grid", done: false },
    { step: 4, icon: ClipboardList, label: "Set an assignment", desc: "Give students their first homework task", href: "/submit-flow", done: false },
  ];

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {getGreeting()}, <span className="text-primary">{displayName}</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          {!sumLoading && (
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-1.5">
              {classes.length > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <BookOpen className="h-3 w-3 text-primary" />
                  {classes.length} class{classes.length !== 1 ? "es" : ""} today
                </span>
              )}
              {pendingCount > 0 && (
                <span className="text-xs text-amber-600 font-medium flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  {pendingCount} pending grade{pendingCount !== 1 ? "s" : ""}
                </span>
              )}
              {(summary?.attendanceRate ?? 0) > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  {summary.attendanceRate}% attendance
                </span>
              )}
              {(extended?.unreadMessages ?? 0) > 0 && (
                <span className="text-xs text-blue-600 font-medium flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3" />
                  {extended.unreadMessages} unread
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/notifications">
            <Button variant="outline" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {(extended?.unreadMessages ?? 0) > 0 && (
                <span className="badge-urgent absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white">
                  {extended.unreadMessages}
                </span>
              )}
            </Button>
          </Link>
          <div className="relative">
            <Button variant="outline" size="icon" onClick={() => setSettingsOpen(s => !s)}>
              <Settings2 className="h-4 w-4" />
            </Button>
            {settingsOpen && (
              <WidgetTogglePanel
                visible={widgetVisible}
                onToggle={toggleWidget}
                onClose={() => setSettingsOpen(false)}
              />
            )}
          </div>
          <Link href="/tutorcraft">
            <Button size="sm" className="gap-2">
              <Sparkles className="h-4 w-4" /> TutorCraft AI
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Quick Student Lookup */}
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-6 max-w-md">
        <QuickStudentLookup />
      </motion.div>

      {/* Quick Start */}
      {show("quick_start") && isNewUser && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-2xl border border-primary/20 bg-primary/5 p-5"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Rocket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-sm">Welcome to Aperti! Let's get you set up</h2>
              <p className="text-xs text-muted-foreground">Complete these steps to launch your workspace</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {quickStartSteps.map(({ step, icon: Icon, label, desc, href, done }) => (
              <Link key={step} href={href}>
                <div className={`group p-4 rounded-xl border transition-all cursor-pointer ${done ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30" : "border-border bg-card hover:border-primary/40 hover:bg-primary/5"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                      {done ? "✓" : step}
                    </span>
                    <Icon className={`h-4 w-4 ${done ? "text-emerald-500" : "text-muted-foreground group-hover:text-primary transition-colors"}`} />
                  </div>
                  <p className={`text-xs font-semibold ${done ? "text-emerald-700 dark:text-emerald-400 line-through" : "text-foreground"}`}>{label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Stats row */}
      {show("stats") && (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-list">
          <StatsCard loading={sumLoading} label="Today's Classes" value={summary?.lessonsToday ?? 0} icon={<BookOpen className="h-5 w-5 text-primary" />} />
          <StatsCard loading={sumLoading} label="Students Present" value={`${summary?.studentsPresent ?? 0}`} icon={<Users className="h-5 w-5 text-primary" />} sub={summary?.attendanceRate != null ? `${summary.attendanceRate}% rate` : undefined} />
          <StatsCard loading={false} label="Pending Grading" value={pendingCount} icon={<Clock className="h-5 w-5 text-amber-500" />} />
          <StatsCard loading={false} label="Question Bank" value={extended?.questionBankCount ?? "—"} icon={<FileText className="h-5 w-5 text-primary" />} />
        </motion.div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Today's Schedule */}
        {show("schedule") && (
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
                        <a href={c.online_link} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="h-7 text-xs shrink-0">
                            <Video className="h-3 w-3 mr-1" /> Join
                          </Button>
                        </a>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Attendance Trend Chart */}
        {show("attendance_trend") && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className={show("schedule") ? "xl:col-span-2" : "xl:col-span-3"}>
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
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Grading Queue */}
        {show("grading_queue") && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className={show("insights") ? "xl:col-span-2" : "xl:col-span-3"}>
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
        )}

        {/* Smart Insights */}
        {show("insights") && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className={show("grading_queue") ? "" : "xl:col-span-3"}>
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
                  <div className="stagger-list space-y-2">
                    {insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Quick Actions */}
      {show("quick_actions") && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {quickActions.map(({ label, icon, href }) => (
                  <Link key={href + label} href={href}>
                    <div className="group flex flex-col items-center gap-2 py-4 px-2 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer select-none active:scale-95">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <span className="text-primary">{icon}</span>
                      </div>
                      <span className="text-xs font-medium text-foreground text-center leading-tight">{label}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Recently Used */}
      <RecentlyUsedSection />
    </div>
  );
}

function RecentlyUsedSection() {
  const [items, setItems] = useState<{ href: string; label: string; visitedAt: number }[]>([]);
  const [, nav] = useLocation();

  useEffect(() => {
    function load() {
      try {
        const stored = JSON.parse(localStorage.getItem("aperti_recent_pages") || "[]");
        setItems(stored.slice(0, 6));
      } catch {
        setItems([]);
      }
    }
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  if (items.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Recently Visited
            </CardTitle>
            <button
              onClick={() => { localStorage.removeItem("aperti_recent_pages"); setItems([]); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {items.map(item => (
              <button
                key={item.href}
                onClick={() => nav(item.href)}
                className="flex flex-col items-start p-3 rounded-lg border border-gray-100 hover:border-teal-200 hover:bg-teal-50/30 transition-all text-left group"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  {new Date(item.visitedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug group-hover:text-teal-700">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
