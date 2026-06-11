import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Target, AlertTriangle, BookOpen, Zap, CheckCircle2, Clock,
  TrendingUp, ArrowRight, Flame, BarChart3, Brain, Sparkles,
  ChevronRight, CalendarDays, Award
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { format, parseISO } from "date-fns";

const tok = () => localStorage.getItem("aperti_token") || "";
const authFetch = (url: string) => fetch(url, { headers: { Authorization: `Bearer ${tok()}` } }).then(r => r.json());

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 280, damping: 24 } } } as any;

function PriorityBadge({ level }: { level: "high" | "medium" | "low" }) {
  const cfg = {
    high:   { bg: "bg-red-100 text-red-700",   label: "High priority" },
    medium: { bg: "bg-amber-100 text-amber-700", label: "Medium" },
    low:    { bg: "bg-green-100 text-green-700", label: "Low" },
  }[level];
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg}`}>{cfg.label}</span>;
}

export default function SuccessCenter() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["student-success"],
    queryFn: () => authFetch("/api/portal/success"),
    staleTime: 60000,
  });

  const portalData = useQuery<any>({
    queryKey: ["portal-me"],
    queryFn: () => apiFetch("/api/portal/me", { credentials: "include" }).then(r => r.json()),
    staleTime: 60000,
  });

  const stats = portalData.data?.stats;
  const weakTopics: any[] = data?.weakTopics || [];
  const upcomingTasks: any[] = data?.upcomingTasks || [];
  const recommendedRevision: any[] = data?.recommendedRevision || [];
  const recentMistakes: any[] = data?.recentMistakes || [];
  const overallProgress = data?.overallProgress;

  if (isLoading || portalData.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 skeleton rounded-xl w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 skeleton rounded-2xl" />)}
        </div>
        <div className="h-64 skeleton rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <Target className="w-6 h-6 text-primary" />
          </div>
          Success Center
        </h1>
        <p className="text-muted-foreground text-sm mt-1.5 ml-0.5">Your personal study command centre — know exactly what to work on next.</p>
      </motion.div>

      {/* Progress overview */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div variants={fadeUp} className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 text-primary-foreground relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-10"><BarChart3 className="w-24 h-24" /></div>
          <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 opacity-80" /><span className="text-xs font-bold opacity-80 uppercase tracking-wide">Attendance</span></div>
          <p className="text-4xl font-black">{stats?.attendanceRate ?? 0}%</p>
          <p className="text-xs opacity-70 mt-1">{(stats?.attendanceRate ?? 0) >= 90 ? "Excellent — keep it up!" : (stats?.attendanceRate ?? 0) >= 75 ? "Good, push for 90%" : "Needs improvement"}</p>
        </motion.div>
        <motion.div variants={fadeUp} className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3 text-violet-600"><Brain className="w-4 h-4" /><span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Weak Topics</span></div>
          <p className="text-4xl font-black text-foreground">{weakTopics.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{weakTopics.length === 0 ? "Nothing detected — great work!" : `${weakTopics.length} topic${weakTopics.length > 1 ? "s" : ""} to improve`}</p>
        </motion.div>
        <motion.div variants={fadeUp} className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3 text-amber-600"><Flame className="w-4 h-4" /><span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Study Streak</span></div>
          <p className="text-4xl font-black text-foreground">{stats?.streak ?? 0}<span className="text-lg font-bold ml-1 text-muted-foreground">days</span></p>
          <p className="text-xs text-muted-foreground mt-1">{(stats?.streak ?? 0) > 0 ? "Don't break the chain!" : "Start your streak today"}</p>
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Weak Topics */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-red-50/50">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <Brain className="w-4 h-4 text-red-500" /> Weak Topics
              </h2>
              <Link href="/echo">
                <span className="text-xs text-primary font-semibold cursor-pointer flex items-center gap-1 hover:text-primary/80">Echo AI <ChevronRight className="w-3 h-3" /></span>
              </Link>
            </div>
            {weakTopics.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-3 opacity-60" />
                <p className="text-sm font-semibold">No weak topics detected</p>
                <p className="text-xs mt-1">Keep practising to maintain your mastery.</p>
                <Link href="/practice"><span className="mt-3 text-xs text-primary font-semibold cursor-pointer hover:underline">Start a practice session →</span></Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {weakTopics.slice(0, 5).map((t: any, i: number) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.06 }}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${t.severity === "high" ? "bg-red-500" : t.severity === "medium" ? "bg-amber-500" : "bg-yellow-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{t.topic || t.pattern || "Unknown topic"}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.subject || t.subjectName || "General"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <PriorityBadge level={t.severity || "medium"} />
                      <Link href="/practice">
                        <span className="flex items-center gap-1 text-xs text-primary font-bold cursor-pointer hover:underline">
                          Practice <ArrowRight className="w-3 h-3" />
                        </span>
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Upcoming Assessments & Tasks */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-amber-50/50">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-amber-500" /> Coming Up
              </h2>
              <Link href="/homework">
                <span className="text-xs text-primary font-semibold cursor-pointer flex items-center gap-1 hover:text-primary/80">All tasks <ChevronRight className="w-3 h-3" /></span>
              </Link>
            </div>
            {upcomingTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-3 opacity-60" />
                <p className="text-sm font-semibold">All caught up!</p>
                <p className="text-xs mt-1">No upcoming tasks or deadlines.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {upcomingTasks.slice(0, 5).map((t: any, i: number) => {
                  const isOverdue = t.dueDate && t.dueDate < new Date().toISOString().split("T")[0];
                  return (
                    <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.06 }}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors">
                      <div className={`p-2 rounded-xl shrink-0 ${t.type === "exam" ? "bg-violet-100" : "bg-amber-100"}`}>
                        {t.type === "exam" ? <Award className="w-4 h-4 text-violet-600" /> : <BookOpen className="w-4 h-4 text-amber-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground">{t.subjectName || "General"}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {t.dueDate ? (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isOverdue ? "bg-red-100 text-red-600" : "bg-muted text-muted-foreground"}`}>
                            {isOverdue ? "Overdue" : format(new Date(t.dueDate), "dd MMM")}
                          </span>
                        ) : <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />Soon</span>}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Recommended Revision */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-primary/5">
            <h2 className="font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Recommended Revision
            </h2>
            <Link href="/revision">
              <span className="text-xs text-primary font-semibold cursor-pointer flex items-center gap-1 hover:text-primary/80">All notes <ChevronRight className="w-3 h-3" /></span>
            </Link>
          </div>
          {recommendedRevision.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <BookOpen className="w-10 h-10 text-primary/30 mb-3" />
              <p className="text-sm font-semibold">No revision notes yet</p>
              <p className="text-xs mt-1">Your teacher hasn't published any revision notes yet.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
              {recommendedRevision.slice(0, 6).map((r: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 + i * 0.05 }}>
                  <Link href={r.href || "/revision"}>
                    <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group">
                      <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                        <BookOpen className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{r.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.subjectName || "General"}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Recent Mistakes */}
      {recentMistakes.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-red-50/40">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <Zap className="w-4 h-4 text-red-500" /> Recent Mistakes — Revisit
              </h2>
              <Link href="/practice">
                <span className="text-xs text-primary font-semibold cursor-pointer flex items-center gap-1 hover:text-primary/80">Practice all <ChevronRight className="w-3 h-3" /></span>
              </Link>
            </div>
            <div className="divide-y divide-border">
              {recentMistakes.slice(0, 4).map((m: any, i: number) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{m.questionText || "Practice question"}</p>
                    <p className="text-xs text-muted-foreground">{m.topic || m.subjectName || "General"} · {m.examName || "Assessment"}</p>
                  </div>
                  <Link href="/practice">
                    <span className="flex items-center gap-1 text-xs text-primary font-bold cursor-pointer hover:underline shrink-0">
                      Retry <ArrowRight className="w-3 h-3" />
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Empty overall state */}
      {weakTopics.length === 0 && upcomingTasks.length === 0 && recentMistakes.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-bold text-foreground">You're fully on track!</h3>
          <p className="text-muted-foreground text-sm mt-2 max-w-sm">No weak topics, no overdue tasks, and no recent mistakes. Keep up the excellent work.</p>
          <Link href="/practice">
            <button className="mt-4 flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
              <Zap className="w-4 h-4" /> Start a practice session
            </button>
          </Link>
        </motion.div>
      )}
    </div>
  );
}
