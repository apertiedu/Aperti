import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, Brain, Target, Zap, CheckCircle2, BookOpen,
  Calendar, BarChart3, Flame, Star, Trophy, AlertTriangle,
} from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area,
} from "recharts";


async function fetchJSON(url: string) {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

const MASTERY_COLORS: Record<string, string> = {
  not_started: "#94a3b8", introduced: "#60a5fa", practicing: "#f59e0b",
  developing: "#f97316", mastered: "#10b981", expert: "#8b5cf6",
};

export default function LearningAnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics-learning"],
    queryFn: () => fetchJSON("/api/analytics/learning"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const stats = [
    { label: "Mastery", value: `${data?.masteryPct ?? 0}%`, icon: <Brain className="h-4 w-4 text-purple-500" />, bg: "bg-purple-50 dark:bg-purple-950/20" },
    { label: "Engagement", value: `${data?.engagementScore ?? 0}`, icon: <Zap className="h-4 w-4 text-primary" />, bg: "bg-primary/5" },
    { label: "Predicted Grade", value: `${data?.predictedGrade ?? 0}%`, icon: <TrendingUp className="h-4 w-4 text-emerald-500" />, bg: "bg-emerald-50 dark:bg-emerald-950/20" },
    { label: "Study Hours", value: `${data?.studyHours ?? 0}h`, icon: <Flame className="h-4 w-4 text-orange-500" />, bg: "bg-orange-50 dark:bg-orange-950/20" },
    { label: "Goal Rate", value: `${data?.goalRate ?? 0}%`, icon: <Target className="h-4 w-4 text-blue-500" />, bg: "bg-blue-50 dark:bg-blue-950/20" },
    { label: "Avg Grade", value: `${data?.avgGrade ?? 0}%`, icon: <Star className="h-4 w-4 text-yellow-500" />, bg: "bg-yellow-50 dark:bg-yellow-950/20" },
    { label: "Attendance", value: `${data?.attendancePct ?? 0}%`, icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />, bg: "bg-emerald-50 dark:bg-emerald-950/20" },
    { label: "Assessments", value: `${data?.assessmentAvg ?? 0}%`, icon: <BookOpen className="h-4 w-4 text-rose-500" />, bg: "bg-rose-50 dark:bg-rose-950/20" },
  ];

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

  // Build snapshot trend data
  const snapshots = (data?.snapshots ?? []).slice().reverse();
  const trendData = snapshots.map((s: any) => ({
    date: s.date?.slice(5) ?? "", // MM-DD
    mastery: s.metrics?.masteryPct ?? 0,
    engagement: s.metrics?.engagementScore ?? 0,
    grade: s.metrics?.predictedGrade ?? 0,
  }));

  // Mastery state distribution
  const masteryDist = Object.entries(
    (data?.mastery ?? []).reduce((acc: Record<string, number>, r: any) => {
      acc[r.masteryState] = (acc[r.masteryState] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([state, count]) => ({ state, count, color: MASTERY_COLORS[state] ?? "#94a3b8" }));

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-background p-4 md:p-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-primary" /> Learning Analytics
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Your complete performance picture, updated in real time</p>
      </motion.div>

      {/* Stats grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {stats.map(({ label, value, icon, bg }) => (
            <motion.div key={label} variants={item}>
              <Card className="shadow-sm">
                <CardContent className={`p-3 flex items-center gap-3 rounded-xl ${bg}`}>
                  <div className="w-9 h-9 rounded-xl bg-white/60 dark:bg-white/10 flex items-center justify-center shrink-0">{icon}</div>
                  <div>
                    <p className="text-lg font-bold leading-none">{value}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Radar chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="shadow-sm">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" /> Performance Radar
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {isLoading ? <Skeleton className="h-56 rounded-xl" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={data?.radarData ?? []}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Radar name="You" dataKey="score" stroke="#0D9488" fill="#0D9488" fillOpacity={0.2} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Trend over time */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="shadow-sm">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Progress Over Time
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {isLoading ? <Skeleton className="h-56 rounded-xl" /> : trendData.length === 0 ? (
                <div className="h-56 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                  <BarChart3 className="h-8 w-8 opacity-30" />
                  <p>Data builds up as you use Aperti daily</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Area type="monotone" dataKey="mastery" stroke="#8b5cf6" fill="#8b5cf620" strokeWidth={2} name="Mastery" />
                    <Area type="monotone" dataKey="engagement" stroke="#0D9488" fill="#0D948820" strokeWidth={2} name="Engagement" />
                    <Area type="monotone" dataKey="grade" stroke="#f59e0b" fill="#f59e0b20" strokeWidth={2} name="Grade" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Mastery distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="shadow-sm">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" /> Mastery Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {isLoading ? <Skeleton className="h-32 rounded-xl" /> : masteryDist.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No mastery data yet</p>
              ) : masteryDist.map(({ state, count, color }: { state: string; count: number; color: string }) => {
                const total = (data?.mastery ?? []).length;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={state}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="capitalize font-medium" style={{ color }}>{state.replace("_", " ")}</span>
                      <span className="text-muted-foreground">{count} topic{count !== 1 ? "s" : ""} ({pct}%)</span>
                    </div>
                    <Progress value={pct} className="h-2" style={{ "--progress-color": color } as any} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Strong topics */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="shadow-sm">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="h-4 w-4 text-emerald-500" /> Strengths
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-1.5">
              {isLoading ? <Skeleton className="h-24 rounded-xl" /> : (
                (data?.masteredTopics?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground py-3 text-center">No mastered topics yet — keep practising!</p>
                ) : (
                  (data.masteredTopics as string[]).slice(0, 6).map((t: string) => (
                    <div key={t} className="flex items-center gap-2 text-xs py-1 px-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span className="truncate font-medium text-emerald-700 dark:text-emerald-400">{t}</span>
                    </div>
                  ))
                )
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Weak topics */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="shadow-sm">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Focus Areas
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-1.5">
              {isLoading ? <Skeleton className="h-24 rounded-xl" /> : (
                (data?.weakTopics?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground py-3 text-center">No weak areas identified yet</p>
                ) : (
                  (data.weakTopics as string[]).slice(0, 6).map((t: string) => (
                    <div key={t} className="flex items-center gap-2 text-xs py-1 px-2 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="truncate font-medium text-amber-700 dark:text-amber-400">{t}</span>
                    </div>
                  ))
                )
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
