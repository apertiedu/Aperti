import {
  useGetDashboardSummary,
  useGetRecentActivity,
  useGetWeeklyStats,
  getGetDashboardSummaryQueryKey,
  getGetRecentActivityQueryKey,
  getGetWeeklyStatsQueryKey
} from "@workspace/api-client-react";
import { Users, UserCheck, UserX, Clock, TrendingUp, BarChart3, Scan } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useAuth } from "@/context/auth";
import { Link } from "wouter";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Dashboard() {
  const { user } = useAuth();
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: recentActivity, isLoading: loadingActivity } = useGetRecentActivity({ limit: 10 }, { query: { queryKey: getGetRecentActivityQueryKey({ limit: 10 }) } });

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = format(weekStart, "yyyy-MM-dd");

  const { data: weeklyStats, isLoading: loadingStats } = useGetWeeklyStats({ weekStart: weekStartStr }, { query: { queryKey: getGetWeeklyStatsQueryKey({ weekStart: weekStartStr }) } });

  const today = DAY_NAMES[new Date().getDay()];

  const statsCards = [
    { title: "Total Students", value: summary?.totalStudents ?? 0, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Attendance Rate", value: `${summary?.attendanceRate ?? 0}%`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
    { title: "Present Today", value: summary?.presentToday ?? 0, icon: UserCheck, color: "text-primary", bg: "bg-primary/10" },
    { title: "Total Absences", value: summary?.absentStudents ?? 0, icon: UserX, color: "text-red-600", bg: "bg-red-50" },
  ];

  const chartData = weeklyStats?.byLesson.map((lesson) => ({
    name: `Lesson ${lesson.lessonNumber}`,
    Present: lesson.present,
    Absent: lesson.absent,
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, <span className="text-foreground font-medium">{user?.displayName}</span> · {today}, {format(new Date(), "dd MMMM yyyy")}
          </p>
        </div>
        <Link href="/attendance">
          <Button className="gap-2">
            <Scan className="h-4 w-4" />
            Mark Attendance
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      {loadingSummary ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Card key={i} className="animate-pulse h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsCards.map((stat, index) => (
            <Card key={index} className="border-border/50 shadow-sm">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.title}</p>
                    <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                  </div>
                  <div className={`${stat.bg} p-2 rounded-lg`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly chart */}
        <Card className="lg:col-span-2 border-border/50 shadow-sm flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              This Week's Attendance
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-[260px]">
            {loadingStats ? (
              <div className="h-full w-full bg-muted/50 animate-pulse rounded-md" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0/0.1)" }} />
                  <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "12px" }} />
                  <Bar dataKey="Present" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={48} />
                  <Bar dataKey="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-lg">
                No attendance data this week yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border/50 shadow-sm flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto max-h-72">
            {loadingActivity ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <div key={i} className="h-11 bg-muted/50 animate-pulse rounded-md" />)}
              </div>
            ) : recentActivity && recentActivity.length > 0 ? (
              <div className="space-y-2">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${activity.status === "Present" ? "bg-emerald-500" : "bg-red-500"}`} />
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium truncate">{activity.studentName}</p>
                      <p className="text-xs text-muted-foreground truncate">{activity.studentCode} · L{activity.lessonNumber}</p>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                      {format(new Date(activity.markedAt), "HH:mm")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-8 text-center">
                <Clock className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm">No activity today</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/students", label: "Manage Students", color: "bg-blue-50 hover:bg-blue-100 text-blue-700" },
          { href: "/exams", label: "Exams & Marks", color: "bg-indigo-50 hover:bg-indigo-100 text-indigo-700" },
          { href: "/analytics", label: "Analytics", color: "bg-emerald-50 hover:bg-emerald-100 text-emerald-700" },
          { href: "/reports", label: "Reports", color: "bg-amber-50 hover:bg-amber-100 text-amber-700" },
        ].map(link => (
          <Link key={link.href} href={link.href}>
            <div className={`rounded-lg p-3 text-center text-sm font-medium cursor-pointer transition-colors ${link.color}`}>
              {link.label}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
