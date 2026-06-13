import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, BarChart3, Clock, Target, BookOpen } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";

async function fetchJSON(url: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 240, damping: 24 } } };

export default function StudentAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ["student", "analytics"],
    queryFn: () => fetchJSON("/api/student/analytics"),
    staleTime: 60_000,
  });

  // Grade trend from gradeHistory
  const gradeData = (data?.gradeHistory ?? []).map((g: any) => ({
    date: g.examDate ? new Date(g.examDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—",
    grade: g.percentage,
  }));

  // Topic mastery radar from topicMap
  const topicMap = data?.topicMap ?? {};
  const radarData = [
    { subject: "Mastered", value: (topicMap.mastered ?? []).length * 20 },
    { subject: "Developing", value: (topicMap.developing ?? []).length * 15 },
    { subject: "Weak", value: (topicMap.weak ?? []).length > 0 ? 30 : 70 },
    { subject: "Critical", value: (topicMap.critical ?? []).length > 0 ? 10 : 80 },
    { subject: "Attendance", value: data?.attendancePct ?? 0 },
  ];

  // Study time from timeAnalytics.studyByDay
  const studyByDay = data?.timeAnalytics?.studyByDay ?? {};
  const studyBarData = Object.entries(studyByDay)
    .map(([date, minutes]) => ({
      day: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      minutes: minutes as number,
    }))
    .slice(-14);

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-background p-4 md:p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Student Analytics</h1>
            <p className="text-muted-foreground text-sm">Deep insights into your academic performance and habits.</p>
          </div>
        </div>
      </motion.div>

      {/* Summary KPIs */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Current Grade", value: data?.currentGrade != null ? `${data.currentGrade}%` : "—", icon: "📊" },
          { label: "Predicted Grade", value: data?.predictedGrade != null ? `${data.predictedGrade}%` : "—", icon: "🎯" },
          { label: "Attendance", value: `${data?.attendancePct ?? 0}%`, icon: "📅" },
          { label: "HW Completion", value: `${data?.hwCompletionRate ?? 0}%`, icon: "✅" },
        ].map(({ label, value, icon }) => (
          <Card key={label} className="shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-xl mb-1">{icon}</p>
              <p className="text-xl font-bold text-primary">{isLoading ? "…" : value}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Grade Trend */}
          <motion.div variants={item}>
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Grade Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {gradeData.length < 2 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">Not enough exam data yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={gradeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                      <Tooltip formatter={(v) => [`${v}%`, "Grade"]} />
                      <Line type="monotone" dataKey="grade" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Skill Radar */}
          <motion.div variants={item}>
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Academic Radar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                    <Radar name="Score" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} />
                    <Tooltip formatter={(v) => [`${v}`]} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* Focus Sessions Bar */}
          <motion.div variants={item}>
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Daily Focus Time (Last 14 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {studyBarData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">No focus sessions recorded yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={studyBarData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} unit="m" />
                      <Tooltip formatter={(v) => [`${v} min`, "Focus"]} />
                      <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Topic Map */}
          <motion.div variants={item}>
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Topic Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Mastered", topics: topicMap.mastered ?? [], color: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400" },
                  { label: "Developing", topics: topicMap.developing ?? [], color: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400" },
                  { label: "Weak", topics: topicMap.weak ?? [], color: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400" },
                  { label: "Critical", topics: topicMap.critical ?? [], color: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400" },
                ].map(({ label, topics, color }) => (
                  topics.length > 0 && (
                    <div key={label}>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">{label} ({topics.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {topics.map((t: string) => (
                          <Badge key={t} variant="outline" className={`text-[10px] ${color}`}>{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )
                ))}
                {Object.values(topicMap).every((arr: any) => arr?.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">Complete more topics to see your mastery map.</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Readiness Score */}
          {data?.readinessScore != null && (
            <motion.div variants={item} className="lg:col-span-2">
              <Card className="shadow-sm">
                <CardContent className="p-5 flex items-center gap-6">
                  <div className="text-center shrink-0">
                    <p className="text-4xl font-extrabold text-primary">{data.readinessScore}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Exam Readiness Score</p>
                  </div>
                  <div className="flex-1 space-y-2">
                    {[
                      { label: "Attendance (30%)", value: data.attendancePct ?? 0 },
                      { label: "HW Completion (30%)", value: data.hwCompletionRate ?? 0 },
                      { label: "Recent Quiz Average (40%)", value: data.recentQuizAvg ?? 0 },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center gap-3">
                        <p className="text-xs text-muted-foreground w-48 shrink-0">{label}</p>
                        <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${value}%` }} />
                        </div>
                        <p className="text-xs font-medium w-8 text-right">{value}%</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
