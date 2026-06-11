import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Timer, AlertTriangle, Flag, ArrowLeft, ArrowRight, CheckCircle2, BookOpen, Star, Bookmark } from "lucide-react";
import { useLocation } from "wouter";
import { MathRenderer } from "@/components/math-renderer";

const API = "/api";
const token = () => localStorage.getItem("aperti_token");

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
  const [submitted, setSubmitted] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["exam", "take", examId],
    queryFn: async () => {
      const res = await fetch(`${API}/exams/student/${examId}/take`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      return res.json();
    },
  });

  useEffect(() => {
    if (data?.exam?.timeLimitMinutes) {
      setTimeLeft(data.exam.timeLimitMinutes * 60);
    }
  }, [data?.exam?.timeLimitMinutes]);

  const submitMutation = useMutation({
    mutationFn: (answersArray: any[]) =>
      fetch(`${API}/exams/student/${examId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ answers: answersArray }),
      }),
    onSuccess: () => setSubmitted(true),
  });

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && !submitted) setViolations((v) => v + 1);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [submitted]);

  useEffect(() => {
    const blockCopy = (e: ClipboardEvent) => e.preventDefault();
    document.addEventListener("copy", blockCopy);
    document.addEventListener("paste", blockCopy);
    return () => {
      document.removeEventListener("copy", blockCopy);
      document.removeEventListener("paste", blockCopy);
    };
  }, []);

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

  const handleSubmit = () => {
    if (submitted) return;
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

  return (
    <div className="min-h-screen bg-background page-transition">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-base lg:text-lg font-bold truncate">{data?.exam?.name}</h1>
          <p className="text-xs text-muted-foreground">{currentQuestion + 1} / {questions.length} · {answeredCount} answered · {unansweredCount} remaining</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {violations > 0 && (
            <Alert variant="destructive" className="py-1 px-2 hidden sm:flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              <AlertDescription className="text-xs">{violations} warning{violations !== 1 ? "s" : ""}</AlertDescription>
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
                    onClick={() => { setCurrentQuestion(i); setShowNavigator(false); }}
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
        {/* Main question area */}
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
                    <Textarea
                      rows={7}
                      placeholder="Type your answer here…"
                      value={answers[current?.id] || ""}
                      onChange={(e) => current && handleAnswerChange(current.id, e.target.value)}
                      className="text-base resize-none font-mono"
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
            <Button variant="outline" disabled={currentQuestion === 0} onClick={() => setCurrentQuestion(q => q - 1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowConfirmSubmit(true)} className="text-muted-foreground">
              <Flag className="h-4 w-4 mr-1.5" /> Finish Exam
            </Button>
            {currentQuestion < questions.length - 1 ? (
              <Button onClick={() => setCurrentQuestion(q => q + 1)}>
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
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">Navigator</p>
              <div className="grid grid-cols-5 gap-1.5">
                {questions.map((q: any, i: number) => {
                  const status = getQuestionStatus(q, i);
                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentQuestion(i)}
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
            <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/5" onClick={() => setShowConfirmSubmit(true)}>
              <Flag className="h-3.5 w-3.5" /> Submit Exam
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile fixed bottom nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-md border-t border-border/60 p-3 safe-area-inset-bottom">
        <div className="flex gap-2 max-w-lg mx-auto">
          <Button variant="outline" disabled={currentQuestion === 0} onClick={() => setCurrentQuestion(q => q - 1)} className="flex-1 h-11 rounded-xl text-sm font-semibold">
            <ArrowLeft className="h-4 w-4 mr-1" /> Prev
          </Button>
          {currentQuestion < questions.length - 1 ? (
            <Button onClick={() => setCurrentQuestion(q => q + 1)} className="flex-1 h-11 rounded-xl text-sm font-semibold">
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
    </div>
  );
}
