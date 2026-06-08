import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen, CalendarCheck, Clock, CheckCircle, AlertCircle, Zap, Target,
  TrendingUp, Flame, ArrowRight, Brain, FlaskConical, Layers, Trophy,
  Sparkles, Star, Calendar, BarChart3, Route, Shield,
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/context/auth";

const token = () => localStorage.getItem("aperti_token");

async function fetchJSON(url: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function CircularProgress({ value, size = 96 }: { value: number; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={6} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="hsl(var(--primary))" strokeWidth={6} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - value / 100) }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
    </svg>
  );
}

export default function StudyStream() {
  const { user } = useAuth();

  const { data: summary, isLoading } = useQuery({
    queryKey: ["student", "home-summary"],
    queryFn: () => fetchJSON("/api/student/home-summary"),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const { data: goalsData } = useQuery({
    queryKey: ["focus-coach", "goals"],
    queryFn: () => fetchJSON("/api/focus-coach/goals"),
    staleTime: 30_000,
  });

  const { data: recData } = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => fetchJSON("/api/recommendations"),
    staleTime: 60_000,
  });

  const { data: masteryData } = useQuery({
    queryKey: ["mastery", 0],
    queryFn: () => fetchJSON("/api/mastery/0"),
    staleTime: 60_000,
  });

  const displayName = summary?.student?.studentName || user?.displayName || "Student";
  const firstName = displayName.split(" ")[0];
  const greeting = `${getGreeting()}, ${firstName}!`;

  const dailyGoals = goalsData?.today ?? [];
  const completedGoals = dailyGoals.filter((g: any) => g.completedAt).length;
  const goalProgress = dailyGoals.length > 0 ? Math.round((completedGoals / dailyGoals.length) * 100) : 0;

  const ascend = summary?.ascend;
  const snapshot = summary?.academicSnapshot;
  const nextExam = summary?.nextExam;

  const daysToExam = nextExam
    ? Math.ceil((new Date(nextExam.examDate).getTime() - Date.now()) / 86400000)
    : null;

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
  const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 240, damping: 24 } } };

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-background p-4 md:p-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {isLoading ? <Skeleton className="h-8 w-56" /> : greeting}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          {ascend && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-sm font-semibold">
                <Flame className="h-4 w-4" />
                {summary?.streakDays ?? 0} day streak
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Top stats row */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "XP Today", value: isLoading ? "…" : `+${summary?.ascend?.xp ?? 0}`, icon: <Zap className="h-4 w-4 text-yellow-500" />, color: "bg-yellow-50 dark:bg-yellow-900/20" },
          { label: "Current Level", value: isLoading ? "…" : `Lv ${ascend?.level ?? 1}`, icon: <Star className="h-4 w-4 text-primary" />, color: "bg-primary/5" },
          { label: "Attendance", value: isLoading ? "…" : `${snapshot?.attendancePct ?? 0}%`, icon: <CheckCircle className="h-4 w-4 text-emerald-500" />, color: "bg-emerald-50 dark:bg-emerald-900/20" },
          { label: "HW Done", value: isLoading ? "…" : `${snapshot?.hwCompletionRate ?? 0}%`, icon: <BookOpen className="h-4 w-4 text-blue-500" />, color: "bg-blue-50 dark:bg-blue-900/20" },
        ].map(({ label, value, icon, color }) => (
          <motion.div key={label} variants={item}>
            <Card className="shadow-sm">
              <CardContent className={`p-3 flex items-center gap-3 rounded-xl ${color}`}>
                <div className="w-9 h-9 rounded-xl bg-white/70 dark:bg-white/10 flex items-center justify-center shrink-0">
                  {icon}
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-none">{value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left/main column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Goal progress + exam countdown */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Daily goal progress */}
            <Card className="shadow-sm">
              <CardContent className="p-4 flex items-center gap-5">
                <div className="relative shrink-0">
                  <CircularProgress value={goalProgress} size={80} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-primary">{goalProgress}%</span>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-sm">Daily Goals</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {completedGoals} of {dailyGoals.length} complete
                  </p>
                  <Link href="/focus-coach">
                    <Button size="sm" variant="link" className="h-6 p-0 text-xs text-primary mt-1">
                      View goals <ArrowRight className="h-3 w-3 ml-0.5" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Exam countdown or mission */}
            {daysToExam !== null && daysToExam >= 0 ? (
              <Card className="shadow-sm border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-amber-600" />
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Exam Countdown</span>
                  </div>
                  <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-400">
                    {daysToExam} {daysToExam === 1 ? "day" : "days"}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5 truncate">
                    {nextExam.name}
                  </p>
                  <Link href="/revisit">
                    <Button size="sm" className="mt-2 h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white">
                      Start Revision
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-primary">Daily Mission</span>
                  </div>
                  <p className="text-sm font-medium leading-snug">
                    {summary?.dailyMission?.text || "Review your weak topics today"}
                  </p>
                  {summary?.dailyMission?.actionUrl && (
                    <Link href={summary.dailyMission.actionUrl}>
                      <Button size="sm" variant="outline" className="mt-2 h-7 text-xs">
                        Start <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}
          </motion.div>

          {/* AI Insight */}
          {summary?.aiInsight && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className="shadow-sm border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-primary mb-1">AI Insight</p>
                    <p className="text-sm text-foreground leading-relaxed">{summary.aiInsight}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Upcoming Homework */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="shadow-sm">
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Upcoming Homework
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {isLoading ? (
                  <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
                ) : (summary?.upcomingHomework?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No upcoming homework 🎉</p>
                ) : (
                  <div className="space-y-2">
                    {summary.upcomingHomework.slice(0, 4).map((hw: any) => (
                      <div key={hw.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted/70 transition-colors">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{hw.title}</p>
                          <p className="text-xs text-muted-foreground">{hw.subjectName} · Due {hw.dueDate}</p>
                        </div>
                        <Badge variant={hw.submissionStatus ? "secondary" : "default"} className="text-[10px] shrink-0 ml-2">
                          {hw.submissionStatus ? <><CheckCircle className="h-3 w-3 mr-1" />Done</> : <><AlertCircle className="h-3 w-3 mr-1" />Pending</>}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                <Link href="/my-homework">
                  <Button variant="ghost" size="sm" className="w-full justify-between mt-2 text-xs">
                    View all homework <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          {/* Academic Snapshot */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="shadow-sm">
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Academic Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Avg Grade", value: snapshot?.currentGrade != null ? `${snapshot.currentGrade}%` : "—" },
                    { label: "Target", value: snapshot?.targetGrade != null ? `${snapshot.targetGrade}%` : "—" },
                    { label: "Attendance", value: `${snapshot?.attendancePct ?? 0}%` },
                    { label: "HW Rate", value: `${snapshot?.hwCompletionRate ?? 0}%` },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center p-3 rounded-xl bg-muted/40">
                      <p className="text-lg font-bold text-primary">{isLoading ? "…" : value}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* AI Recommendations Preview */}
          {(recData?.recommendations?.length ?? 0) > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="shadow-sm">
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Recommended for You
                    </div>
                    <Link href="/recommendations">
                      <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-primary">
                        See all <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {recData.recommendations.slice(0, 3).map((rec: any) => (
                    <Link key={rec.id} href={rec.actionUrl ?? "/"}>
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{rec.title}</p>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{rec.reason}</p>
                        </div>
                        {rec.urgent && (
                          <Badge variant="destructive" className="text-[10px] h-4 ml-2 shrink-0">Urgent</Badge>
                        )}
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-2 shrink-0" />
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Mastery Progress */}
          {(masteryData?.total ?? 0) > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <Card className="shadow-sm">
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-primary" />
                      Mastery Progress
                    </div>
                    <Link href="/learning-path">
                      <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-primary">
                        View path <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Overall mastery</span>
                        <span className="font-bold text-primary">{masteryData.masteryPct}%</span>
                      </div>
                      <Progress value={masteryData.masteryPct} className="h-2.5" />
                    </div>
                    <div className="text-center shrink-0">
                      <p className="text-lg font-bold text-primary">{masteryData.total}</p>
                      <p className="text-[10px] text-muted-foreground">topics</p>
                    </div>
                  </div>
                  {(masteryData.weakTopics?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] text-muted-foreground mr-1">Focus on:</span>
                      {masteryData.weakTopics.slice(0, 3).map((t: string) => (
                        <Badge key={t} variant="outline" className="text-[10px] h-4 border-amber-300 text-amber-700 dark:text-amber-400">{t}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Ascend Progress */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
            <Card className="shadow-sm">
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Flame className="h-4 w-4 text-primary" />
                  Ascend Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {isLoading ? <Skeleton className="h-20 rounded-xl" /> : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center text-xl font-bold text-primary">
                        {ascend?.level ?? 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">Level {ascend?.level ?? 1}</span>
                          <Badge variant="secondary" className="text-[10px]">{ascend?.rank ?? "Bronze"}</Badge>
                        </div>
                        <Progress value={((ascend?.xp ?? 0) % 500) / 5} className="h-2" />
                        <p className="text-[10px] text-muted-foreground mt-1">{ascend?.xp ?? 0} XP · {ascend?.archetype ?? "Explorer"}</p>
                      </div>
                    </div>
                  </>
                )}
                <Link href="/ascend">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    View Full Profile <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <Card className="shadow-sm">
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4 text-primary" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { href: "/mentor", label: "The Mentor", icon: Brain, color: "text-purple-500" },
                    { href: "/revisit", label: "Revisit", icon: Target, color: "text-blue-500" },
                    { href: "/focus-zone", label: "FocusZone", icon: Clock, color: "text-teal-500" },
                    { href: "/learning-path", label: "Learn Path", icon: Route, color: "text-primary" },
                    { href: "/challenges", label: "Challenges", icon: Trophy, color: "text-amber-500" },
                    { href: "/goals", label: "Goals", icon: Shield, color: "text-emerald-500" },
                    { href: "/micro-assessment", label: "Quick Quiz", icon: Zap, color: "text-yellow-500" },
                    { href: "/learning-analytics", label: "Analytics", icon: BarChart3, color: "text-blue-500" },
                    { href: "/simverse", label: "SimVerse", icon: FlaskConical, color: "text-orange-500" },
                    { href: "/flashcards", label: "Flashcards", icon: Layers, color: "text-green-500" },
                    { href: "/my-homework", label: "Assignments", icon: BookOpen, color: "text-rose-500" },
                    { href: "/recommendations", label: "For You", icon: Sparkles, color: "text-violet-500" },
                  ].map(({ href, label, icon: Icon, color }) => (
                    <Link key={href} href={href}>
                      <button className="w-full flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors">
                        <Icon className={`h-5 w-5 ${color}`} />
                        <span className="text-[11px] font-medium text-foreground">{label}</span>
                      </button>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Active Goals preview */}
          {(summary?.activeGoals?.length ?? 0) > 0 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
              <Card className="shadow-sm">
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Trophy className="h-4 w-4 text-primary" />
                    Active Goals
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {summary.activeGoals.slice(0, 3).map((g: any) => (
                    <div key={g.id} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="truncate text-xs">{g.title}</span>
                      <Badge variant="secondary" className="text-[9px] ml-auto shrink-0">+{g.xpReward} XP</Badge>
                    </div>
                  ))}
                  <Link href="/focus-coach">
                    <Button variant="ghost" size="sm" className="w-full justify-between mt-1 text-xs">
                      All goals <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
