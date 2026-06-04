import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText, Zap, Clock, Target, ChevronRight, Sparkles, BarChart3,
  CheckCircle2, XCircle, ArrowLeft,
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const token = () => localStorage.getItem("aperti_token");
async function fetchJSON(url: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}
async function postJSON(url: string, body: object) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message ?? "Failed"); }
  return res.json();
}

const TYPES = ["multiple_choice", "short_answer", "mixed"];
const DIFFICULTIES = ["easy", "medium", "hard", "mixed"];

const diffColor: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400",
  medium: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400",
  hard: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400",
  mixed: "bg-primary/10 text-primary border-primary/20",
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 220, damping: 22 } } };

type Mode = "config" | "taking" | "results";

function TrialExamTaker({ attempt, onSubmit, onBack }: {
  attempt: { attemptId: string; questions: any[]; config: any; studyHints: string[] };
  onSubmit: (answers: Record<string, string>) => void;
  onBack: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showHints, setShowHints] = useState(false);
  const questions = attempt.questions ?? [];
  const answered = Object.keys(answers).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between sticky top-0 bg-background/90 backdrop-blur-md py-3 z-10 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground"><ArrowLeft className="h-4 w-4" /></Button>
          <span className="font-semibold text-sm">Trial Exam · {attempt.config?.difficulty ?? "Mixed"}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{answered}/{questions.length} answered</span>
          <Button size="sm" onClick={() => onSubmit(answers)} disabled={answered === 0}>
            Submit
          </Button>
        </div>
      </div>

      {attempt.studyHints?.length > 0 && (
        <Card className="shadow-sm border-primary/20 bg-primary/5">
          <CardContent className="p-3">
            <button className="text-xs font-semibold text-primary flex items-center gap-1.5" onClick={() => setShowHints(!showHints)}>
              <Sparkles className="h-3.5 w-3.5" />
              {showHints ? "Hide" : "Show"} AI Study Hints ({attempt.studyHints.length})
            </button>
            <AnimatePresence>
              {showHints && (
                <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2 space-y-1">
                  {attempt.studyHints.map((h, i) => (
                    <li key={i} className="text-xs text-primary/80 flex items-start gap-1.5">
                      <span className="text-primary font-bold shrink-0">{i + 1}.</span>{h}
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {questions.map((q: any, i: number) => (
          <Card key={q.id ?? i} className="shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs font-semibold text-primary mb-1">Question {i + 1}</p>
                  <p className="text-sm font-medium leading-relaxed">{q.questionText ?? q.text ?? `Q${i + 1}`}</p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0 capitalize">{q.topic ?? ""}</Badge>
              </div>
              {q.questionType === "multiple_choice" || q.options ? (
                <div className="space-y-2">
                  {(q.options ?? []).map((opt: string, oi: number) => (
                    <button
                      key={oi}
                      onClick={() => setAnswers(prev => ({ ...prev, [q.id ?? i]: String(oi) }))}
                      className={`w-full text-left p-3 rounded-xl border text-sm transition-colors ${
                        answers[q.id ?? i] === String(oi)
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <span className="font-medium mr-2">{String.fromCharCode(65 + oi)}.</span>{opt}
                    </button>
                  ))}
                </div>
              ) : (
                <Textarea
                  className="mt-2 text-sm"
                  rows={3}
                  placeholder="Your answer…"
                  value={answers[q.id ?? i] ?? ""}
                  onChange={e => setAnswers(prev => ({ ...prev, [q.id ?? i]: e.target.value }))}
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TrialResults({ result, onReset }: { result: any; onReset: () => void }) {
  const pct = result.totalMax > 0 ? Math.round((result.totalScored / result.totalMax) * 100) : result.score ?? 0;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5 max-w-xl mx-auto">
      <Card className="shadow-sm text-center">
        <CardContent className="p-8">
          <div className={`text-6xl font-extrabold mb-2 ${pct >= 70 ? "text-primary" : pct >= 50 ? "text-amber-600" : "text-destructive"}`}>
            {pct}%
          </div>
          <p className="text-muted-foreground mb-1">{result.totalScored ?? "—"} / {result.totalMax ?? "—"} marks</p>
          {result.xpAwarded > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mt-2">
              <Zap className="h-4 w-4" />+{result.xpAwarded} XP earned!
            </div>
          )}
          <Progress value={pct} className="h-3 max-w-xs mx-auto mt-4" />
        </CardContent>
      </Card>

      {(result.topicBreakdown ?? []).length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Topic Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {result.topicBreakdown.map((t: any) => (
              <div key={t.topic} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{t.topic}</span>
                  <span className="text-muted-foreground">{t.correct}/{t.total} correct</span>
                </div>
                <Progress value={t.total > 0 ? (t.correct / t.total) * 100 : 0} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 justify-center flex-wrap">
        <Button onClick={onReset} className="gap-2"><Zap className="h-4 w-4" /> New Trial</Button>
        <Link href="/mentor">
          <Button variant="outline" className="gap-2"><Target className="h-4 w-4" /> Ask Mentor</Button>
        </Link>
        <Link href="/revisit">
          <Button variant="outline" className="gap-2"><Clock className="h-4 w-4" /> Revisit Weak Topics</Button>
        </Link>
      </div>
    </motion.div>
  );
}

export default function TrialVault() {
  const [mode, setMode] = useState<Mode>("config");
  const [difficulty, setDifficulty] = useState("mixed");
  const [type, setType] = useState("mixed");
  const [count, setCount] = useState("20");
  const [attempt, setAttempt] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const { data: subjects } = useQuery({
    queryKey: ["student", "subjects"],
    queryFn: () => fetchJSON("/api/student/home-summary").then(d => d.academicSnapshot?.subjects ?? []),
    staleTime: 300_000,
  });

  const generateMutation = useMutation({
    mutationFn: ({ difficulty, type, count }: { difficulty: string; type: string; count: number }) =>
      postJSON("/api/trial-vault/generate", { difficulty, type, count }),
    onSuccess: (data) => {
      setAttempt(data);
      setMode("taking");
    },
    onError: (err: Error) => toast({ title: "Failed to generate trial", description: err.message, variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: ({ attemptId, answers }: { attemptId: string; answers: Record<string, string> }) =>
      postJSON("/api/trial-vault/submit", {
        attemptId,
        answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
        timingData: {},
      }),
    onSuccess: (data) => {
      setResult(data);
      setMode("results");
    },
    onError: (err: Error) => toast({ title: "Submission failed", description: err.message, variant: "destructive" }),
  });

  const reset = () => { setMode("config"); setAttempt(null); setResult(null); };

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-background p-4 md:p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">TrialVault</h1>
            <p className="text-muted-foreground text-sm">AI-generated mock exams biased toward your weak topics.</p>
          </div>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {mode === "config" && (
          <motion.div key="config" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="max-w-lg mx-auto space-y-5">
              <Card className="shadow-sm border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardContent className="p-5 flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-primary mb-1">AI-Powered Generation</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Questions are intelligently biased toward your Echo weak topics to maximise revision impact.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Configure Trial Exam</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Difficulty</label>
                    <Select value={difficulty} onValueChange={setDifficulty}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DIFFICULTIES.map(d => (
                          <SelectItem key={d} value={d}>
                            <span className="capitalize">{d}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Question Type</label>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPES.map(t => (
                          <SelectItem key={t} value={t}>
                            <span className="capitalize">{t.replace("_", " ")}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Number of Questions</label>
                    <Select value={count} onValueChange={setCount}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["10", "15", "20", "25", "30"].map(n => (
                          <SelectItem key={n} value={n}>{n} questions</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    className="w-full gap-2 mt-2"
                    size="lg"
                    onClick={() => generateMutation.mutate({ difficulty, type, count: parseInt(count) })}
                    disabled={generateMutation.isPending}
                  >
                    {generateMutation.isPending ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating…</>
                    ) : (
                      <><Zap className="h-4 w-4" />Generate Trial Exam</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {mode === "taking" && attempt && (
          <motion.div key="taking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <TrialExamTaker
              attempt={attempt}
              onSubmit={(answers) => submitMutation.mutate({ attemptId: attempt.attemptId, answers })}
              onBack={reset}
            />
          </motion.div>
        )}

        {mode === "results" && result && (
          <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <TrialResults result={result} onReset={reset} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
