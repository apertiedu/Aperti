import { apiFetch } from "@/lib/api";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Award, TrendingUp, TrendingDown, Minus, Monitor, Play, CheckCircle, Clock, BookOpen, ChevronRight } from "lucide-react";
import DiscussButton from "@/components/discuss-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ExamResult = {
  examId: number; examName: string; examDate: string | null;
  scored: number; max: number; percentage: number;
};

type OnlineExam = {
  id: number; name: string; subject_name: string | null;
  exam_date: string | null; total_marks: string; question_count: number;
  session_id: number | null; session_status: string | null;
  submitted_at: string | null; auto_score: number | null; max_score: number | null;
};

function gradeFromPct(pct: number) {
  if (pct >= 90) return { grade: "A*", color: "text-emerald-600", bg: "bg-emerald-100" };
  if (pct >= 80) return { grade: "A",  color: "text-emerald-500", bg: "bg-emerald-50" };
  if (pct >= 70) return { grade: "B",  color: "text-blue-600",    bg: "bg-blue-100" };
  if (pct >= 60) return { grade: "C",  color: "text-indigo-600",  bg: "bg-indigo-100" };
  if (pct >= 50) return { grade: "D",  color: "text-amber-600",   bg: "bg-amber-100" };
  if (pct >= 40) return { grade: "E",  color: "text-orange-600",  bg: "bg-orange-100" };
  return { grade: "U", color: "text-red-600", bg: "bg-red-100" };
}

function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "bg-emerald-400" : pct >= 60 ? "bg-blue-400" : pct >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-muted rounded-full h-2">
        <motion.div className={`h-2 rounded-full ${color}`} style={{ width: 0 }}
          animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }} />
      </div>
      <span className="text-sm font-bold text-foreground w-10 text-right">{pct}%</span>
    </div>
  );
}

export default function MyExams() {
  const [, navigate] = useLocation();
  const [results, setResults] = useState<ExamResult[]>([]);
  const [onlineExams, setOnlineExams] = useState<OnlineExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"results" | "online">("online");

  useEffect(() => {
    Promise.all([
      apiFetch("/api/portal/exams", { credentials: "include" }).then(r => r.ok ? r.json() : []).catch(() => []),
      apiFetch("/api/portal/online-exams", { credentials: "include" }).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([res, online]) => {
      setResults(res);
      setOnlineExams(online);
    }).finally(() => setLoading(false));
  }, []);

  const avg = results.length > 0 ? Math.round(results.reduce((a, r) => a + r.percentage, 0) / results.length) : null;
  const best = results.length > 0 ? Math.max(...results.map(r => r.percentage)) : null;
  const trend = results.length >= 2 ? results[results.length - 1].percentage - results[results.length - 2].percentage : null;

  const available = onlineExams.filter(e => !e.session_id);
  const inProgress = onlineExams.filter(e => e.session_status === "in_progress");
  const done = onlineExams.filter(e => e.session_status === "submitted" || e.session_status === "expired");

  if (loading) return (
    <div className="space-y-4">
      <div className="h-8 skeleton rounded-xl w-52" />
      <div className="grid grid-cols-3 gap-3">{[1,2,3].map(i => <div key={i} className="h-20 skeleton rounded-xl" />)}</div>
      <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
          <Award className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">My Exams</h1>
          <p className="text-xs text-muted-foreground">Results & online exams</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl border border-border/50 p-1 bg-muted/30">
        {(["online", "results"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "online"
              ? `Take Online${inProgress.length > 0 ? ` (${inProgress.length} active)` : available.length > 0 ? ` (${available.length})` : ""}`
              : `Past Results (${results.length})`}
          </button>
        ))}
      </div>

      {/* ONLINE EXAMS TAB */}
      {tab === "online" && (
        <div className="space-y-5">
          {/* In Progress */}
          {inProgress.length > 0 && (
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />Continue ({inProgress.length})
              </p>
              <div className="space-y-2">
                {inProgress.map(exam => (
                  <Card key={exam.id} className="border-blue-200 dark:border-blue-800 overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-500" />
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{exam.name}</p>
                        <p className="text-xs text-muted-foreground">{exam.subject_name ?? "General"} · {exam.question_count} questions</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <DiscussButton contextType="exam" contextId={exam.id} contextTitle={exam.name} size="sm" />
                        <Button size="sm" onClick={() => navigate(`/exams/${exam.id}/take`)}
                          className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                          <Play className="h-3.5 w-3.5" />Resume
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Available */}
          {available.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Available to Take</p>
              <div className="space-y-2">
                {available.map(exam => (
                  <motion.div key={exam.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="border-border/50 overflow-hidden hover:border-indigo-300 transition-colors">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <Monitor className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">{exam.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {exam.subject_name ?? "General"} · {exam.question_count} questions
                            {exam.total_marks && ` · ${exam.total_marks} marks`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <DiscussButton contextType="exam" contextId={exam.id} contextTitle={exam.name} size="sm" />
                          <Button size="sm" onClick={() => navigate(`/exams/${exam.id}/take`)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
                            <Play className="h-3.5 w-3.5" />Start
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {done.length > 0 && (
            <div>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" />Completed
              </p>
              <div className="space-y-2">
                {done.map(exam => (
                  <Card key={exam.id} className="border-border/50 opacity-75">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-primary/80 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{exam.name}</p>
                        <p className="text-xs text-muted-foreground">{exam.subject_name ?? "General"}</p>
                      </div>
                      {exam.auto_score !== null && exam.max_score !== null ? (
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-emerald-600">{exam.auto_score}/{exam.max_score}</p>
                          <p className="text-[10px] text-muted-foreground">Auto-score</p>
                        </div>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] flex-shrink-0">Awaiting mark</Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {onlineExams.length === 0 && (
            <div className="text-center py-16">
              <Monitor className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
              <p className="font-semibold text-foreground mb-1">No online exams yet</p>
              <p className="text-sm text-muted-foreground">Your teacher will assign online exams here</p>
            </div>
          )}
        </div>
      )}

      {/* RESULTS TAB */}
      {tab === "results" && (
        <div className="space-y-5">
          {results.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Average",    value: avg !== null ? `${avg}%` : "—",  ...(avg !== null ? gradeFromPct(avg) : { color: "text-muted-foreground", bg: "bg-muted/40" }) },
                { label: "Best Score", value: best !== null ? `${best}%` : "—", ...(best !== null ? gradeFromPct(best) : { color: "text-muted-foreground", bg: "bg-muted/40" }) },
                { label: "Trend",      value: trend !== null ? `${trend > 0 ? "+" : ""}${trend}%` : "—",
                  color: trend !== null ? (trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-600" : "text-muted-foreground") : "text-muted-foreground",
                  bg: trend !== null ? (trend > 0 ? "bg-emerald-50" : trend < 0 ? "bg-red-50" : "bg-muted/40") : "bg-muted/40" },
              ].map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className={`${s.bg} rounded-xl p-3 border border-border/40`}>
                  <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
                  <p className={`text-xl font-black mt-0.5 ${s.color}`}>{s.value}</p>
                </motion.div>
              ))}
            </div>
          )}

          {results.length === 0 ? (
            <div className="text-center py-16">
              <Award className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
              <p className="font-semibold text-foreground mb-1">No results yet</p>
              <p className="text-sm text-muted-foreground">Scores appear here once your teacher marks exams</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...results].reverse().map((result, i) => {
                const { grade, color, bg } = gradeFromPct(result.percentage);
                return (
                  <motion.div key={result.examId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card className="border-border/50">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-foreground truncate">{result.examName}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {result.examDate ? new Date(result.examDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "No date"}
                              {" · "}{result.scored}/{result.max} marks
                            </p>
                          </div>
                          <div className={`${bg} px-3 py-1.5 rounded-xl text-center flex-shrink-0`}>
                            <p className={`text-xl font-black ${color}`}>{grade}</p>
                            <p className="text-[10px] text-muted-foreground">{result.percentage}%</p>
                          </div>
                        </div>
                        <ProgressBar pct={result.percentage} />
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
