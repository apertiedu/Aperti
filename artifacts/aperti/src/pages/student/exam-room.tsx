import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Clock, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle,
  Flag, Send, Eye, EyeOff, Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExamQuestion {
  id: number;
  question_text: string;
  question_type: string;
  marks: number;
  options: string[] | null;
  image_url: string | null;
  topic: string | null;
  section_id: number | null;
}

interface Submission {
  id: number;
  assessment_id: number;
  status: string;
}

function Timer({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) { onExpire(); return; }
    const t = setInterval(() => setRemaining(r => r - 1), 1000);
    return () => clearInterval(t);
  }, [remaining]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isLow = remaining < 300;

  return (
    <div className={`flex items-center gap-1.5 font-mono text-sm font-semibold ${isLow ? "text-red-500" : "text-foreground"}`}>
      <Clock className={`w-3.5 h-3.5 ${isLow ? "animate-pulse" : ""}`} />
      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
    </div>
  );
}

// Security monitor — heartbeat + tab/focus detection
function useSecurityMonitor(sessionToken: string | null) {
  const tabSwitchRef = useRef(0);
  const focusLossRef = useRef(0);

  useEffect(() => {
    if (!sessionToken) return;

    const heartbeat = setInterval(async () => {
      try {
        await apiFetch("/api/exam-session/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_token: sessionToken,
            tab_switch: tabSwitchRef.current > 0,
            focus_loss: focusLossRef.current > 0,
          }),
        });
        tabSwitchRef.current = 0;
        focusLossRef.current = 0;
      } catch { /* continue */ }
    }, 15_000);

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") tabSwitchRef.current++;
    };
    const handleBlur = () => { focusLossRef.current++; };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  }, [sessionToken]);
}

export default function ExamRoom() {
  const { toast } = useToast();
  const [assessmentId, setAssessmentId] = useState<number | null>(null);
  const [phase, setPhase] = useState<"select" | "lobby" | "exam" | "submitted">("select");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [examTitle, setExamTitle] = useState("");

  useSecurityMonitor(sessionToken);

  // Fetch available assessments
  const { data: availableExams } = useQuery({
    queryKey: ["available-exams"],
    queryFn: async () => {
      const res = await apiFetch("/api/assessments");
      const data = await res.json();
      return (data.assessments ?? []).filter((a: any) =>
        ["published", "active"].includes(a.status) && a.submission_status !== "submitted"
      );
    },
    enabled: phase === "select",
  });

  const startMut = useMutation({
    mutationFn: async (id: number) => {
      // Start exam session
      const [sessionRes, submissionRes] = await Promise.all([
        apiFetch("/api/exam-session/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assessment_id: id, device_info: { ua: navigator.userAgent } }),
        }),
        apiFetch(`/api/assessments/${id}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }),
      ]);
      const [sessionData, submissionData] = await Promise.all([sessionRes.json(), submissionRes.json()]);
      return { sessionData, submissionData };
    },
    onSuccess: ({ sessionData, submissionData }) => {
      setSessionToken(sessionData.session?.session_token ?? null);
      setSubmission(submissionData.submission);
      setQuestions(submissionData.questions ?? []);
      setTimeLimit(sessionData.time_limit_minutes ? sessionData.time_limit_minutes * 60 : null);
      setPhase("exam");
    },
    onError: () => toast({ title: "Failed to start exam", variant: "destructive" }),
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!submission) throw new Error("No submission");
      const answersArray = Object.entries(answers).map(([qId, text]) => ({
        question_id: parseInt(qId),
        answer_text: text,
      }));
      const res = await apiFetch(`/api/assessments/${submission.assessment_id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answersArray }),
      });
      if (!res.ok) throw new Error("Submit failed");
      // End session
      if (sessionToken) {
        await apiFetch("/api/exam-session/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_token: sessionToken }),
        }).catch(() => {});
      }
      return res.json();
    },
    onSuccess: () => setPhase("submitted"),
    onError: () => toast({ title: "Submission failed", variant: "destructive" }),
  });

  const q = questions[currentQ];
  const answeredCount = Object.keys(answers).length;

  // ── PHASE: SELECT ────────────────────────────────────────────────
  if (phase === "select") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> Exam Room
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Select an available assessment to begin.</p>
        </div>

        {(!availableExams || availableExams.length === 0) ? (
          <div className="text-center py-16 border border-dashed border-border rounded-2xl">
            <CheckCircle2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-medium text-muted-foreground">No assessments available right now</p>
          </div>
        ) : (
          <div className="space-y-3">
            {availableExams.map((exam: any) => (
              <motion.div
                key={exam.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-semibold text-sm">{exam.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    <span>{exam.total_marks} marks</span>
                    {exam.time_limit_minutes && (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{exam.time_limit_minutes} min</span>
                    )}
                    {exam.due_at && <span className="text-amber-500">Due {new Date(exam.due_at).toLocaleDateString()}</span>}
                  </div>
                  {exam.instructions && (
                    <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">{exam.instructions}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setAssessmentId(exam.id);
                    setExamTitle(exam.title);
                    setPhase("lobby");
                  }}
                >
                  Begin
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── PHASE: LOBBY ─────────────────────────────────────────────────
  if (phase === "lobby") {
    const exam = availableExams?.find((e: any) => e.id === assessmentId);
    return (
      <div className="max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-8 space-y-6 text-center"
        >
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{examTitle}</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {exam?.total_marks} marks · {exam?.time_limit_minutes ? `${exam.time_limit_minutes} minutes` : "No time limit"}
            </p>
          </div>
          {exam?.instructions && (
            <div className="bg-muted/50 rounded-xl p-4 text-sm text-left">
              <p className="font-semibold mb-1">Instructions</p>
              <p className="text-muted-foreground">{exam.instructions}</p>
            </div>
          )}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-sm text-left">
            <p className="font-semibold text-amber-600 mb-1">⚠ Exam Integrity Notice</p>
            <p className="text-muted-foreground text-xs">
              Tab switching and window focus loss are monitored. Ensure you have a stable connection. 
              Do not navigate away during the exam.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setPhase("select")}>Back</Button>
            <Button
              className="flex-1"
              onClick={() => assessmentId && startMut.mutate(assessmentId)}
              disabled={startMut.isPending}
            >
              {startMut.isPending ? "Starting…" : "Start Exam"}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── PHASE: EXAM ───────────────────────────────────────────────────
  if (phase === "exam" && q) {
    return (
      <div className="flex flex-col h-[calc(100vh-80px)] max-w-4xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between bg-card border-b border-border px-4 py-3 rounded-t-xl">
          <div>
            <p className="font-bold text-sm">{examTitle}</p>
            <p className="text-xs text-muted-foreground">Question {currentQ + 1} of {questions.length}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">{answeredCount}/{questions.length} answered</span>
            {timeLimit && (
              <Timer seconds={timeLimit} onExpire={() => { toast({ title: "Time's up!" }); submitMut.mutate(); }} />
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Question navigation sidebar */}
          <div className="w-24 bg-muted/30 border-r border-border p-2 overflow-y-auto">
            <div className="grid grid-cols-2 gap-1">
              {questions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentQ(i)}
                  className={`h-8 rounded text-xs font-medium transition-colors ${
                    i === currentQ ? "bg-primary text-primary-foreground" :
                    answers[questions[i].id] ? "bg-emerald-500/20 text-emerald-600" :
                    flagged.has(i) ? "bg-amber-500/20 text-amber-600" :
                    "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-1 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/20" />Answered</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500/20" />Flagged</div>
            </div>
          </div>

          {/* Question content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQ}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Question header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold text-muted-foreground">Q{currentQ + 1}</span>
                      <Badge variant="outline" className="text-[10px]">{q.marks} mark{q.marks !== 1 ? "s" : ""}</Badge>
                      {q.topic && <Badge variant="secondary" className="text-[10px]">{q.topic}</Badge>}
                    </div>
                    <p className="text-sm font-medium leading-relaxed">
                      {q.question_text ?? (q as any).custom_question?.text ?? "Question text not available"}
                    </p>
                    {q.image_url && (
                      <img src={q.image_url} alt="Question diagram" className="mt-3 rounded-lg max-h-48 object-contain border" />
                    )}
                  </div>
                  <button
                    onClick={() => setFlagged(f => {
                      const n = new Set(f);
                      if (n.has(currentQ)) n.delete(currentQ); else n.add(currentQ);
                      return n;
                    })}
                    className={`p-1.5 rounded-lg transition-colors shrink-0 ${flagged.has(currentQ) ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground hover:bg-muted"}`}
                    title="Flag for review"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                </div>

                {/* Answer input */}
                {q.question_type === "mcq" && q.options ? (
                  <div className="space-y-2">
                    {q.options.map((opt: string, i: number) => {
                      const letter = ["A","B","C","D","E"][i];
                      const isSelected = answers[q.id] === opt;
                      return (
                        <button
                          key={i}
                          onClick={() => setAnswers(a => ({ ...a, [q.id]: opt }))}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border text-sm text-left transition-all ${
                            isSelected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/30 hover:bg-muted/50"
                          }`}
                        >
                          <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                            {letter}
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Your answer:</p>
                    <textarea
                      className="w-full min-h-[160px] rounded-xl border border-border bg-background px-4 py-3 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                      placeholder="Write your answer here…"
                      value={answers[q.id] ?? ""}
                      onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                    />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom navigation */}
        <div className="bg-card border-t border-border px-4 py-3 flex items-center justify-between rounded-b-xl">
          <Button variant="outline" size="sm" onClick={() => setCurrentQ(q => Math.max(0, q - 1))} disabled={currentQ === 0}>
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>

          <Button
            variant="default"
            size="sm"
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => {
              if (answeredCount < questions.length) {
                if (!confirm(`You have ${questions.length - answeredCount} unanswered questions. Submit anyway?`)) return;
              }
              submitMut.mutate();
            }}
            disabled={submitMut.isPending}
          >
            <Send className="w-3.5 h-3.5" />
            {submitMut.isPending ? "Submitting…" : "Submit Exam"}
          </Button>

          <Button variant="outline" size="sm" onClick={() => setCurrentQ(q => Math.min(questions.length - 1, q + 1))} disabled={currentQ === questions.length - 1}>
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  // ── PHASE: SUBMITTED ─────────────────────────────────────────────
  if (phase === "submitted") {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-6">
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}
          className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto"
        >
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </motion.div>
        <div>
          <h2 className="text-2xl font-bold">Exam Submitted!</h2>
          <p className="text-muted-foreground mt-2">Your answers have been submitted successfully. Your teacher will review and grade your work shortly.</p>
        </div>
        <Button onClick={() => { setPhase("select"); setAnswers({}); setCurrentQ(0); setFlagged(new Set()); }}>
          Back to Exams
        </Button>
      </div>
    );
  }

  return null;
}
