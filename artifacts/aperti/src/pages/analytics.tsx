import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, Trophy, Users, Target, BarChart3, Wifi, Building2 } from "lucide-react";
import { useAuth } from "@/context/auth";

type SessionSummary = { sessionId: number; lessonNumber: number; dayOfWeek: string; startTime: string; type: string; capacity: number | null; present: number; absent: number };
type AbsentStudent = { studentId: number; studentName: string; studentCode: string; absentCount: number };
type StudentStat = { id: number; studentCode: string; studentName: string; attendanceRate: number; examPercentage: number | null; predictedGrade: string; weakTopics: string[]; strongTopics: string[]; isAtRisk: boolean };
type Overall = { totalStudents: number; totalPresent: number; totalAbsent: number; attendanceRate: number };

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const GRADE_COLOR: Record<string, string> = { "A*": "text-purple-600", A: "text-emerald-600", B: "text-blue-600", C: "text-amber-600", D: "text-orange-600", E: "text-red-400", U: "text-red-600" };

export default function Analytics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState<{ sessions: SessionSummary[]; mostAbsent: AbsentStudent[]; overall: Overall } | null>(null);
  const [perfData, setPerfData] = useState<{ topStudents: StudentStat[]; atRisk: StudentStat[]; averagePercentage: number; studentStats: StudentStat[] } | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/analytics/attendance-summary", { credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch("/api/analytics/performance", { credentials: "include" }).then(r => r.ok ? r.json() : null),
    ]).then(([att, perf]) => {
      setAttendanceData(att);
      setPerfData(perf);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold">Analytics</h1></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Card key={i} className="animate-pulse h-28" />)}
        </div>
      </div>
    );
  }

  const overall = attendanceData?.overall;
  const sessions = attendanceData?.sessions ?? [];
  const mostAbsent = attendanceData?.mostAbsent ?? [];

  const sessionChartData = sessions.map(s => ({
    name: `L${s.lessonNumber} ${s.dayOfWeek.slice(0, 3)}`,
    Present: s.present,
    Absent: s.absent,
    type: s.type,
  }));

  const onlineSessions = sessions.filter(s => s.type === "online");
  const centreSessions = sessions.filter(s => s.type === "centre");

  const gradeDistribution = perfData?.studentStats.reduce((acc, s) => {
    if (s.predictedGrade !== "N/A") {
      acc[s.predictedGrade] = (acc[s.predictedGrade] ?? 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>) ?? {};

  const gradeChartData = Object.entries(gradeDistribution).sort((a, b) => {
    const order = ["A*", "A", "B", "C", "D", "E", "U"];
    return order.indexOf(a[0]) - order.indexOf(b[0]);
  }).map(([grade, count]) => ({ grade, count }));

  const pieData = sessions.map((s, i) => ({
    name: `L${s.lessonNumber} ${s.dayOfWeek.slice(0, 3)} ${s.startTime}`,
    value: s.present,
    fill: COLORS[i % COLORS.length],
  })).filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />
            Analytics
          </h1>
          <p className="text-muted-foreground mt-1">Attendance summaries, performance insights, and predicted grades.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Students", value: overall?.totalStudents ?? 0, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Attendance Rate", value: `${overall?.attendanceRate ?? 0}%`, icon: Target, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Total Present", value: overall?.totalPresent ?? 0, icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
          { label: "Total Absent", value: overall?.totalAbsent ?? 0, icon: TrendingDown, color: "text-red-600", bg: "bg-red-50" },
        ].map(stat => (
          <Card key={stat.label} className="border-border/50 shadow-sm">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
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

      {/* Session type breakdown */}
      {(onlineSessions.length > 0 || centreSessions.length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-border/50 shadow-sm">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                <Wifi className="h-4 w-4 text-blue-500" />Online Sessions
              </div>
              <p className="text-2xl font-bold">{onlineSessions.length}</p>
              <p className="text-xs text-muted-foreground mt-1">{onlineSessions.reduce((s, r) => s + r.present, 0)} total attendances</p>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-sm">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                <Building2 className="h-4 w-4 text-amber-500" />Centre Sessions
              </div>
              <p className="text-2xl font-bold">{centreSessions.length}</p>
              <div className="space-y-0.5 mt-1">
                {centreSessions.slice(0, 3).map(s => (
                  <div key={s.sessionId} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>L{s.lessonNumber} {s.dayOfWeek} {s.startTime}</span>
                    {s.capacity && (
                      <span className={`font-medium ${s.present >= s.capacity ? "text-red-500" : s.present >= s.capacity * 0.8 ? "text-amber-500" : "text-emerald-500"}`}>
                        {s.present}/{s.capacity}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Per-session attendance bar chart */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Attendance by Session</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {sessionChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sessionChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0/0.1)" }} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="Present" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-lg">No attendance data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Grade distribution */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Predicted Grade Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {gradeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="grade" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0/0.1)" }} />
                  <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {gradeChartData.map((entry, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-lg">Add exams and marks to see grade predictions</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top performers */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" />Top Performers</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!perfData?.topStudents.length ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No exam data yet</div>
            ) : (
              <div className="divide-y divide-border/50">
                {perfData.topStudents.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-100 text-slate-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{s.studentName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{s.studentCode}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-emerald-600">{s.examPercentage}%</p>
                      <p className={`text-xs font-bold ${GRADE_COLOR[s.predictedGrade] ?? ""}`}>{s.predictedGrade}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* At-risk students */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" />At-Risk Students</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!perfData?.atRisk.length ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No at-risk students identified</div>
            ) : (
              <div className="divide-y divide-border/50">
                {perfData.atRisk.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="h-3 w-3 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{s.studentName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{s.attendanceRate}% attendance</span>
                        {s.examPercentage !== null && <span className="text-xs text-muted-foreground">· {s.examPercentage}% in exams</span>}
                      </div>
                    </div>
                    <span className={`text-xs font-bold flex-shrink-0 ${GRADE_COLOR[s.predictedGrade] ?? "text-muted-foreground"}`}>{s.predictedGrade}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Most Absent Students */}
      {mostAbsent.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-500" />Most Frequent Absences</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {mostAbsent.map(s => (
                <div key={s.studentId} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-red-50/50">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{s.studentName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{s.studentCode}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-lg font-bold text-red-600">{s.absentCount}</p>
                    <p className="text-[10px] text-muted-foreground">absences</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All students performance table */}
      {perfData && perfData.studentStats.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base">All Students — Performance Overview</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Student</th>
                  <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Attendance</th>
                  <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Exam %</th>
                  <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Grade</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Weak Topics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {perfData.studentStats.map(s => (
                  <tr key={s.id} className={`hover:bg-muted/20 ${s.isAtRisk ? "bg-red-50/30" : ""}`}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{s.studentName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{s.studentCode}</p>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`font-semibold ${s.attendanceRate >= 80 ? "text-emerald-600" : s.attendanceRate >= 60 ? "text-amber-600" : "text-red-600"}`}>
                        {s.attendanceRate}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {s.examPercentage !== null ? (
                        <span className={`font-semibold ${s.examPercentage >= 70 ? "text-emerald-600" : s.examPercentage >= 50 ? "text-amber-600" : "text-red-600"}`}>
                          {s.examPercentage}%
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`font-bold text-base ${GRADE_COLOR[s.predictedGrade] ?? "text-muted-foreground"}`}>
                        {s.predictedGrade}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {s.weakTopics.slice(0, 3).map(t => (
                          <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">{t}</span>
                        ))}
                        {s.weakTopics.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
