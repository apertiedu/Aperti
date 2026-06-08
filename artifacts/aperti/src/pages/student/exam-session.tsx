import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock, ChevronLeft, ChevronRight, Flag, Send, Shield,
  CheckCircle2, AlertTriangle, ArrowLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { MathRenderer } from "@/components/math-renderer";

function Timer({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [rem, setRem] = useState(seconds);
  useEffect(() => {
    if (rem <= 0) { onExpire(); return; }
    const t = setInterval(() => setRem(r => r - 1), 1000);
    return () => clearInterval(t);
  }, [rem]);
  const m = Math.floor(rem / 60), s = rem % 60;
  const low = rem < 300;
  return (
    <div className={`flex items-center gap-1.5 font-mono text-sm font-bold ${low ? "text-red-500 animate-pulse" : "text-foreground"}`}>
      <Clock className="w-3.5 h-3.5" />{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}
    </div>
  );
}

export default function StudentExamSession({ params }: { params: { id: string } }) {
  const assessmentId = params?.id;
  const { toast } = useToast();
  const [phase, setPhase] = useState<"lobby"|"exam"|"submitted">("lobby");
  const [sessionToken, setSessionToken] = useState<string|null>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [timeLimit, setTimeLimit] = useState<number|null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number,string>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const tabSwitches = useRef(0);
  const focusLosses = useRef(0);

  const { data: assessData, isLoading } = useQuery({
    queryKey: ["assessment", assessmentId],
    queryFn: async () => {
      const res = await apiFetch(`/api/assessments/${assessmentId}`);
      return res.json();
    },
  });
  const assessment = assessData?.assessment;

  // Security monitoring
  useEffect(() => {
    if (!sessionToken || phase !== "exam") return;
    const heartbeat = setInterval(async () => {
      await apiFetch("/api/exam-session/heartbeat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_token: sessionToken, tab_switch: tabSwitches.current > 0, focus_loss: focusLosses.current > 0 }),
      }).catch(() => {});
      tabSwitches.current = 0; focusLosses.current = 0;
    }, 20_000);

    const onVisibility = () => { if (document.visibilityState === "hidden") tabSwitches.current++; };
    const onBlur = () => { focusLosses.current++; };
    const onCopy = (e: ClipboardEvent) => { e.preventDefault(); toast({ title: "Copy/paste is disabled during this exam", variant: "destructive" }); };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCopy);
    document.addEventListener("contextmenu", onContextMenu);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCopy);
      document.removeEventListener("contextmenu", onContextMenu);
    };
  }, [sessionToken, phase]);

  const startMut = useMutation({
    mutationFn: async () => {
      const [sessionRes, submissionRes] = await Promise.all([
        apiFetch("/api/exam-session/start", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assessment_id: parseInt(assessmentId), device_info: { ua: navigator.userAgent } }),
        }),
        apiFetch(`/api/assessments/${assessmentId}/start`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
        }),
      ]);
      return {
        session: await sessionRes.json(),
        sub: await submissionRes.json(),
      };
    },
    onSuccess: ({ session, sub }) => {
      setSessionToken(session.session?.session_token ?? null);
      setSubmission(sub.submission);
      setQuestions(sub.questions ?? []);
      setTimeLimit(session.time_limit_minutes ? session.time_limit_minutes * 60 : null);
      setPhase("exam");
    },
    onError: () => toast({ title: "Failed to start exam", variant: "destructive" }),
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      const answersArr = Object.entries(answers).map(([qId, text]) => ({ question_id: parseInt(qId), answer_text: text }));
      const res = await apiFetch(`/api/assessments/${assessmentId}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answersArr }),
      });
      if (!res.ok) throw new Error("Submit failed");
      if (sessionToken) await apiFetch("/api/exam-session/end", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_token: sessionToken }),
      }).catch(() => {});
      return res.json();
    },
    onSuccess: () => setPhase("submitted"),
    onError: () => toast({ title: "Submission failed", variant: "destructive" }),
  });

  const q = questions[currentQ];

  // LOBBY
  if (phase === "lobby") {
    if (isLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
    return (
      <div className="max-w-lg mx-auto">
        <div className="mb-4">
          <Link href="/exam-room">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground h-8 -ml-2">
              <ArrowLeft className="w-3.5 h-3.5" />Back
            </Button>
          </Link>
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-8 space-y-6 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{assessment?.title}</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {assessment?.total_marks} marks
              {assessment?.time_limit_minutes ? ` · ${assessment.time_limit_minutes} minutes` : " · No time limit"}
            </p>
          </div>
          {assessment?.instructions && (
            <div className="bg-muted/50 rounded-xl p-4 text-sm text-left">
              <p className="font-semibold mb-1 text-xs uppercase tracking-wide text-muted-foreground">Instructions</p>
              <p>{assessment.instructions}</p>
            </div>
          )}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-left space-y-1">
            <p className="font-semibold text-amber-600">⚠ Integrity Notice</p>
            <p className="text-muted-foreground">Tab-switching, copy/paste, and right-click are monitored and disabled. Ensure stable internet before starting.</p>
          </div>
          <Button className="w-full" onClick={() => startMut.mutate()} disabled={startMut.isPending}>
            {startMut.isPending ? "Starting…" : "Begin Exam"}
          </Button>
        </motion.div>
      </div>
    );
  }

  // EXAM
  if (phase === "exam" && q) {
    const answeredCount = Object.keys(answers).length;
    const allowBack = assessment?.settings?.allow_back_navigation !== false;

    return (
      <div className="flex flex-col h-[calc(100vh-80px)] select-none">
        {/* Top bar */}
        <div className="flex items-center justify-between bg-card border-b border-border px-4 py-2.5 rounded-t-xl shrink-0">
          <div>
            <p className="font-bold text-sm truncate max-w-xs">{assessment?.title}</p>
            <p className="text-[11px] text-muted-foreground">Q{currentQ+1}/{questions.length} · {answeredCount} answered</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">{answeredCount}/{questions.length}</span>
            {timeLimit && <Timer seconds={timeLimit} onExpire={() => { toast({ title: "Time's up!" }); submitMut.mutate(); }} />}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Q number palette */}
          <div className="w-20 bg-muted/20 border-r border-border p-2 overflow-y-auto shrink-0">
            <div className="grid grid-cols-2 gap-1">
              {questions.map((_, i) => (
                <button key={i} onClick={() => setCurrentQ(i)}
                  className={`h-7 rounded text-[11px] font-semibold transition-colors ${
                    i === currentQ ? "bg-primary text-primary-foreground" :
                    answers[questions[i].id] ? "bg-emerald-500/20 text-emerald-600" :
                    flagged.has(i) ? "bg-amber-500/20 text-amber-600" :
                    "bg-card text-muted-foreground hover:bg-muted"
                  }`}>
                  {i+1}
                </button>
              ))}
            </div>
          </div>

          {/* Question */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <AnimatePresence mode="wait">
              <motion.div key={currentQ} initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold text-muted-foreground">Q{currentQ+1}</span>
                      <Badge variant="outline" className="text-[10px]">{q.marks} mark{q.marks !== 1 ? "s" : ""}</Badge>
                      {q.topic && <Badge variant="secondary" className="text-[10px]">{q.topic}</Badge>}
                    </div>
                    <div className="text-sm font-medium leading-relaxed">
                      <MathRenderer content={q.question_text ?? q.custom_question?.text ?? "Question not available"} />
                    </div>
                    {q.image_url && <img src={q.image_url} alt="Question" className="mt-3 max-h-48 rounded-lg object-contain border" />}
                  </div>
                  <button onClick={() => setFlagged(f => { const n = new Set(f); if (n.has(currentQ)) n.delete(currentQ); else n.add(currentQ); return n; })}
                    className={`p-1.5 rounded-lg transition-colors shrink-0 ${flagged.has(currentQ) ? "text-amber-500 bg-amber-500/10" : "text-muted-foreground hover:bg-muted"}`}>
                    <Flag className="w-4 h-4" />
                  </button>
                </div>

                {q.question_type === "mcq" && q.options ? (
                  <div className="space-y-2">
                    {(q.options as string[]).map((opt, i) => (
                      <button key={i} onClick={() => setAnswers(a => ({ ...a, [q.id]: opt }))}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-sm text-left transition-all ${
                          answers[q.id] === opt ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30 hover:bg-muted/50"
                        }`}>
                        <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${answers[q.id] === opt ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                          {["A","B","C","D","E"][i]}
                        </span>
                        <MathRenderer content={opt} inline />
                      </button>
                    ))}
                  </div>
                ) : q.question_type === "true_false" ? (
                  <div className="flex gap-3">
                    {["True","False"].map(v => (
                      <button key={v} onClick={() => setAnswers(a => ({ ...a, [q.id]: v }))}
                        className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${answers[q.id] === v ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40"}`}>
                        {v}
                      </button>
                    ))}
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

        {/* Bottom nav */}
        <div className="bg-card border-t border-border px-4 py-3 flex items-center justify-between rounded-b-xl shrink-0">
          <Button variant="outline" size="sm" onClick={() => setCurrentQ(q => Math.max(0, q-1))} disabled={currentQ === 0 || !allowBack}>
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>
          <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => {
              if (answeredCount < questions.length && !confirm(`${questions.length - answeredCount} unanswered. Submit anyway?`)) return;
              submitMut.mutate();
            }}
            disabled={submitMut.isPending}>
            <Send className="w-3.5 h-3.5" />{submitMut.isPending ? "Submitting…" : "Submit Exam"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentQ(q => Math.min(questions.length-1, q+1))} disabled={currentQ === questions.length-1}>
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  // SUBMITTED
  if (phase === "submitted") {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}
          className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </motion.div>
        <div>
          <h2 className="text-2xl font-bold">Submitted!</h2>
          <p className="text-muted-foreground mt-2">Your exam has been submitted. Results will be available once your teacher marks your work.</p>
        </div>
        <div className="flex gap-3 justify-center">
          <Link href={`/student/exams/${assessmentId}/results`}>
            <Button variant="outline">View Results</Button>
          </Link>
          <Link href="/exam-room">
            <Button>Back to Exams</Button>
          </Link>
        </div>
      </div>
    );
  }

  return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
}
