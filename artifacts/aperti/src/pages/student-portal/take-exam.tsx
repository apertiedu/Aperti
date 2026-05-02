import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, ChevronLeft, ChevronRight, CheckCircle, AlertCircle,
  Send, BookOpen, Trophy, Loader2, AlertTriangle, List
} from "lucide-react";

type Question = {
  id: number; question_text: string; topic: string | null;
  max_marks: string; question_order: number;
  question_type: string; options: string[] | null;
};

type Exam = { id: number; name: string; subject_name: string | null; total_marks: string };
type ExamSession = {
  id: number; status: string; answers: Record<string, string>;
  secondsRemaining: number | null; time_limit_minutes: number | null;
  auto_score: number | null; max_score: number | null;
};

type SessionData = { exam: Exam; session: ExamSession; questions: Question[] };

export default function TakeExam() {
  const params = useParams<{ examId: string }>();
  const examId = parseInt(params.examId, 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [showNav, setShowNav] = useState(false);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);

  const startExam = async () => {
    setStarting(true);
    const r = await fetch(`/api/portal/online-exams/${examId}/start`, {
      method: "POST", credentials: "include",
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      toast({ title: err.message || "Failed to start exam", variant: "destructive" });
      setStarting(false); return;
    }
    await loadSession();
    setStarting(false);
  };

  const loadSession = async () => {
    const r = await fetch(`/api/portal/online-exams/${examId}/session`, { credentials: "include" });
    if (!r.ok) { setLoading(false); return; }
    const d: SessionData = await r.json();
    setData(d);
    setAnswers(d.session.answers ?? {});
    if (d.session.secondsRemaining !== null) setTimeLeft(d.session.secondsRemaining);
    setLoading(false);
  };

  useEffect(() => { loadSession(); }, [examId]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || submitted) return;
    timerRef.current = setTimeout(() => setTimeLeft(t => t !== null ? t - 1 : null), 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [timeLeft, submitted]);

  useEffect(() => {
    if (timeLeft === 0 && !submitted && data?.session.status === "in_progress") {
      handleSubmit(true);
    }
  }, [timeLeft]);

  // Auto-save every 30s
  const doAutoSave = useCallback(async () => {
    if (!data?.session || submitted) return;
    setSaving(true);
    await fetch(`/api/portal/online-exams/${examId}/answers`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    setSaving(false);
  }, [answers, examId, data, submitted]);

  useEffect(() => {
    autoSaveRef.current = setInterval(doAutoSave, 30000);
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  }, [doAutoSave]);

  const handleSubmit = async (auto = false) => {
    if (submitting || submitted) return;
    if (!auto) {
      const unanswered = data?.questions.filter(q => !answers[String(q.id)]).length ?? 0;
      if (unanswered > 0) {
        const ok = window.confirm(`You have ${unanswered} unanswered question${unanswered > 1 ? "s" : ""}. Submit anyway?`);
        if (!ok) return;
      }
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    setSubmitting(true);
    const r = await fetch(`/api/portal/online-exams/${examId}/submit`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    if (r.ok) {
      const result = await r.json();
      setSubmitResult(result);
      setSubmitted(true);
    } else {
      toast({ title: "Submission failed. Please try again.", variant: "destructive" });
    }
    setSubmitting(false);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60); const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const timerColor = timeLeft !== null
    ? timeLeft < 300 ? "text-red-400" : timeLeft < 600 ? "text-amber-400" : "text-emerald-400"
    : "text-white";

  // ─── LOADING ───
  if (loading) return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
        <p className="text-slate-400 text-sm">Loading exam...</p>
      </div>
    </div>
  );

  // ─── SUBMITTED RESULTS ───
  if (submitted && submitResult) {
    const pct = submitResult.pct;
    const pending = submitResult.pendingMarking;
    return (
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-6">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full text-center space-y-6">
          <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center shadow-2xl ${
            pending ? "bg-gradient-to-br from-amber-500 to-orange-600" :
            pct >= 70 ? "bg-gradient-to-br from-emerald-500 to-teal-600" : "bg-gradient-to-br from-violet-500 to-purple-600"
          }`}>
            {pending ? <CheckCircle className="h-12 w-12 text-white" /> : <Trophy className="h-12 w-12 text-white" />}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              {pending ? "Exam Submitted!" : pct >= 80 ? "Excellent!" : pct >= 60 ? "Well Done!" : "Submitted!"}
            </h2>
            <p className="text-slate-400 text-sm">
              {pending ? "Your structured answers will be marked by your teacher." : `Auto-marking complete`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {!pending && pct !== null && (
              <div className="bg-white/10 rounded-2xl p-4">
                <p className="text-3xl font-black text-white">{pct}%</p>
                <p className="text-xs text-slate-400">Score</p>
              </div>
            )}
            {!pending && (
              <div className="bg-white/10 rounded-2xl p-4">
                <p className="text-3xl font-black text-white">{submitResult.autoScore}/{submitResult.maxScore}</p>
                <p className="text-xs text-slate-400">Marks</p>
              </div>
            )}
            <div className={`bg-white/10 rounded-2xl p-4 ${pending ? "col-span-2" : ""}`}>
              <p className="text-3xl font-black text-white">{Object.keys(answers).length}</p>
              <p className="text-xs text-slate-400">Answered</p>
            </div>
          </div>
          {pending && (
            <div className="bg-amber-500/20 border border-amber-500/40 rounded-xl p-4">
              <p className="text-sm text-amber-300 flex items-center gap-2 justify-center">
                <AlertCircle className="h-4 w-4" />Awaiting teacher marking
              </p>
            </div>
          )}
          <Button onClick={() => navigate("/exams")}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-12">
            Back to Exams
          </Button>
        </motion.div>
      </div>
    );
  }

  // ─── NO SESSION YET — START SCREEN ───
  if (!data?.session || data.session.status === "submitted") {
    const isSubmitted = data?.session?.status === "submitted";
    return (
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full space-y-6">
          <button onClick={() => navigate("/exams")} className="text-slate-500 hover:text-slate-300 flex items-center gap-1.5 text-sm transition-colors">
            <ChevronLeft className="h-4 w-4" />Back to Exams
          </button>
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto shadow-xl">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">{data?.exam?.name ?? "Loading..."}</h1>
            {data?.exam?.subject_name && <p className="text-slate-400">{data.exam.subject_name}</p>}
          </div>
          {isSubmitted ? (
            <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-xl p-5 text-center">
              <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-emerald-300 font-semibold">Already submitted</p>
              {data.session.auto_score !== null && (
                <p className="text-emerald-400 text-sm mt-1">Score: {data.session.auto_score}/{data.session.max_score}</p>
              )}
            </div>
          ) : (
            <>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Exam Info</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-slate-500">Questions</p><p className="text-white font-semibold">{data?.questions?.length ?? "—"}</p></div>
                  <div><p className="text-slate-500">Total Marks</p><p className="text-white font-semibold">{data?.exam?.total_marks ?? "—"}</p></div>
                  <div className="col-span-2 border-t border-white/10 pt-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-slate-400 text-xs">Once started, the timer begins. Answer carefully and submit when ready. Auto-save runs every 30 seconds.</p>
                    </div>
                  </div>
                </div>
              </div>
              <Button onClick={startExam} disabled={starting}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold gap-2 shadow-lg">
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                {starting ? "Starting..." : "Start Exam"}
              </Button>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  // ─── EXAM IN PROGRESS ───
  const questions = data.questions;
  const currentQ = questions[currentIdx];
  const answeredCount = questions.filter(q => answers[String(q.id)] !== undefined && answers[String(q.id)] !== "").length;

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => setShowNav(n => !n)} className="text-slate-400 hover:text-white transition-colors md:hidden">
            <List className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{data.exam.name}</p>
            <p className="text-slate-500 text-xs">{answeredCount}/{questions.length} answered</p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          {saving && <span className="text-xs text-slate-500 hidden sm:block">Saving...</span>}
          {timeLeft !== null && (
            <div className={`flex items-center gap-1.5 font-mono font-bold text-sm ${timerColor} ${timeLeft < 120 ? "animate-pulse" : ""}`}>
              <Clock className="h-4 w-4" />{formatTime(timeLeft)}
            </div>
          )}
          <Button onClick={() => handleSubmit(false)} disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 px-3 gap-1.5">
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {submitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>

      {/* Timer bar */}
      {timeLeft !== null && data.session.time_limit_minutes && (
        <div className="h-0.5 bg-white/10 flex-shrink-0">
          <div className={`h-full transition-all duration-1000 ${timerColor.replace("text-", "bg-")}`}
            style={{ width: `${(timeLeft / (data.session.time_limit_minutes * 60)) * 100}%` }} />
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Question sidebar — desktop always visible, mobile drawer */}
        <AnimatePresence>
          {(showNav || typeof window !== "undefined") && (
            <motion.div
              className={`${showNav ? "absolute inset-0 z-40 md:relative md:z-auto" : "hidden md:flex"} flex-col w-64 bg-slate-900 border-r border-white/10 flex-shrink-0`}
              initial={{ x: -264 }} animate={{ x: 0 }} exit={{ x: -264 }}>
              {showNav && <div className="md:hidden absolute inset-0 bg-black/50 -z-10" onClick={() => setShowNav(false)} />}
              <div className="p-3 border-b border-white/10">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Questions</p>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {questions.map((q, i) => {
                  const answered = !!answers[String(q.id)];
                  const active = i === currentIdx;
                  return (
                    <button key={q.id} onClick={() => { setCurrentIdx(i); setShowNav(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-xs transition-all ${
                        active ? "bg-indigo-600 text-white" :
                        answered ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30" :
                        "text-slate-400 hover:bg-white/5"
                      }`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                        active ? "bg-white/20" : answered ? "bg-emerald-500/30" : "bg-white/10"
                      }`}>{i + 1}</span>
                      <span className="truncate">{q.topic || `Q${i + 1}`}</span>
                      {answered && !active && <CheckCircle className="h-3 w-3 text-emerald-400 ml-auto flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main question area */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div key={currentIdx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} className="flex-1 p-5 md:p-8 max-w-3xl mx-auto w-full space-y-5">
              {/* Question meta */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500 font-mono">Q{currentIdx + 1}</span>
                {currentQ.topic && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {currentQ.topic}
                  </span>
                )}
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                  {currentQ.max_marks} mark{parseFloat(currentQ.max_marks) !== 1 ? "s" : ""}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${
                  currentQ.question_type === "mcq" ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                }`}>{currentQ.question_type?.toUpperCase() || "STRUCTURED"}</span>
              </div>

              {/* Question text */}
              <p className="text-lg font-medium text-white leading-relaxed">{currentQ.question_text}</p>

              {/* Answer area */}
              {currentQ.question_type === "mcq" && Array.isArray(currentQ.options) ? (
                <div className="space-y-2.5">
                  {currentQ.options.map((opt, oi) => {
                    const selected = answers[String(currentQ.id)] === String(oi);
                    return (
                      <button key={oi} onClick={() => setAnswers(a => ({ ...a, [String(currentQ.id)]: String(oi) }))}
                        className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                          selected ? "bg-indigo-600/30 border-indigo-500 text-white" :
                          "border-white/10 text-slate-300 hover:border-white/20 hover:bg-white/5"
                        }`}>
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border ${
                          selected ? "bg-indigo-500 border-indigo-400 text-white" : "border-white/20 text-slate-400"
                        }`}>{String.fromCharCode(65 + oi)}</span>
                        <span className="text-sm">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  value={answers[String(currentQ.id)] ?? ""}
                  onChange={e => setAnswers(a => ({ ...a, [String(currentQ.id)]: e.target.value }))}
                  placeholder="Write your answer here..."
                  rows={7}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-slate-600 text-sm resize-none focus:outline-none focus:border-indigo-500 transition-colors"
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation footer */}
          <div className="sticky bottom-0 bg-slate-900/90 backdrop-blur border-t border-white/10 px-5 py-3 flex items-center justify-between gap-3 flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
              disabled={currentIdx === 0} className="text-slate-400 hover:text-white gap-1">
              <ChevronLeft className="h-4 w-4" />Prev
            </Button>
            <div className="flex gap-1 flex-wrap justify-center">
              {questions.map((q, i) => {
                const answered = !!answers[String(q.id)];
                return (
                  <button key={i} onClick={() => setCurrentIdx(i)}
                    className={`w-6 h-6 rounded text-[10px] font-bold transition-all ${
                      i === currentIdx ? "bg-indigo-600 text-white" :
                      answered ? "bg-emerald-600/60 text-emerald-200" : "bg-white/10 text-slate-500"
                    }`}>{i + 1}</button>
                );
              })}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setCurrentIdx(i => Math.min(questions.length - 1, i + 1))}
              disabled={currentIdx === questions.length - 1} className="text-slate-400 hover:text-white gap-1">
              Next<ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
