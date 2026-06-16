import { apiFetch } from "@/lib/api";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Target, Clock, CheckCircle, XCircle, ChevronRight,
  Trophy, BookMarked, Filter, Zap, Eye, Maximize2,
  AlertCircle, BarChart2, Lock, Unlock
} from "lucide-react";

type Question = {
  id: number; questionText: string; topic: string | null; subtopic: string | null;
  difficulty: string; maxMarks: string; modelAnswer: string | null; subjectName: string | null;
};

const DIFF_COLORS: Record<string, string> = {
  easy: "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-red-100 text-red-700",
};

const DIFF_BAR_COLORS: Record<string, string> = {
  easy: "bg-green-500", medium: "bg-amber-500", hard: "bg-red-500",
};

type SessionMode = "select" | "quiz" | "simulation" | "results";

export default function PracticeExams() {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [selectedDiff, setSelectedDiff] = useState<string>("");
  const [mode, setMode] = useState<SessionMode>("select");
  const [quizCards, setQuizCards] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [scores, setScores] = useState<boolean[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [timedMode, setTimedMode] = useState(false);
  const [simulationMode, setSimulationMode] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedTopic) params.set("topic", selectedTopic);
      if (selectedDiff) params.set("difficulty", selectedDiff);
      const r = await apiFetch(`/api/portal/practice-questions?${params}`, { credentials: "include" });
      if (r.ok) {
        const data: Question[] = await r.json();
        setQuestions(data);
        const uniqueTopics = [...new Set(data.map(q => q.topic).filter(Boolean))] as string[];
        setTopics(uniqueTopics);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [selectedTopic, selectedDiff]);

  const startQuiz = (count: number, timed: boolean, simulation = false) => {
    const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, count);
    if (!shuffled.length) { toast({ title: "No questions available", description: "Adjust your filters and try again." }); return; }
    setQuizCards(shuffled); setCurrentIdx(0); setShowAnswer(false);
    setScores([]); setTimedMode(timed); setSimulationMode(simulation);
    setSessionStartTime(Date.now());
    if (timed || simulation) {
      const t = simulation ? shuffled.length * 90 : shuffled.length * 60;
      setTimeLeft(t); setTotalTime(t);
    }
    setMode(simulation ? "simulation" : "quiz");
  };

  useEffect(() => {
    const isActive = (mode === "quiz" || mode === "simulation") && timedMode && timeLeft > 0;
    if (isActive) {
      timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    }
    if (timedMode && timeLeft === 0 && (mode === "quiz" || mode === "simulation")) {
      if (timerRef.current) clearTimeout(timerRef.current);
      finishSession();
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [mode, timedMode, timeLeft]);

  const finishSession = async () => {
    const timeTaken = Math.floor((Date.now() - sessionStartTime) / 1000);
    const correct = scores.filter(Boolean).length;
    const total = scores.length;
    if (total > 0) {
      try {
        await apiFetch("/api/portal/practice-sessions", {
          method: "POST", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questions: quizCards.map(q => q.id), score: correct, total, timeTakenSeconds: timeTaken }),
        });
        await apiFetch("/api/portal/achievements/check", { method: "POST" });
      } catch { /* non-critical */ }
    }
    setMode("results");
  };

  const handleAnswer = (correct: boolean) => {
    const newScores = [...scores, correct];
    setScores(newScores);
    const next = currentIdx + 1;
    if (next >= quizCards.length) {
      if (timerRef.current) clearTimeout(timerRef.current);
      const timeTaken = Math.floor((Date.now() - sessionStartTime) / 1000);
      const sc = newScores.filter(Boolean).length;
      const tot = newScores.length;
      if (tot > 0) {
        apiFetch("/api/portal/practice-sessions", {
          method: "POST", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questions: quizCards.map(q => q.id), score: sc, total: tot, timeTakenSeconds: timeTaken }),
        }).catch(() => {});
        apiFetch("/api/portal/achievements/check", { method: "POST" }).catch(() => {});
      }
      setMode("results");
    } else { setCurrentIdx(next); setShowAnswer(false); }
  };

  const currentQ = quizCards[currentIdx];
  const totalMarks = quizCards.reduce((a, q) => a + parseFloat(q.maxMarks || "1"), 0);
  const earnedMarks = quizCards.slice(0, scores.length).reduce((a, q, i) => a + (scores[i] ? parseFloat(q.maxMarks || "1") : 0), 0);
  const pct = scores.length > 0 ? Math.round((scores.filter(Boolean).length / scores.length) * 100) : 0;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timerPct = totalTime > 0 ? (timeLeft / totalTime) * 100 : 100;
  const isLowTime = timedMode && timeLeft < 60;

  // Topic breakdown for results
  const topicBreakdown = quizCards.slice(0, scores.length).reduce<Record<string, { correct: number; total: number }>>((acc, q, i) => {
    const t = q.topic || "Other";
    if (!acc[t]) acc[t] = { correct: 0, total: 0 };
    acc[t].total++;
    if (scores[i]) acc[t].correct++;
    return acc;
  }, {});

  // SIMULATION MODE — focused full-screen-style
  if (mode === "simulation" && currentQ) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col">
        {/* Simulation header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-red-400" />
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Exam Simulation</span>
            </div>
            <span className="text-xs text-white/40">{currentIdx + 1} / {quizCards.length}</span>
          </div>
          <div className={`flex items-center gap-2 text-lg font-mono font-bold ${isLowTime ? "text-red-400 animate-pulse" : "text-white"}`}>
            <Clock className="h-5 w-5" />
            {mins}:{secs.toString().padStart(2, "0")}
          </div>
          <button onClick={() => { if (timerRef.current) clearTimeout(timerRef.current); setMode("select"); }}
            className="text-xs text-white/40 hover:text-white/80 transition-colors">
            Exit Simulation
          </button>
        </div>

        {/* Timer bar */}
        <div className="h-1 bg-white/10">
          <motion.div className={`h-full transition-colors ${timerPct > 50 ? "bg-emerald-500" : timerPct > 25 ? "bg-amber-500" : "bg-red-500"}`}
            style={{ width: `${timerPct}%` }} transition={{ duration: 1, ease: "linear" }} />
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1 py-3 px-6">
          {quizCards.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${
              i < scores.length ? (scores[i] ? "bg-emerald-500" : "bg-red-500") :
              i === currentIdx ? "bg-white w-4" : "bg-white/20"
            } ${i !== currentIdx ? "w-1.5" : ""}`} />
          ))}
        </div>

        {/* Question area */}
        <div className="flex-1 overflow-y-auto flex items-center justify-center p-6">
          <div className="w-full max-w-2xl space-y-6">
            <AnimatePresence mode="wait">
              <motion.div key={currentIdx} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }} className="space-y-4">
                <div className="flex flex-wrap gap-2 items-center">
                  {currentQ.topic && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                      {currentQ.topic}
                    </span>
                  )}
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                    currentQ.difficulty === "hard" ? "bg-red-500/20 text-red-300 border-red-500/30" :
                    currentQ.difficulty === "medium" ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
                    "bg-green-500/20 text-green-300 border-green-500/30"
                  }`}>{currentQ.difficulty}</span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-white/60 border border-white/10">
                    {currentQ.maxMarks} mark{parseFloat(currentQ.maxMarks) !== 1 ? "s" : ""}
                  </span>
                </div>

                <p className="text-xl font-medium leading-relaxed text-white">{currentQ.questionText}</p>

                <AnimatePresence>
                  {showAnswer && currentQ.modelAnswer && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                      <p className="text-xs font-bold text-emerald-400 uppercase tracking-wide mb-2">Model Answer</p>
                      <p className="text-sm text-emerald-100 whitespace-pre-wrap leading-relaxed">{currentQ.modelAnswer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Action area */}
        <div className="px-6 py-4 border-t border-white/10 bg-slate-900/80">
          <div className="max-w-2xl mx-auto">
            {!showAnswer ? (
              <Button onClick={() => setShowAnswer(true)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white gap-2 h-12 text-sm font-semibold">
                <Eye className="h-4 w-4" />Reveal Answer
              </Button>
            ) : (
              <div className="flex gap-3">
                <Button onClick={() => handleAnswer(false)}
                  className="flex-1 h-12 gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30">
                  <XCircle className="h-4 w-4" />Incorrect
                </Button>
                <Button onClick={() => handleAnswer(true)}
                  className="flex-1 h-12 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
                  <CheckCircle className="h-4 w-4" />Correct
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // NORMAL QUIZ MODE
  if (mode === "quiz" && currentQ) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { setMode("select"); if (timerRef.current) clearTimeout(timerRef.current); }}
            className="text-muted-foreground">← Exit</Button>
          <div className="flex items-center gap-4">
            {timedMode && (
              <div className={`flex items-center gap-1.5 text-sm font-mono font-semibold ${isLowTime ? "text-red-600" : "text-muted-foreground"}`}>
                <Clock className="h-3.5 w-3.5" />{mins}:{secs.toString().padStart(2, "0")}
              </div>
            )}
            <span className="text-sm text-muted-foreground">{currentIdx + 1}/{quizCards.length}</span>
          </div>
        </div>

        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
            animate={{ width: `${((currentIdx) / quizCards.length) * 100}%` }} />
        </div>

        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              {currentQ.topic && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{currentQ.topic}</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFF_COLORS[currentQ.difficulty] || "bg-muted text-muted-foreground"}`}>{currentQ.difficulty}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{currentQ.maxMarks} mark{parseFloat(currentQ.maxMarks) !== 1 ? "s" : ""}</span>
            </div>
            <p className="text-base font-medium leading-relaxed">{currentQ.questionText}</p>

            <AnimatePresence>
              {showAnswer && currentQ.modelAnswer && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800">
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">Model Answer</p>
                  <p className="text-sm text-emerald-800 dark:text-emerald-300 whitespace-pre-wrap">{currentQ.modelAnswer}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {!showAnswer ? (
              <Button onClick={() => setShowAnswer(true)} variant="outline" className="w-full gap-2">
                <Eye className="h-4 w-4" />Reveal Answer
              </Button>
            ) : (
              <div className="flex gap-3">
                <Button onClick={() => handleAnswer(false)} variant="outline"
                  className="flex-1 gap-2 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400">
                  <XCircle className="h-4 w-4" />Incorrect
                </Button>
                <Button onClick={() => handleAnswer(true)}
                  className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle className="h-4 w-4" />Correct
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // RESULTS SCREEN
  if (mode === "results") {
    const sortedTopics = Object.entries(topicBreakdown).sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total);
    return (
      <div className="flex flex-col gap-6 max-w-lg mx-auto py-8">
        <motion.div className="text-center" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }}>
          <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-xl mx-auto mb-4 ${pct >= 70 ? "bg-gradient-to-br from-amber-400 to-orange-500" : "bg-gradient-to-br from-slate-400 to-slate-500"}`}>
            <Trophy className="h-12 w-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold">{pct >= 90 ? "Outstanding!" : pct >= 70 ? "Well Done!" : pct >= 50 ? "Good Effort!" : "Keep Practicing!"}</h2>
          <p className="text-muted-foreground text-sm">{simulationMode ? "Simulation complete" : `Completed ${scores.length} questions`}</p>
        </motion.div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <Card className="border-border/50">
            <CardContent className="pt-4 pb-3">
              <p className="text-3xl font-black text-emerald-600">{scores.filter(Boolean).length}</p>
              <p className="text-xs text-muted-foreground">Correct</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-4 pb-3">
              <p className="text-3xl font-black text-primary">{pct}%</p>
              <p className="text-xs text-muted-foreground">Score</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-4 pb-3">
              <p className="text-3xl font-black text-amber-600">{earnedMarks.toFixed(0)}/{totalMarks.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Marks</p>
            </CardContent>
          </Card>
        </div>

        {/* Topic analysis */}
        {sortedTopics.length > 1 && (
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-bold flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-primary" />Topic Performance
              </p>
              {sortedTopics.map(([topic, { correct, total }]) => {
                const topicPct = Math.round((correct / total) * 100);
                const diff = topicPct < 50 ? "hard" : topicPct < 75 ? "medium" : "easy";
                return (
                  <div key={topic} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-foreground truncate">{topic}</span>
                      <span className={`font-bold ${topicPct < 50 ? "text-red-600" : topicPct < 75 ? "text-amber-600" : "text-emerald-600"}`}>
                        {correct}/{total} ({topicPct}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div className={`h-full rounded-full ${DIFF_BAR_COLORS[diff]}`}
                        initial={{ width: 0 }} animate={{ width: `${topicPct}%` }} transition={{ delay: 0.2, duration: 0.5 }} />
                    </div>
                  </div>
                );
              })}
              {sortedTopics.length > 0 && sortedTopics[0][1].correct / sortedTopics[0][1].total < 0.6 && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Focus on <strong>{sortedTopics[0][0]}</strong> — your weakest topic this session.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Per-question breakdown */}
        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
          {quizCards.slice(0, scores.length).map((q, i) => (
            <div key={q.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs ${
              scores[i] ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20"
                        : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20"
            }`}>
              {scores[i] ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                         : <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />}
              <p className="text-foreground line-clamp-2">{q.questionText}</p>
            </div>
          ))}
        </div>

        <Button onClick={() => setMode("select")} className="gap-2 w-full">
          <ChevronRight className="h-4 w-4" />Practice Again
        </Button>
      </div>
    );
  }

  // SELECT MODE (home screen)
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Target className="h-6 w-6 text-amber-600" />Practice Exams
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Sharpen your skills with question bank practice.</p>
      </div>

      {/* Filters */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-semibold flex items-center gap-2"><Filter className="h-4 w-4 text-primary" />Filter Questions</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSelectedTopic("")}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${!selectedTopic ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              All Topics
            </button>
            {topics.map(t => (
              <button key={t} onClick={() => setSelectedTopic(t === selectedTopic ? "" : t)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${selectedTopic === t ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-950/30 dark:text-blue-300"}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {["", "easy", "medium", "hard"].map(d => (
              <button key={d} onClick={() => setSelectedDiff(d)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${selectedDiff === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                {d || "Any Difficulty"}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="flex gap-3">
        <Card className="flex-1 border-border/50">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-primary">{loading ? "..." : questions.length}</p>
            <p className="text-xs text-muted-foreground">Available</p>
          </CardContent>
        </Card>
        <Card className="flex-1 border-border/50">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{topics.length}</p>
            <p className="text-xs text-muted-foreground">Topics</p>
          </CardContent>
        </Card>
      </div>

      {/* Practice modes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { title: "Quick 10",       desc: "10 questions, no time limit",         count: 10,  timed: false, sim: false, icon: BookMarked, color: "from-blue-500 to-indigo-600" },
          { title: "Timed Challenge", desc: "20 questions with a countdown",      count: 20,  timed: true,  sim: false, icon: Clock,      color: "from-orange-500 to-amber-600" },
          { title: "Full Practice",  desc: "All questions, no limit",             count: 999, timed: false, sim: false, icon: Target,     color: "from-emerald-500 to-primary/80" },
          { title: "Sprint (5)",     desc: "5 questions, quick drill",            count: 5,   timed: false, sim: false, icon: Zap,        color: "from-violet-500 to-purple-600" },
        ].map(m => (
          <button key={m.title} onClick={() => startQuiz(Math.min(m.count, questions.length), m.timed, m.sim)}
            disabled={loading || questions.length === 0}
            className="group text-left p-4 rounded-xl border border-border/50 bg-card hover:shadow-md hover:border-primary/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform`}>
              <m.icon className="h-5 w-5 text-white" />
            </div>
            <p className="font-semibold text-sm">{m.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
          </button>
        ))}
      </div>

      {/* Exam Simulation — full-width featured card */}
      <button onClick={() => startQuiz(Math.min(15, questions.length), true, true)}
        disabled={loading || questions.length === 0}
        className="group w-full text-left p-5 rounded-xl border-0 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg flex-shrink-0 group-hover:scale-110 transition-transform">
            <Maximize2 className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-bold text-white">Exam Simulation Mode</p>
              <Badge className="bg-indigo-500/30 text-indigo-300 border-indigo-500/40 text-[10px]">NEW</Badge>
            </div>
            <p className="text-sm text-slate-400">Full immersion · Focus mode · Dark UI · Timed · Post-exam analysis</p>
          </div>
          <Lock className="h-5 w-5 text-indigo-400 flex-shrink-0" />
        </div>
      </button>

      {/* Question bank preview */}
      {!loading && questions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Question Bank Preview</h2>
          <div className="space-y-2">
            {questions.slice(0, 5).map(q => (
              <div key={q.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-muted/20">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${DIFF_COLORS[q.difficulty] || "bg-muted text-muted-foreground"}`}>{q.difficulty}</span>
                <p className="text-sm text-foreground line-clamp-2">{q.questionText}</p>
                <span className="text-xs text-muted-foreground shrink-0">{q.maxMarks}m</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && questions.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Target className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No questions available</p>
          <p className="text-sm mt-1">Your teacher hasn't added questions to the bank yet</p>
        </div>
      )}
    </div>
  );
}
