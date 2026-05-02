import { useState, useEffect } from "react";
import { Users, UserCheck, UserX, Clock, TrendingUp, BarChart3, Scan, Calendar, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useAuth } from "@/context/auth";
import { Link } from "wouter";
import { motion } from "framer-motion";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Summary = { totalStudents: number; attendanceRate: number; presentToday: number; absentStudents: number };
type Activity = { id: number; studentName: string; studentCode: string; lessonNumber: number; status: string; markedAt: string };
type WeeklyStats = { byLesson: { lessonNumber: number; present: number; absent: number }[] };

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
} as any;

function AnimatedCounter({ value, duration = 1 }: { value: number | string, duration?: number }) {
  const [count, setCount] = useState(0);
  const isPercent = typeof value === 'string' && value.endsWith('%');
  const target = typeof value === 'string' ? parseFloat(value) : value;

  useEffect(() => {
    let start = 0;
    const end = target;
    const totalFrames = Math.round(duration * 60);
    let frame = 0;

    const timer = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;
      // easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = start + (end - start) * easeProgress;
      
      setCount(Math.round(current));

      if (frame === totalFrames) {
        clearInterval(timer);
        setCount(end);
      }
    }, 1000 / 60);

    return () => clearInterval(timer);
  }, [target, duration]);

  return <span>{count}{isPercent ? '%' : ''}</span>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const today = DAY_NAMES[new Date().getDay()];
  const dateStr = format(new Date(), "dd MMMM yyyy");

  useEffect(() => {
    fetch("/api/dashboard/summary", { credentials: "include" })
      .then(r => r.ok ? r.json() : null).then(d => { setSummary(d); setLoadingSummary(false); });
    fetch("/api/dashboard/recent-activity?limit=10", { credentials: "include" })
      .then(r => r.ok ? r.json() : []).then(d => { setRecentActivity(d); setLoadingActivity(false); });
    fetch(`/api/dashboard/weekly-stats?weekStart=${weekStartStr}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null).then(d => { setWeeklyStats(d); setLoadingStats(false); });
  }, [weekStartStr]);

  const statsCards = [
    { title: "Total Students", value: summary?.totalStudents ?? 0, icon: Users, color: "text-blue-600", bg: "bg-blue-100/50" },
    { title: "Attendance Rate", value: `${summary?.attendanceRate ?? 0}%`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-100/50" },
    { title: "Present Today", value: summary?.presentToday ?? 0, icon: UserCheck, color: "text-primary", bg: "bg-primary/10" },
    { title: "Total Absences", value: summary?.absentStudents ?? 0, icon: UserX, color: "text-red-600", bg: "bg-red-100/50" },
  ];

  const chartData = weeklyStats?.byLesson.map(lesson => ({
    name: `Lesson ${lesson.lessonNumber}`,
    Present: lesson.present,
    Absent: lesson.absent,
  })) || [];

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
          Welcome back, {user?.displayName?.split(' ')[0]} 👋
        </h1>
        <p className="text-muted-foreground mt-2 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          {today}, {dateStr}
        </p>
      </motion.div>

      {/* What Matters Today Panel */}
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.4 }}>
        <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Scan className="w-32 h-32" />
          </div>
          <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded">TODAY's FOCUS</div>
                {(summary?.attendanceRate ?? 100) < 80 && (
                  <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">ATTENDANCE WARNING</div>
                )}
              </div>
              <h2 className="text-2xl font-bold text-foreground">Ready for {today}'s sessions?</h2>
              <p className="text-muted-foreground mt-1">
                {summary?.absentStudents ? `${summary.absentStudents} students missed classes recently.` : "Attendance looks good. Have a great day teaching!"}
              </p>
            </div>
            <Link href="/attendance">
              <Button size="lg" className="gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-transform card-hover w-full sm:w-auto">
                <Scan className="h-5 w-5" /> Mark Attendance
              </Button>
            </Link>
          </CardContent>
        </Card>
      </motion.div>

      {/* KPI Cards */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingSummary ? (
          [...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)
        ) : (
          statsCards.map((stat, index) => (
            <motion.div key={index} variants={itemVariants}>
              <Card className="border-border/50 shadow-sm card-hover overflow-hidden h-full">
                <CardContent className="p-5 flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{stat.title}</p>
                    <p className={`text-3xl font-black ${stat.color}`}>
                      <AnimatedCounter value={stat.value} />
                    </p>
                  </div>
                  <div className={`${stat.bg} p-3 rounded-xl`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="lg:col-span-2">
          <Card className="border-border/50 shadow-sm h-full flex flex-col card-hover">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 font-bold">
                <BarChart3 className="h-5 w-5 text-primary" />This Week's Attendance
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-[300px] pt-4">
              {loadingStats ? (
                <div className="h-full w-full skeleton rounded-xl" />
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontWeight: 500 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontWeight: 500 }} allowDecimals={false} />
                    <Tooltip 
                      cursor={{ fill: "hsl(var(--muted)/0.5)" }}
                      contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", boxShadow: "0 10px 15px -3px rgb(0 0 0/0.1)", fontWeight: 500 }} 
                    />
                    <Legend wrapperStyle={{ paddingTop: "20px", fontSize: "13px", fontWeight: 500 }} />
                    <Bar dataKey="Present" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={40} animationDuration={1500} />
                    <Bar dataKey="Absent" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} maxBarSize={40} animationDuration={1500} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">
                  No attendance data this week yet
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activity */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="border-border/50 shadow-sm h-full flex flex-col card-hover">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 font-bold">
                <Clock className="h-5 w-5 text-muted-foreground" />Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto max-h-[300px] custom-scrollbar p-2">
              {loadingActivity ? (
                <div className="space-y-3 p-2">{[...Array(6)].map((_, i) => <div key={i} className="h-12 skeleton rounded-lg" />)}</div>
              ) : recentActivity.length > 0 ? (
                <div className="space-y-1">
                  {recentActivity.map((activity, i) => (
                    <motion.div 
                      key={activity.id} 
                      initial={{ opacity: 0, x: -10 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      transition={{ delay: 0.6 + (i * 0.05) }}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group cursor-pointer"
                    >
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm ${activity.status === "Present" ? "bg-emerald-500 shadow-emerald-500/40" : "bg-red-500 shadow-red-500/40"}`} />
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{activity.studentName}</p>
                        <p className="text-xs text-muted-foreground truncate">{activity.studentCode} · Lesson {activity.lessonNumber}</p>
                      </div>
                      <span className="text-xs font-mono font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                        {format(new Date(activity.markedAt), "HH:mm")}
                      </span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-10 text-center">
                  <div className="bg-muted p-4 rounded-full mb-3"><Clock className="h-6 w-6 opacity-50" /></div>
                  <p className="text-sm font-medium">No activity today</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Links */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { href: "/students", label: "Manage Students", color: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900/30" },
          { href: "/exams", label: "Exams & Marks", color: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/30" },
          { href: "/analytics", label: "Analytics", color: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/30" },
          { href: "/reports", label: "Reports", color: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/30" },
        ].map((link, i) => (
          <motion.div key={link.href} variants={itemVariants}>
            <Link href={link.href}>
              <div className={`rounded-xl p-4 text-center text-sm font-bold cursor-pointer transition-all border shadow-sm hover:shadow-md hover:-translate-y-1 group flex items-center justify-center gap-2 ${link.color}`}>
                {link.label}
                <ArrowRight className="w-4 h-4 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all" />
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}