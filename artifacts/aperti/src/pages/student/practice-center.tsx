import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Brain, Target, Clock, CheckCircle, XCircle, BarChart3, Zap,
  ChevronRight, RefreshCw, Star, TrendingUp, BookOpen, Play,
  Timer, Award, Eye,
} from "lucide-react";

const API = "/api";
async function fetchJSON(url: string, opts?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

type Mode = "home" | "session" | "results";

export default function PracticeCenter() {
  const [mode, setMode] = useState<Mode>("home");
  const [subject, setSubject] = useState("all");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<{ id: number; answer: string; correct: boolean | null }[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);
  const [sessionResults, setSessionResults] = useState<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qc = useQueryClient();

  const { data: subjectsList } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => fetchJSON("/subjects"),
  });

  const { data: recommended, isLoading: recLoading } = useQuery({
    queryKey: ["practice-recommend", subject],
    queryFn: () => fetchJSON(`/practice/recommend?${subject !== "all" ? `subject=${subject}` : ""}&limit=20`),
  });

  const startSession = useMutation({
    mutationFn: (data: any) => fetchJSON("/practice/sessions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (sess) => {
      setSessionId(sess.id);
      const qs = recommended?.recommended || [];
      setQuestions(qs.slice(0, 10));
      setQIdx(0);
      setAnswers([]);
      setTimeSpent(0);
      setShowAnswer(false);
      setMode("session");
      timerRef.current = setInterval(() => setTimeSpent(p => p + 1), 1000);
    },
  });

  const endSession = useMutation({
    mutationFn: (data: any) => fetchJSON(`/practice/sessions/${sessionId}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: (result) => {
      setSessionResults(result);
      setMode("results");
      if (timerRef.current) clearInterval(timerRef.current);
    },
  });

  useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

  const currentQ = questions[qIdx];
  const correct = answers.filter(a => a.correct === true).length;
  const answered = answers.filter(a => a.correct !== null).length;

  const markAnswer = (isCorrect: boolean) => {
    setAnswers(prev => {
      const existing = prev.findIndex(a => a.id === currentQ.id);
      const entry = { id: currentQ.id, answer: "", correct: isCorrect };
      if (existing >= 0) { const arr = [...prev]; arr[existing] = entry; return arr; }
      return [...prev, entry];
    });
  };

  const nextQuestion = () => {
    setShowAnswer(false);
    if (qIdx < questions.length - 1) {
      setQIdx(p => p + 1);
    } else {
      const totalCorrect = answers.filter(a => a.correct).length + (showAnswer ? 0 : 0);
      endSession.mutate({
        questionsAnswered: questions.length,
        correct: answers.filter(a => a.correct).length,
        timeSpent,
        answers,
        ended: true,
      });
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const diffColors: Record<string, string> = { easy: "bg-green-100 text-green-700", medium: "bg-amber-100 text-amber-700", hard: "bg-red-100 text-red-700" };

  if (mode === "home") {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><Brain className="text-teal-600" size={28} /> Practice Center</h1>
            <p className="text-gray-500 mt-1">Adaptive practice questions tailored to your learning gaps</p>
          </motion.div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Target, label: "Questions Answered", value: "—", color: "text-teal-600" },
              { icon: TrendingUp, label: "Avg Accuracy", value: "—%", color: "text-blue-600" },
              { icon: Award, label: "Sessions Done", value: "—", color: "text-purple-600" },
            ].map((s, i) => (
              <Card key={i} className="bg-white border-0 shadow-sm">
                <CardContent className="pt-5 pb-4 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center`}><s.icon size={20} className={s.color} /></div>
                  <div><p className="text-xs text-gray-500">{s.label}</p><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p></div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-white border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Start Practice Session</CardTitle>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="w-48"><SelectValue placeholder="All subjects" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {(subjectsList || []).map((s: any) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="space-y-4">
              {recLoading ? (
                <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                    {(recommended?.recommended || []).slice(0, 8).map((q: any, i: number) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <p className="text-xs text-gray-700 line-clamp-2 mb-2">{q.question_text}</p>
                        <div className="flex gap-2 flex-wrap">
                          {q.difficulty && <Badge className={`text-xs ${diffColors[q.difficulty] || "bg-gray-100"}`}>{q.difficulty}</Badge>}
                          {q.topic && <Badge className="text-xs bg-teal-100 text-teal-700">{q.topic}</Badge>}
                          {q.max_marks && <Badge variant="outline" className="text-xs">{q.max_marks}m</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {(recommended?.recommended || []).length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <BookOpen size={36} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No questions available for this subject yet</p>
                    </div>
                  )}
                  <Button
                    onClick={() => startSession.mutate({ subject: subject !== "all" ? subject : undefined, topics: [] })}
                    disabled={startSession.isPending || (recommended?.recommended || []).length === 0}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12 text-base"
                  >
                    <Play size={18} className="mr-2" /> {startSession.isPending ? "Starting..." : `Start Session (${Math.min((recommended?.recommended || []).length, 10)} questions)`}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (mode === "results" && sessionResults) {
    const score = sessionResults.score || 0;
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full space-y-6">
          <Card className="bg-white border-0 shadow-lg overflow-hidden">
            <div className={`h-3 ${score >= 80 ? "bg-green-500" : score >= 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${score}%` }} />
            <CardContent className="py-10 text-center space-y-4">
              <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center text-3xl font-bold text-white ${score >= 80 ? "bg-green-500" : score >= 60 ? "bg-amber-500" : "bg-red-500"}`}>
                {score}%
              </div>
              <h2 className="text-2xl font-bold text-gray-800">{score >= 80 ? "Excellent!" : score >= 60 ? "Good work!" : "Keep practising!"}</h2>
              <div className="grid grid-cols-3 gap-4 py-4">
                <div><p className="text-2xl font-bold text-teal-600">{sessionResults.correct}</p><p className="text-xs text-gray-500">Correct</p></div>
                <div><p className="text-2xl font-bold text-red-500">{sessionResults.questions_answered - sessionResults.correct}</p><p className="text-xs text-gray-500">Incorrect</p></div>
                <div><p className="text-2xl font-bold text-gray-700">{formatTime(timeSpent)}</p><p className="text-xs text-gray-500">Time</p></div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => { setMode("home"); setSessionId(null); }}>
                  <RefreshCw size={14} className="mr-1" /> New Session
                </Button>
                <Button className="flex-1 bg-teal-600 hover:bg-teal-700 text-white" onClick={() => setMode("home")}>Done</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (mode === "session" && currentQ) {
    const progress = ((qIdx + 1) / questions.length) * 100;
    const currentAnswer = answers.find(a => a.id === currentQ.id);
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-start justify-center pt-16">
        <div className="max-w-2xl w-full space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="outline">{qIdx + 1} / {questions.length}</Badge>
              {currentQ.difficulty && <Badge className={`text-xs ${diffColors[currentQ.difficulty] || "bg-gray-100"}`}>{currentQ.difficulty}</Badge>}
              {currentQ.topic && <Badge className="text-xs bg-teal-100 text-teal-700">{currentQ.topic}</Badge>}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Timer size={14} /> {formatTime(timeSpent)}
            </div>
          </div>
          <Progress value={progress} className="h-2" />

          {/* Question */}
          <motion.div key={qIdx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <Card className="bg-white border-0 shadow-md">
              <CardContent className="py-8 space-y-6">
                {currentQ.command_word && <Badge className="text-xs bg-blue-100 text-blue-700">{currentQ.command_word}</Badge>}
                <p className="text-lg text-gray-800 leading-relaxed">{currentQ.question_text}</p>
                {currentQ.max_marks && <p className="text-sm text-gray-400">[{currentQ.max_marks} mark{currentQ.max_marks > 1 ? "s" : ""}]</p>}

                <AnimatePresence>
                  {showAnswer && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="border-l-4 border-teal-400 bg-teal-50 rounded-r-xl p-4">
                      <p className="text-xs font-semibold text-teal-700 mb-1">Model Answer</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{currentQ.model_answer || "No model answer available."}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-3 flex-wrap">
                  {!showAnswer && (
                    <Button variant="outline" onClick={() => setShowAnswer(true)} className="flex-1">
                      <Eye size={14} className="mr-1" /> Show Answer
                    </Button>
                  )}
                  {showAnswer && !currentAnswer && (
                    <>
                      <Button onClick={() => { markAnswer(true); }} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                        <CheckCircle size={14} className="mr-1" /> Got it right
                      </Button>
                      <Button onClick={() => { markAnswer(false); }} variant="outline" className="flex-1 border-red-300 text-red-600 hover:bg-red-50">
                        <XCircle size={14} className="mr-1" /> Got it wrong
                      </Button>
                    </>
                  )}
                  {currentAnswer && (
                    <Button onClick={nextQuestion} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white">
                      {qIdx < questions.length - 1 ? <><ChevronRight size={14} className="mr-1" /> Next Question</> : "Finish Session"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Mini score */}
          <div className="flex items-center justify-between text-xs text-gray-500 px-1">
            <span className="flex items-center gap-1 text-green-600"><CheckCircle size={12} /> {correct} correct</span>
            <span className="flex items-center gap-1 text-red-500"><XCircle size={12} /> {answered - correct} wrong</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
