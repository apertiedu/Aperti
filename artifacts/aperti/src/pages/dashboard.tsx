import {
  useGetDashboardSummary,
  useGetRecentActivity,
  useGetWeeklyStats,
  getGetDashboardSummaryQueryKey,
  getGetRecentActivityQueryKey,
  getGetWeeklyStatsQueryKey
} from "@workspace/api-client-react";
import { Users, UserCheck, UserX, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() }
  });

  const { data: recentActivity, isLoading: loadingActivity } = useGetRecentActivity(
    { limit: 10 },
    { query: { queryKey: getGetRecentActivityQueryKey({ limit: 10 }) } }
  );

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = format(weekStart, "yyyy-MM-dd");

  const { data: weeklyStats, isLoading: loadingStats } = useGetWeeklyStats(
    { weekStart: weekStartStr },
    { query: { queryKey: getGetWeeklyStatsQueryKey({ weekStart: weekStartStr }) } }
  );

  const statsCards = [
    { title: "Total Students", value: summary?.totalStudents ?? 0, icon: Users, color: "text-blue-500" },
    { title: "Attendance Rate", value: `${summary?.attendanceRate ?? 0}%`, icon: UserCheck, color: "text-green-500" },
    { title: "Present Today", value: summary?.presentToday ?? 0, icon: Clock, color: "text-primary" },
    { title: "Absent Students", value: summary?.absentStudents ?? 0, icon: UserX, color: "text-destructive" },
  ];

  const chartData = weeklyStats?.byLesson.map((lesson) => ({
    name: `Lesson ${lesson.lessonNumber}`,
    Present: lesson.present,
    Absent: lesson.absent,
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of today's attendance and weekly trends.</p>
      </div>

      {loadingSummary ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted/50"></CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsCards.map((stat, index) => (
            <Card key={index} className="border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/50 shadow-sm flex flex-col">
          <CardHeader>
            <CardTitle>Weekly Stats (Lessons)</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px]">
            {loadingStats ? (
              <div className="h-full w-full bg-muted/50 animate-pulse rounded-md" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: '#f3f4f6' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="Present" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  <Bar dataKey="Absent" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground border border-dashed rounded-md">
                No weekly data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm flex flex-col">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {loadingActivity ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted/50 animate-pulse rounded-md" />
                ))}
              </div>
            ) : recentActivity && recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${activity.status === "Present" ? "bg-green-500" : "bg-destructive"}`} />
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium truncate">{activity.studentName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {activity.studentCode} • Lesson {activity.lessonNumber}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(activity.markedAt), "HH:mm")}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground py-8 text-center text-sm border border-dashed rounded-md">
                No recent activity today
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
