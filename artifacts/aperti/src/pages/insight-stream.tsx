import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp, Users, BookOpen, AlertTriangle, CheckCircle, Clock,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const token = () => localStorage.getItem("aperti_token");
async function fetchJSON(url: string) {
  const res = await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

function StatCard({ label, value, icon, delta }: { label: string; value: any; icon: React.ReactNode; delta?: string }) {
  return (
    <Card className="card-hover">
      <CardContent className="p-5 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-2xl font-bold">{value ?? "—"}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          {delta && <p className="text-xs text-green-600 mt-0.5">{delta}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function InsightStream() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => fetchJSON("/analytics"),
  });

  const { data: risk, isLoading: riskLoading } = useQuery({
    queryKey: ["risk-engine"],
    queryFn: () => fetchJSON("/risk-engine"),
  });

  const riskStudents: any[] = Array.isArray(risk?.students) ? risk.students.filter((s: any) => s.riskLevel === "high" || s.riskLevel === "medium") : [];
  const subjects: any[] = Array.isArray(analytics?.subjects) ? analytics.subjects : [];

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold">Insight Stream<span className="text-primary">™</span></h1>
        <p className="text-muted-foreground">Live analytics for your classes — attendance, performance, and risk.</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <StatCard label="Avg Attendance" value={analytics?.avgAttendance ? `${analytics.avgAttendance}%` : "—"} icon={<CheckCircle className="h-5 w-5 text-primary" />} />
            <StatCard label="Avg Grade" value={analytics?.avgGrade ? `${analytics.avgGrade}%` : "—"} icon={<TrendingUp className="h-5 w-5 text-primary" />} />
            <StatCard label="At-Risk Students" value={riskStudents.length} icon={<AlertTriangle className="h-5 w-5 text-destructive" />} />
            <StatCard label="Active Subjects" value={subjects.length || analytics?.subjectCount} icon={<BookOpen className="h-5 w-5 text-primary" />} />
          </>
        )}
      </div>

      <Tabs defaultValue="performance">
        <TabsList className="mb-6">
          <TabsTrigger value="performance">Subject Performance</TabsTrigger>
          <TabsTrigger value="risk">At-Risk Students</TabsTrigger>
          <TabsTrigger value="attendance">Attendance Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Subject Performance Overview</CardTitle>
              <CardDescription>Average grades by subject across all enrolled students.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10 rounded" />)}</div>
              ) : subjects.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">No subject performance data yet.</p>
              ) : (
                <div className="space-y-4">
                  {subjects.map((s: any, i: number) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{s.name || s.subjectName}</span>
                        <span className="text-muted-foreground">{s.avgGrade ?? 0}%</span>
                      </div>
                      <Progress value={s.avgGrade ?? 0} className="h-2" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" /> At-Risk Students
              </CardTitle>
              <CardDescription>Students flagged by the Risk Engine based on attendance, grades, and engagement.</CardDescription>
            </CardHeader>
            <CardContent>
              {riskLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
              ) : riskStudents.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                  <CheckCircle className="h-10 w-10 text-green-500 opacity-60" />
                  <p>No at-risk students detected. Great work!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {riskStudents.map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-muted">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{s.displayName || s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.reason || "Low attendance / performance"}</p>
                      </div>
                      <Badge variant={s.riskLevel === "high" ? "destructive" : "secondary"} className="text-xs capitalize shrink-0">
                        {s.riskLevel} risk
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" /> Attendance Trends
              </CardTitle>
              <CardDescription>Weekly attendance rates across all classes.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-10 rounded" />)}</div>
              ) : (
                <div className="space-y-4">
                  {(analytics?.attendanceTrend ?? []).length === 0 ? (
                    <p className="text-center text-muted-foreground py-10">Attendance trend data will appear here as sessions are recorded.</p>
                  ) : (
                    (analytics.attendanceTrend as any[]).map((week: any, i: number) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{week.label ?? `Week ${i + 1}`}</span>
                          <span className="text-muted-foreground">{week.rate ?? 0}%</span>
                        </div>
                        <Progress value={week.rate ?? 0} className="h-2" />
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
