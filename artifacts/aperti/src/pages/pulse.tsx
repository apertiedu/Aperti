import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell,
} from "recharts";
import {
  Users, TrendingUp, AlertTriangle, CheckCircle, Target, BarChart2,
  BookOpen, Zap, ShieldAlert, Activity, TrendingDown, Minus,
} from "lucide-react";
import { AppEmptyState } from "@/components/app-empty-state";
import { Link } from "wouter";

const API = "/api";
async function apiFetch(url: string) {
  const res = await fetch(`${API}${url}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

const GRADE_COLORS: Record<string, string> = {
  "A*": "#00796B", A: "#26A69A", B: "#4DB6AC", C: "#80CBC4", D: "#F59E0B", U: "#EF4444",
};

function StatCard({ label, value, icon, sub, loading }: any) {
  if (loading) return <Card><CardContent className="p-4"><Skeleton className="h-14 w-full" /></CardContent></Card>;
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">{icon}</div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{value ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="text-xs text-primary">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreGauge({ score, label, color, icon: Icon, description }: {
  score: number; label: string; color: string; icon: any; description: string;
}) {
  const clipped = Math.max(0, Math.min(100, score));
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card">
      <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: `${color}18` }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold tabular-nums" style={{ color }}>{clipped}</p>
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="w-full">
        <Progress value={clipped} className="h-1.5" style={{ "--tw-progress-fill": color } as any} />
      </div>
    </div>
  );
}

function RiskBadge({ level }: { level: "low" | "medium" | "high" }) {
  if (level === "high") return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">High Risk</Badge>;
  if (level === "medium") return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Monitor</Badge>;
  return <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">On Track</Badge>;
}

function TrendArrow({ value, threshold = 75 }: { value: number; threshold?: number }) {
  if (value >= threshold) return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (value >= threshold * 0.7) return <Minus className="h-3.5 w-3.5 text-amber-500" />;
  return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
}

export default function Pulse() {
  const [tab, setTab] = useState("overview");

  const { data: overview, isLoading: ovLoading } = useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: () => apiFetch("/analytics/class-overview"),
    retry: 1,
  });

  const { data: students } = useQuery<any[]>({
    queryKey: ["students-all"],
    queryFn: () => apiFetch("/students"),
    retry: 1,
  });

  const { data: attendance } = useQuery<any[]>({
    queryKey: ["attendance-trend"],
    queryFn: () => apiFetch("/dashboard/attendance-trend"),
    retry: 1,
  });

  const { data: hwList } = useQuery<any[]>({
    queryKey: ["homework-teacher"],
    queryFn: () => apiFetch("/homework/teacher"),
    retry: 1,
  });

  const { data: gradeData } = useQuery<{ grades: { grade: string; count: number }[]; hasSufficientData: boolean }>({
    queryKey: ["analytics", "grade-distribution"],
    queryFn: () => apiFetch("/analytics/grade-distribution"),
    retry: 1,
  });

  const { data: scoreData, isLoading: scoresLoading } = useQuery<{ students: any[] }>({
    queryKey: ["analytics", "student-scores"],
    queryFn: () => apiFetch("/analytics/student-scores"),
    enabled: tab === "scores",
    retry: 1,
  });

  const studentList: any[] = Array.isArray(students) ? students : (students as any)?.students ?? [];
  const hwArr: any[] = Array.isArray(hwList) ? hwList : (hwList as any)?.homework ?? [];
  const subjectStats: any[] = (overview as any)?.subjects ?? [];

  const attendanceTrend = Array.isArray(attendance)
    ? attendance.map((r: any) => ({
        date: new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        rate: r.total > 0 ? Math.round((r.present / r.total) * 100) : 0,
      }))
    : [];

  const avgAtt = attendanceTrend.length > 0
    ? Math.round(attendanceTrend.reduce((s, r) => s + r.rate, 0) / attendanceTrend.length)
    : 0;

  const gradeDist = gradeData?.grades ?? [];
  const hasGradeData = gradeData?.hasSufficientData ?? false;

  const scored = scoreData?.students ?? [];
  const avgEngagement = scored.length > 0 ? Math.round(scored.reduce((s, x) => s + x.engagementScore, 0) / scored.length) : 0;
  const highRiskCount = scored.filter(s => s.riskLevel === "high").length;
  const avgConsistency = scored.length > 0 ? Math.round(scored.reduce((s, x) => s + x.consistencyScore, 0) / scored.length) : 0;

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold">Pulse™ <span className="text-primary">Analytics</span></h1>
        <p className="text-muted-foreground text-sm">Class performance, attendance trends and student insights.</p>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger-list">
        <StatCard loading={ovLoading} label="Total Students" value={studentList.length} icon={<Users className="h-5 w-5" />} />
        <StatCard loading={false} label="Avg Attendance" value={`${avgAtt}%`} icon={<CheckCircle className="h-5 w-5" />} sub={avgAtt >= 85 ? "On track" : avgAtt >= 70 ? "Monitor" : avgAtt === 0 ? null : "Action needed"} />
        <StatCard loading={false} label="Assignments Set" value={hwArr.length} icon={<BookOpen className="h-5 w-5" />} />
        <StatCard loading={false} label="Subjects" value={(overview as any)?.totalSubjects ?? subjectStats.length} icon={<Target className="h-5 w-5" />} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="grades">Grades</TabsTrigger>
          <TabsTrigger value="scores">
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            Scores
          </TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Attendance Trend (Recent)</CardTitle>
              </CardHeader>
              <CardContent>
                {attendanceTrend.length === 0 ? (
                  <AppEmptyState type="attendance" title="No attendance data yet" description="Record attendance in CheckIn to see trends here." size="sm" actions={[{ label: "Go to CheckIn", href: "/checkin", primary: true }]} />
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={attendanceTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                      <Tooltip formatter={(v: any) => [`${v}%`, "Attendance"]} />
                      <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Grade Distribution</CardTitle>
                <CardDescription className="text-xs">
                  {hasGradeData ? "Based on exam results (last 90 days)" : "No exam data yet"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!hasGradeData ? (
                  <AppEmptyState type="results" title="No exam results yet" description="Create an exam and enter marks to see grade distribution." size="sm" actions={[{ label: "Create Exam", href: "/exams", primary: true }]} />
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={gradeDist} barSize={32}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="grade" tick={{ fontSize: 12, fontWeight: 600 }} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                          {gradeDist.map((g: any, i: number) => <Cell key={i} fill={GRADE_COLORS[g.grade] ?? "#00796B"} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {gradeDist.map((g: any) => (
                        <div key={g.grade} className="flex items-center gap-1.5 text-xs">
                          <div className="h-2.5 w-2.5 rounded-sm" style={{ background: GRADE_COLORS[g.grade] ?? "#00796B" }} />
                          <span>{g.grade}: {g.count}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {subjectStats.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Subject Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {subjectStats.map((s: any, i: number) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{s.subjectName ?? s.name}</span>
                      <span className="font-medium">{s.avgMark ?? s.average ?? 0}%</span>
                    </div>
                    <Progress value={Number(s.avgMark ?? s.average ?? 0)} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ATTENDANCE */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Attendance Trend</CardTitle>
              <CardDescription className="text-xs">Daily rate over recent sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {attendanceTrend.length === 0 ? (
                <AppEmptyState type="attendance" title="No attendance records yet" description="Start taking attendance in CheckIn to track trends here." size="md" actions={[{ label: "Take Attendance", href: "/checkin", primary: true }]} />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={attendanceTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => [`${v}%`, "Attendance"]} />
                    <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* GRADES */}
        <TabsContent value="grades" className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Grade Distribution</CardTitle>
              <CardDescription className="text-xs">
                {hasGradeData ? "Real data from exam marks (last 90 days)" : "Enter exam marks to see distribution"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!hasGradeData ? (
                <AppEmptyState type="results" title="No exam marks recorded" description="Grade your exams to see a breakdown of A*, A, B, C, D and U grades." size="md" actions={[{ label: "Go to Exams", href: "/exams", primary: true }]} />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={gradeDist} barSize={40}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="grade" tick={{ fontSize: 13, fontWeight: 700 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" name="Students" radius={[6, 6, 0, 0]}>
                        {gradeDist.map((g: any, i: number) => <Cell key={i} fill={GRADE_COLORS[g.grade] ?? "#00796B"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {gradeDist.map((g: any) => (
                      <div key={g.grade} className="flex items-center gap-1.5 text-xs">
                        <div className="h-2.5 w-2.5 rounded-sm" style={{ background: GRADE_COLORS[g.grade] ?? "#00796B" }} />
                        <span>{g.grade}: {g.count} students</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ENGAGEMENT SCORES */}
        <TabsContent value="scores" className="space-y-6">
          {scoresLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
          ) : scored.length === 0 ? (
            <AppEmptyState type="analytics" title="No student data to score" description="Add students and record attendance, homework and exams to calculate engagement, risk and consistency scores." size="md" actions={[{ label: "Add Students", href: "/students", primary: true }]} />
          ) : (
            <>
              {/* Class averages */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <ScoreGauge
                  score={avgEngagement}
                  label="Avg Engagement"
                  color="#0D9488"
                  icon={Zap}
                  description="Attendance × 40% + Homework × 35% + Exams × 25%"
                />
                <ScoreGauge
                  score={100 - (highRiskCount / Math.max(scored.length, 1)) * 100}
                  label="Class Health"
                  color="#3B82F6"
                  icon={Activity}
                  description={`${highRiskCount} of ${scored.length} students at high risk`}
                />
                <ScoreGauge
                  score={avgConsistency}
                  label="Avg Consistency"
                  color="#8B5CF6"
                  icon={TrendingUp}
                  description="Regularity of attendance & homework completion"
                />
              </div>

              {/* Per-student table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Student Score Breakdown</CardTitle>
                  <CardDescription className="text-xs">{scored.length} students · calculated from last 30–60 days of data</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50/60">
                          <th className="text-left p-3 font-medium text-xs text-gray-500 uppercase tracking-wide">Student</th>
                          <th className="text-center p-3 font-medium text-xs text-gray-500 uppercase tracking-wide">Attendance</th>
                          <th className="text-center p-3 font-medium text-xs text-gray-500 uppercase tracking-wide">HW Done</th>
                          <th className="text-center p-3 font-medium text-xs text-gray-500 uppercase tracking-wide">
                            <span className="flex items-center justify-center gap-1"><Zap className="h-3 w-3 text-teal-500" />Engagement</span>
                          </th>
                          <th className="text-center p-3 font-medium text-xs text-gray-500 uppercase tracking-wide">
                            <span className="flex items-center justify-center gap-1"><ShieldAlert className="h-3 w-3 text-red-400" />Risk</span>
                          </th>
                          <th className="text-center p-3 font-medium text-xs text-gray-500 uppercase tracking-wide">
                            <span className="flex items-center justify-center gap-1"><Activity className="h-3 w-3 text-purple-400" />Consistency</span>
                          </th>
                          <th className="text-center p-3 font-medium text-xs text-gray-500 uppercase tracking-wide">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {scored.map((s: any) => (
                          <tr key={s.id} className={`hover:bg-gray-50/50 transition-colors ${s.riskLevel === "high" ? "bg-red-50/30" : ""}`}>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                                  {(s.name ?? "?").slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium text-xs text-gray-900 truncate max-w-[140px]">{s.name}</p>
                                  <p className="text-[10px] text-gray-400 font-mono">{s.code}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <TrendArrow value={s.attendancePct} />
                                <span className={`text-xs font-semibold ${s.attendancePct >= 85 ? "text-green-600" : s.attendancePct >= 70 ? "text-amber-600" : "text-red-600"}`}>
                                  {s.attendancePct}%
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`text-xs font-semibold ${s.hwCompletionPct >= 80 ? "text-green-600" : s.hwCompletionPct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                                {s.hwCompletionPct}%
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-sm font-bold text-teal-700">{s.engagementScore}</span>
                                <div className="w-12 h-1 rounded-full bg-gray-100 overflow-hidden">
                                  <div className="h-full rounded-full bg-teal-500" style={{ width: `${s.engagementScore}%` }} />
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`text-xs font-bold ${s.riskScore >= 50 ? "text-red-600" : s.riskScore >= 25 ? "text-amber-600" : "text-green-600"}`}>
                                {s.riskScore}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span className="text-xs font-semibold text-purple-600">{s.consistencyScore}</span>
                            </td>
                            <td className="p-3 text-center">
                              <RiskBadge level={s.riskLevel} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {highRiskCount > 0 && (
                <Card className="border-red-200 bg-red-50/40">
                  <CardContent className="p-4 flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-800">{highRiskCount} student{highRiskCount > 1 ? "s" : ""} at high risk</p>
                      <p className="text-xs text-red-600">These students have low attendance, incomplete homework, or poor exam scores.</p>
                    </div>
                    <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100" asChild>
                      <Link href="/students">View Students</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* STUDENTS */}
        <TabsContent value="students">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Student Roster</CardTitle>
              <CardDescription className="text-xs">{studentList.length} students</CardDescription>
            </CardHeader>
            <CardContent>
              {studentList.length === 0 ? (
                <AppEmptyState type="students" title="No students yet" description="You haven't added any students. Invite them to join your course." size="md" actions={[{ label: "Manage Students", href: "/students", primary: true }]} />
              ) : (
                <div className="space-y-2">
                  {studentList.map((s: any) => (
                    <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {s.student_name?.slice(0, 2).toUpperCase() ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.student_name}</p>
                        <p className="text-xs text-muted-foreground">{s.student_code}</p>
                      </div>
                      <Badge variant={s.status === "active" ? "default" : "secondary"} className="text-xs">{s.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
