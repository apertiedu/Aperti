import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain, TrendingUp, TrendingDown, BookOpen, Zap, Target, Clock,
  AlertCircle, CheckCircle, BarChart3, Star,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";

async function fetchJSON(url: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 240, damping: 24 } } };

export default function Echo() {
  const { data, isLoading } = useQuery({
    queryKey: ["echo", "profile"],
    queryFn: () => fetchJSON("/api/echo/profile"),
  });

  const weakTopics: string[] = data?.weakTopics ?? [];
  const strongTopics: string[] = data?.strongTopics ?? [];
  const gradeHistory: { examDate: string; percentage: number }[] = data?.gradeHistory ?? [];

  const gradeChartData = gradeHistory.slice(-10).map(g => ({
    date: g.examDate ? new Date(g.examDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—",
    grade: g.percentage,
  }));

  const radarData = [
    { subject: "Confidence", value: Math.round((data?.confidenceScore ?? 0) * 100) },
    { subject: "Attendance", value: data?.attendancePct ?? 0 },
    { subject: "HW Rate", value: data?.hwCompletionRate ?? 0 },
    { subject: "Retention", value: Math.round((data?.flashcardRetention ?? 0) * 100) },
    { subject: "Consistency", value: data?.behavior?.consistencyScore != null ? Math.round(data.behavior.consistencyScore) : 50 },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-background p-4 md:p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Echo Profile</h1>
            <p className="text-muted-foreground text-sm">Your AI-powered learning memory and academic fingerprint.</p>
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Learning Profile */}
          <motion.div variants={item}>
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="h-4 w-4 text-primary" />
                  Learning Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Avg Grade", value: data?.avgGrade != null ? `${Math.round(data.avgGrade)}%` : "—", icon: "📊" },
                    { label: "Attendance", value: `${data?.attendancePct ?? 0}%`, icon: "📅" },
                    { label: "HW Rate", value: `${data?.hwCompletionRate ?? 0}%`, icon: "📝" },
                    { label: "Flashcard Retention", value: `${Math.round((data?.flashcardRetention ?? 0) * 100)}%`, icon: "🧠" },
                  ].map(({ label, value, icon }) => (
                    <div key={label} className="text-center p-3 rounded-xl bg-muted/50">
                      <p className="text-xl mb-1">{icon}</p>
                      <p className="text-lg font-bold text-primary">{value}</p>
                      <p className="text-[11px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Learning Pace</span>
                    <Badge variant="secondary" className="capitalize text-[10px]">{data?.learningPace ?? "medium"}</Badge>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Preferred Style</span>
                    <Badge variant="secondary" className="capitalize text-[10px]">{data?.preferredStyle ?? "visual"}</Badge>
                  </div>
                  <div className="flex justify-between text-xs items-center">
                    <span className="text-muted-foreground">Confidence Score</span>
                    <div className="flex items-center gap-2">
                      <Progress value={(data?.confidenceScore ?? 0) * 100} className="w-20 h-1.5" />
                      <span className="font-medium">{Math.round((data?.confidenceScore ?? 0) * 100)}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs items-center">
                    <span className="text-muted-foreground">Burnout Risk</span>
                    <div className="flex items-center gap-2">
                      <Progress value={(data?.burnoutRisk ?? 0) * 100} className="w-20 h-1.5" />
                      <Badge variant={data?.burnoutRisk > 0.7 ? "destructive" : "secondary"} className="text-[10px]">
                        {data?.burnoutRisk > 0.7 ? "High" : data?.burnoutRisk > 0.4 ? "Medium" : "Low"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Grade Trend */}
          <motion.div variants={item}>
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Grade Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {gradeChartData.length < 2 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Not enough exam data yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={gradeChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                      <Tooltip formatter={(v) => [`${v}%`, "Grade"]} />
                      <Line type="monotone" dataKey="grade" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Academic Radar */}
          <motion.div variants={item}>
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Skill Radar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <Radar name="You" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                    <Tooltip formatter={(v) => [`${v}%`]} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* Topics */}
          <motion.div variants={item}>
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Topic Mastery
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-destructive flex items-center gap-1 mb-2">
                    <AlertCircle className="h-3.5 w-3.5" /> Weak Topics
                  </p>
                  {weakTopics.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No weak topics identified yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {weakTopics.map(t => (
                        <Badge key={t} variant="outline" className="text-[11px] bg-destructive/5 border-destructive/20 text-destructive">{t}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mb-2">
                    <CheckCircle className="h-3.5 w-3.5" /> Strong Topics
                  </p>
                  {strongTopics.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Keep studying to build strengths!</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {strongTopics.map(t => (
                        <Badge key={t} variant="outline" className="text-[11px] bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">{t}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Behavior Patterns */}
          <motion.div variants={item} className="lg:col-span-2">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Behavior Patterns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Late Night Sessions", value: data?.behavior?.lateNightSessions ?? 0, warn: data?.behavior?.lateNightSessions > 3 },
                    { label: "Inactivity Streaks", value: data?.behavior?.inactivityStreaks ?? 0, warn: data?.behavior?.inactivityStreaks > 2 },
                    { label: "Pre-Exam Panic", value: data?.behavior?.preExamPanic ? "Yes" : "No", warn: data?.behavior?.preExamPanic },
                    { label: "Consistency Score", value: `${Math.round(data?.behavior?.consistencyScore ?? 0)}%`, warn: false },
                  ].map(({ label, value, warn }) => (
                    <div key={label} className={`text-center p-3 rounded-xl border ${warn ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" : "bg-muted/40 border-border"}`}>
                      <p className={`text-lg font-bold ${warn ? "text-amber-700 dark:text-amber-400" : "text-foreground"}`}>{value}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
