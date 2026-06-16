import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Timer, AlertTriangle, Flag, ArrowLeft, ArrowRight, CheckCircle2, BookOpen, Star, Bookmark, Type, Hash, Lightbulb, EyeOff, Copy, ClipboardX, ShieldAlert } from "lucide-react";
import { useLocation } from "wouter";
import { MathRenderer } from "@/components/math-renderer";

const API = "/api";

// ── Theory Answer Editor ──────────────────────────────────────────────────────
function TheoryAnswerEditor({ value, onChange, marks }: { value: string; onChange: (v: string) => void; marks: number }) {
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const chars = value.length;
  const targetWords = Math.max(marks * 30, 40);
  const pct = Math.min((words / targetWords) * 100, 100);
  const quality =
    words === 0 ? "empty"
    : words < targetWords * 0.25 ? "too-short"
    : words < targetWords * 0.6 ? "developing"
    : words < targetWords * 1.1 ? "good"
    : "detailed";
  const qualityConfig = {
    empty:     { label: "Not started",  bar: "bg-gray-200",   text: "text-gray-400" },
    "too-short": { label: "Too brief",  bar: "bg-red-400",    text: "text-red-500" },
    developing:{ label: "Developing",  bar: "bg-amber-400",  text: "text-amber-600" },
    good:      { label: "Good length", bar: "bg-primary",   text: "text-primary" },
    detailed:  { label: "Detailed",    bar: "bg-green-500",  text: "text-green-600" },
  };
  const qc = qualityConfig[quality];
  const rows = Math.max(6, Math.ceil(marks * 2.5));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-1.5">
        <Lightbulb className="h-3 w-3 text-amber-500 shrink-0" />
        <span>
          {marks === 1 && "1 mark — give one clear, specific point."}
          {marks === 2 && "2 marks — state two distinct points or one explained point."}
          {marks >= 3 && marks <= 4 && `${marks} marks — aim for ${marks} developed points with supporting evidence.`}
          {marks >= 5 && marks <= 6 && `${marks} marks — structure your answer: state → explain → example for each point.`}
          {marks > 6 && `${marks} marks — write a structured response with introduction, ${marks - 2} developed points, and a conclusion.`}
        </span>
      </div>
      <Textarea
        rows={rows}
        placeholder={`Write your answer here… (target ~${targetWords} words for ${marks} mark${marks !== 1 ? "s" : ""})`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm resize-y leading-relaxed"
      />
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-300 ${qc.bar}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-semibold ${qc.text}`}>{qc.label}</span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Type className="h-2.5 w-2.5" />{words}w
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Hash className="h-2.5 w-2.5" />{chars}
          </span>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

type ConfidenceLevel = "low" | "medium" | "high" | null;

const CONFIDENCE_CONFIG: { level: ConfidenceLevel; label: string; color: string; bg: string }[] = [
  { level: "low",    label: "Unsure",     color: "text-red-600",    bg: "bg-red-50 border-red-200" },
  { level: "medium", label: "Fairly sure", color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
  { level: "high",   label: "Confident",   color: "text-green-600",  bg: "bg-green-50 border-green-200" },
];

export default function TakeExam() {
  const [location, setLocation] = useLocation();
  const examId = parseInt(location.split("/").pop() || "0");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [confidence, setConfidence] = useState<Record<number, ConfidenceLevel>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [violations, setViolations] = useState(0);
  const [pasteAttempts, setPasteAttempts] = useState(0);
  const [copyAttempts, setCopyAttempts] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [showViolationModal, setShowViolationModal] = useState(false);
  const [violationModalType, setViolationModalType] = useState<"tab" | "paste" | "copy">("tab");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartTimeRef = useRef<Record<number, number>>({});
  const answerTimesRef = useRef<Record<number, number>>({});
  const pendingViolationsRef = useRef<{ tab?: boolean; paste?: boolean; copy?: boolean }>({});
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["exam", "take", examId],
    queryFn: async () => {
      const res = await fetch(`${API}/exams/student/${examId}/take`, {
        headers: {},
      });
      return res.json();
    },
  });

  useEffect(() => {
    if (data?.exam?.timeLimitMinutes) {
      setTimeLeft(data.exam.timeLimitMinutes * 60);
    }
  }, [data?.exam?.timeLimitMinutes]);

  // ── Track question start time ─────────────────────────────────────────────
  useEffect(() => {
    questionStartTimeRef.current[currentQuestion] = Date.now();
  }, [currentQuestion]);

  // ── Heartbeat — send violations to backend every 30s ─────────────────────
  useEffect(() => {
    heartbeatRef.current = setInterval(async () => {
      const pending = pendingViolationsRef.current;
      if (!Object.values(pending).some(Boolean)) return;
      pendingViolationsRef.current = {};
      try {
        const sessionToken = sessionStorage.getItem(`exam_session_${examId}`);
        if (!sessionToken) return;
        await fetch(`${API}/exam-session/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_token: sessionToken,
            tab_switch: pending.tab ?? false,
            focus_loss: pending.tab ?? false,
            paste_attempt: pending.paste ?? false,
            copy_attempt: pending.copy ?? false,
          }),
        });
      } catch { /* non-critical */ }
    }, 30_000);
    return () => clearInterval(heartbeatRef.current!);
  }, [examId]);

  // ── Tab-switch / visibility detection ────────────────────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && !submitted) {
        setViolations((v) => v + 1);
        setViolationModalType("tab");
        setShowViolationModal(true);
        pendingViolationsRef.current.tab = true;
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [submitted]);

  // ── Copy/paste blocking & counting ───────────────────────────────────────
  useEffect(() => {
    const blockCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      setCopyAttempts((n) => n + 1);
      setViolationModalType("copy");
      setShowViolationModal(true);
      pendingViolationsRef.current.copy = true;
    };
    const blockPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      setPasteAttempts((n) => n + 1);
      setViolationModalType("paste");
      setShowViolationModal(true);
      pendingViolationsRef.current.paste = true;
    };
    document.addEventListener("copy", blockCopy);
    document.addEventListener("paste", blockPaste);
    return () => {
      document.removeEventListener("copy", blockCopy);
      document.removeEventListener("paste", blockPaste);
    };
  }, []);

  const submitMutation = useMutation({
    mutationFn: (answersArray: any[]) =>
      fetch(`${API}/exams/student/${examId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: answersArray,
          integrityData: {
            violations,
            pasteAttempts,
            copyAttempts,
            answerTimes: answerTimesRef.current,
          },
        }),
      }),
    onSuccess: () => setSubmitted(true),
  });

  useEffect(() => {
    if (timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAnswerChange = (questionId: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const toggleFlag = (questionId: number) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      next.has(questionId) ? next.delete(questionId) : next.add(questionId);
      return next;
    });
  };

  const setConfidenceLevel = (questionId: number, level: ConfidenceLevel) => {
    setConfidence((prev) => ({
      ...prev,
      [questionId]: prev[questionId] === level ? null : level,
    }));
  };

  const navigateQuestion = useCallback((idx: number) => {
    const now = Date.now();
    const startTime = questionStartTimeRef.current[currentQuestion];
    if (startTime) {
      answerTimesRef.current[currentQuestion] = (answerTimesRef.current[currentQuestion] ?? 0) + (now - startTime);
    }
    setCurrentQuestion(idx);
  }, [currentQuestion]);

  const handleSubmit = () => {
    if (submitted) return;
    const now = Date.now();
    const startTime = questionStartTimeRef.current[currentQuestion];
    if (startTime) {
      answerTimesRef.current[currentQuestion] = (answerTimesRef.current[currentQuestion] ?? 0) + (now - startTime);
    }
    const answersArray = Object.entries(answers).map(([qId, text]) => ({
      questionId: parseInt(qId),
      answerText: text,
    }));
    submitMutation.mutate(answersArray);
    setShowConfirmSubmit(false);
  };

  if (submitted) {
    const answered = Object.keys(answers).length;
    const total = (data?.questions || []).length;
    const flaggedCount = flagged.size;
    const confidentCount = Object.values(confidence).filter(c => c === "high").length;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="max-w-md text-center shadow-lg">
            <CardContent className="p-8 space-y-5">
              <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-1">Exam Submitted!</h2>
                <p className="text-muted-foreground text-sm">Your answers have been recorded. Your teacher will review them soon.</p>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-xl font-bold">{answered}/{total}</p>
                  <p className="text-[11px] text-muted-foreground">Answered</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-xl font-bold">{flaggedCount}</p>
                  <p className="text-[11px] text-muted-foreground">Flagged</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-xl font-bold">{confidentCount}</p>
                  <p className="text-[11px] text-muted-foreground">Confident</p>
                </div>
              </div>
              <Button className="w-full mt-2" onClick={() => setLocation("/student/exams")}>
                Back to Exams
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="min-h-screen bg-background p-6"><Skeleton className="h-96 w-full rounded-xl" /></div>;
  }

  const questions = data?.questions || [];
  const current = questions[currentQuestion];

  const isMCQ = (q: any) => q?.type === "mcq" || (q?.options && q.options.length > 0);
  const answeredCount = Object.keys(answers).length;
  const unansweredCount = questions.length - answeredCount;
  const totalViolations = violations + pasteAttempts + copyAttempts;

  function getQuestionStatus(q: any, i: number) {
    const hasAnswer = !!answers[q?.id];
    const isCurrent = i === currentQuestion;
    const isFlagged = flagged.has(q?.id);
    if (isFlagged) return "flagged";
    if (isCurrent) return "current";
    if (hasAnswer) return "answered";
    return "unanswered";
  }

  const statusColors = {
    current: "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1",
    answered: "bg-primary/20 text-primary",
    flagged: "bg-amber-400 text-white",
    unanswered: "bg-muted text-muted-foreground",
  };

  const violationModalConfig = {
    tab: {
      icon: <EyeOff className="h-10 w-10 text-amber-500" />,
      title: "Tab switch detected",
      description: "You left the exam window. This has been logged. Repeated violations may be flagged for your teacher.",
    },
    paste: {
      icon: <ClipboardX className="h-10 w-10 text-red-500" />,
      title: "Paste blocked",
      description: "Pasting content during an exam is not allowed. This attempt has been recorded.",
    },
    copy: {
      icon: <Copy className="h-10 w-10 text-amber-500" />,
      title: "Copy blocked",
      description: "Copying content during an exam is not allowed. This attempt has been recorded.",
    },
  };

  return (
    <div className="min-h-screen bg-background page-transition">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-base lg:text-lg font-bold truncate">{data?.exam?.name}</h1>
          <p className="text-xs text-muted-foreground">{currentQuestion + 1} / {questions.length} · {answeredCount} answered · {unansweredCount} remaining</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {totalViolations > 0 && (
            <Alert variant="destructive" className="py-1 px-2 hidden sm:flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5" />
              <AlertDescription className="text-xs">
                {violations > 0 && `${violations} tab switch${violations !== 1 ? "es" : ""}`}
                {pasteAttempts > 0 && `${violations > 0 ? " · " : ""}${pasteAttempts} paste${pasteAttempts !== 1 ? "s" : ""}`}
                {copyAttempts > 0 && `${(violations > 0 || pasteAttempts > 0) ? " · " : ""}${copyAttempts} copy${copyAttempts !== 1 ? "s" : ""}`}
              </AlertDescription>
            </Alert>
          )}
          <Badge className={`text-sm font-bold tabular-nums ${timeLeft < 60 ? "bg-destructive animate-pulse" : timeLeft < 300 ? "bg-amber-500" : "bg-primary"}`}>
            <Timer className="h-3.5 w-3.5 mr-1" /> {formatTime(timeLeft)}
          </Badge>
          <button
            onClick={() => setShowNavigator(n => !n)}
            className="lg:hidden p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
            title="Question Navigator"
          >
            <BookOpen className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Progress value={((currentQuestion + 1) / questions.length) * 100} className="h-1 rounded-none" />

      {/* Mobile navigator overlay */}
      <AnimatePresence>
        {showNavigator && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="lg:hidden bg-background border-b border-border/60 px-4 py-3"
          >
            <div className="flex gap-1.5 flex-wrap">
              {questions.map((q: any, i: number) => {
                const status = getQuestionStatus(q, i);
                return (
                  <button
                    key={i}
                    onClick={() => { navigateQuestion(i); setShowNavigator(false); }}
                    className={`w-8 h-8 rounded-lg text-[11px] font-bold transition-all ${statusColors[status]}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3 mt-3 flex-wrap text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary/20 inline-block" />Answered</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-muted inline-block" />Unanswered</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block" />Flagged</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-0 lg:gap-6 max-w-5xl mx-auto px-4 pb-28 lg:pb-8 pt-4 lg:pt-6">
        <div className="flex-1 space-y-4 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.15 }}
            >
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base lg:text-lg">
                      Question {currentQuestion + 1}
                      {current?.marks && (
                        <span className="ml-2 text-sm font-normal text-muted-foreground">[{current.marks} mark{current.marks !== 1 ? "s" : ""}]</span>
                      )}
                    </CardTitle>
                    <button
                      onClick={() => current && toggleFlag(current.id)}
                      className={`p-2 rounded-lg transition-colors ${current && flagged.has(current.id) ? "text-amber-500 bg-amber-50" : "text-muted-foreground hover:bg-muted"}`}
                      title="Flag for review"
                    >
                      <Bookmark className={`h-4 w-4 ${current && flagged.has(current.id) ? "fill-amber-400" : ""}`} />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-base leading-relaxed prose prose-sm max-w-none">
                    <MathRenderer content={current?.questionText ?? ""} />
                  </div>

                  {/* MCQ options */}
                  {isMCQ(current) ? (
                    <div className="space-y-2.5">
                      {(current?.options || []).map((opt: string, idx: number) => {
                        const letter = String.fromCharCode(65 + idx);
                        const isSelected = answers[current?.id] === opt;
                        return (
                          <button
                            key={idx}
                            onClick={() => handleAnswerChange(current.id, opt)}
                            className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm font-medium flex items-start gap-3 ${
                              isSelected
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border/60 hover:border-primary/40 hover:bg-muted/40"
                            }`}
                          >
                            <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                              isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            }`}>
                              {letter}
                            </span>
                            <span className="leading-relaxed">{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <TheoryAnswerEditor
                      value={answers[current?.id] || ""}
                      onChange={(v) => current && handleAnswerChange(current.id, v)}
                      marks={current?.marks ?? 1}
                    />
                  )}

                  {/* Confidence rating */}
                  {current && (
                    <div className="pt-1">
                      <p className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                        <Star className="h-3 w-3" /> How confident are you?
                      </p>
                      <div className="flex gap-2">
                        {CONFIDENCE_CONFIG.map(({ level, label, color, bg }) => (
                          <button
                            key={level}
                            onClick={() => setConfidenceLevel(current.id, level)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                              confidence[current.id] === level
                                ? `${bg} ${color} border-current`
                                : "border-border/50 text-muted-foreground hover:border-gray-300"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>

          {/* Desktop nav */}
          <div className="hidden lg:flex justify-between items-center">
            <Button variant="outline" disabled={currentQuestion === 0} onClick={() => navigateQuestion(currentQuestion - 1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowConfirmSubmit(true)} className="text-muted-foreground">
              <Flag className="h-4 w-4 mr-1.5" /> Finish Exam
            </Button>
            {currentQuestion < questions.length - 1 ? (
              <Button onClick={() => navigateQuestion(currentQuestion + 1)}>
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={() => setShowConfirmSubmit(true)} className="bg-primary">
                <Flag className="h-4 w-4 mr-1" /> Submit Exam
              </Button>
            )}
          </div>
        </div>

        {/* Desktop sidebar navigator */}
        <div className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-20 space-y-3">
            <div className="bg-card rounded-xl border shadow-sm p-4">
              <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">Navigator</p>
              <div className="grid grid-cols-5 gap-1.5">
                {questions.map((q: any, i: number) => {
                  const status = getQuestionStatus(q, i);
                  return (
                    <button
                      key={i}
                      onClick={() => navigateQuestion(i)}
                      className={`w-full aspect-square rounded-md text-[10px] font-bold transition-all ${statusColors[status]}`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 space-y-1.5 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-primary/20 shrink-0" />Answered ({answeredCount})</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-muted shrink-0" />Unanswered ({unansweredCount})</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-400 shrink-0" />Flagged ({flagged.size})</div>
              </div>
            </div>
            {totalViolations > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-1">
                <p className="font-semibold text-amber-800 flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5" /> Integrity Log
                </p>
                {violations > 0 && <p className="text-amber-700">{violations} tab switch{violations !== 1 ? "es" : ""}</p>}
                {pasteAttempts > 0 && <p className="text-amber-700">{pasteAttempts} paste attempt{pasteAttempts !== 1 ? "s" : ""}</p>}
                {copyAttempts > 0 && <p className="text-amber-700">{copyAttempts} copy attempt{copyAttempts !== 1 ? "s" : ""}</p>}
              </div>
            )}
            <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/5" onClick={() => setShowConfirmSubmit(true)}>
              <Flag className="h-3.5 w-3.5" /> Submit Exam
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile fixed bottom nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-md border-t border-border/60 p-3 safe-area-inset-bottom">
        <div className="flex gap-2 max-w-lg mx-auto">
          <Button variant="outline" disabled={currentQuestion === 0} onClick={() => navigateQuestion(currentQuestion - 1)} className="flex-1 h-11 rounded-xl text-sm font-semibold">
            <ArrowLeft className="h-4 w-4 mr-1" /> Prev
          </Button>
          {currentQuestion < questions.length - 1 ? (
            <Button onClick={() => navigateQuestion(currentQuestion + 1)} className="flex-1 h-11 rounded-xl text-sm font-semibold">
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => setShowConfirmSubmit(true)} className="flex-1 h-11 rounded-xl text-sm font-semibold bg-destructive hover:bg-destructive/90">
              <Flag className="h-4 w-4 mr-1" /> Submit
            </Button>
          )}
        </div>
      </div>

      {/* Submit confirm dialog */}
      <AnimatePresence>
        {showConfirmSubmit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={() => setShowConfirmSubmit(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background rounded-2xl shadow-xl p-6 max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-1">Submit your exam?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {unansweredCount > 0
                  ? `You have ${unansweredCount} unanswered question${unansweredCount !== 1 ? "s" : ""}. You cannot change your answers after submitting.`
                  : "All questions answered. You cannot change your answers after submitting."}
              </p>
              {flagged.size > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-800 flex items-center gap-2">
                  <Bookmark className="h-4 w-4 fill-amber-400 text-amber-500 shrink-0" />
                  {flagged.size} question{flagged.size !== 1 ? "s" : ""} flagged for review
                </div>
              )}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowConfirmSubmit(false)}>Keep reviewing</Button>
                <Button className="flex-1 bg-primary" onClick={handleSubmit} disabled={submitMutation.isPending}>
                  {submitMutation.isPending ? "Submitting…" : "Submit"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Violation warning modal */}
      <AnimatePresence>
        {showViolationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-background rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-amber-200"
            >
              <div className="flex flex-col items-center text-center gap-3">
                {violationModalConfig[violationModalType].icon}
                <div>
                  <h3 className="text-base font-bold">{violationModalConfig[violationModalType].title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{violationModalConfig[violationModalType].description}</p>
                </div>
                <Button className="w-full mt-1" onClick={() => setShowViolationModal(false)}>
                  Continue Exam
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
