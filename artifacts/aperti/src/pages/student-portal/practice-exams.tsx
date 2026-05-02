import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Target, Clock, CheckCircle, XCircle, ChevronRight,
  Trophy, BookMarked, Filter, Zap, Eye
} from "lucide-react";

type Question = {
  id: number; questionText: string; topic: string | null; subtopic: string | null;
  difficulty: string; maxMarks: string; modelAnswer: string | null; subjectName: string | null;
};

const DIFF_COLORS: Record<string, string> = {
  easy: "bg-green-100 text-green-700", medium: "bg-amber-100 text-amber-700",
  hard: "bg-red-100 text-red-700",
};

export default function PracticeExams() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [selectedDiff, setSelectedDiff] = useState<string>("");
  const [mode, setMode] = useState<"select" | "quiz" | "results">("select");
  const [quizCards, setQuizCards] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [scores, setScores] = useState<boolean[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timedMode, setTimedMode] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedTopic) params.set("topic", selectedTopic);
      if (selectedDiff) params.set("difficulty", selectedDiff);
      const r = await fetch(`/api/portal/practice-questions?${params}`, { credentials: "include" });
      if (r.ok) {
        const data: Question[] = await r.json();
        setQuestions(data);
        const uniqueTopics = [...new Set(data.map(q => q.topic).filter(Boolean))] as string[];
        setTopics(uniqueTopics);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [selectedTopic, selectedDiff]);

  const startQuiz = (count: number, timed: boolean) => {
    const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, count);
    if (!shuffled.length) return;
    setQuizCards(shuffled); setCurrentIdx(0); setShowAnswer(false);
    setScores([]); setTimedMode(timed);
    if (timed) { setTimeLeft(shuffled.length * 60); }
    setMode("quiz");
  };

  useEffect(() => {
    if (mode === "quiz" && timedMode && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    }
    if (timedMode && timeLeft === 0 && mode === "quiz") setMode("results");
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [mode, timedMode, timeLeft]);

  const handleAnswer = (correct: boolean) => {
    const newScores = [...scores, correct];
    setScores(newScores);
    const next = currentIdx + 1;
    if (next >= quizCards.length) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMode("results");
    } else { setCurrentIdx(next); setShowAnswer(false); }
  };

  const currentQ = quizCards[currentIdx];
  const totalMarks = quizCards.reduce((a, q) => a + parseFloat(q.maxMarks || "1"), 0);
  const earnedMarks = quizCards.slice(0, scores.length).reduce((a, q, i) => a + (scores[i] ? parseFloat(q.maxMarks || "1") : 0), 0);
  const pct = scores.length > 0 ? Math.round((scores.filter(Boolean).length / scores.length) * 100) : 0;

  if (mode === "quiz" && currentQ) {
    const mins = Math.floor(timeLeft / 60); const secs = timeLeft % 60;
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { setMode("select"); if (timerRef.current) clearTimeout(timerRef.current); }} className="text-muted-foreground">← Exit</Button>
          <div className="flex items-center gap-4">
            {timedMode && (
              <div className={`flex items-center gap-1.5 text-sm font-mono font-semibold ${timeLeft < 60 ? "text-red-600" : "text-muted-foreground"}`}>
                <Clock className="h-3.5 w-3.5" />{mins}:{secs.toString().padStart(2,"0")}
              </div>
            )}
            <span className="text-sm text-muted-foreground">{currentIdx + 1}/{quizCards.length}</span>
          </div>
        </div>

        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
            animate={{ width: `${(currentIdx / quizCards.length) * 100}%` }} />
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
                  className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">Model Answer</p>
                  <p className="text-sm text-emerald-800 whitespace-pre-wrap">{currentQ.modelAnswer}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {!showAnswer ? (
              <Button onClick={() => setShowAnswer(true)} variant="outline" className="w-full gap-2">
                <Eye className="h-4 w-4" />Reveal Answer
              </Button>
            ) : (
              <div className="flex gap-3">
                <Button onClick={() => handleAnswer(false)} variant="outline" className="flex-1 gap-2 border-red-200 text-red-700 hover:bg-red-50">
                  <XCircle className="h-4 w-4" />Incorrect
                </Button>
                <Button onClick={() => handleAnswer(true)} className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle className="h-4 w-4" />Correct
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === "results") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-6 max-w-md mx-auto">
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }}>
          <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-xl ${pct >= 70 ? "bg-gradient-to-br from-amber-400 to-orange-500" : "bg-gradient-to-br from-slate-400 to-slate-500"}`}>
            <Trophy className="h-12 w-12 text-white" />
          </div>
        </motion.div>
        <div className="text-center">
          <h2 className="text-2xl font-bold">{pct >= 90 ? "Outstanding!" : pct >= 70 ? "Well Done!" : pct >= 50 ? "Good Effort!" : "Keep Practicing!"}</h2>
          <p className="text-muted-foreground">You completed {scores.length} questions</p>
        </div>
        <div className="grid grid-cols-3 gap-6 text-center w-full">
          <div><p className="text-3xl font-black text-emerald-600">{scores.filter(Boolean).length}</p><p className="text-xs text-muted-foreground">Correct</p></div>
          <div><p className="text-3xl font-black text-primary">{pct}%</p><p className="text-xs text-muted-foreground">Score</p></div>
          <div><p className="text-3xl font-black text-amber-600">{earnedMarks}/{totalMarks}</p><p className="text-xs text-muted-foreground">Marks</p></div>
        </div>

        {/* Per-question breakdown */}
        <div className="w-full space-y-2 max-h-48 overflow-y-auto">
          {quizCards.slice(0, scores.length).map((q, i) => (
            <div key={q.id} className={`flex items-start gap-3 p-3 rounded-lg border ${scores[i] ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
              {scores[i] ? <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />}
              <p className="text-xs text-foreground line-clamp-2">{q.questionText}</p>
            </div>
          ))}
        </div>
        <Button onClick={() => setMode("select")} className="gap-2"><ChevronRight className="h-4 w-4" />Practice Again</Button>
      </div>
    );
  }

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
            <button onClick={() => setSelectedTopic("")} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${!selectedTopic ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              All Topics
            </button>
            {topics.map(t => (
              <button key={t} onClick={() => setSelectedTopic(t === selectedTopic ? "" : t)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${selectedTopic === t ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700 hover:bg-blue-200"}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
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
            <p className="text-xs text-muted-foreground">Questions Available</p>
          </CardContent>
        </Card>
        <Card className="flex-1 border-border/50">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{topics.length}</p>
            <p className="text-xs text-muted-foreground">Topics</p>
          </CardContent>
        </Card>
      </div>

      {/* Start modes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { title: "Quick 10", desc: "10 random questions, no time limit", count: 10, timed: false, icon: BookMarked, color: "from-blue-500 to-indigo-600" },
          { title: "Timed Challenge", desc: "20 questions with a countdown timer", count: 20, timed: true, icon: Clock, color: "from-orange-500 to-amber-600" },
          { title: "Full Practice", desc: "All filtered questions, unlimited time", count: 999, timed: false, icon: Target, color: "from-emerald-500 to-teal-600" },
          { title: "Sprint (5)", desc: "5 hardest questions for a quick drill", count: 5, timed: false, icon: Zap, color: "from-violet-500 to-purple-600" },
        ].map(m => (
          <button key={m.title} onClick={() => startQuiz(Math.min(m.count, questions.length), m.timed)}
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

      {/* Recent questions preview */}
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
    </div>
  );
}
