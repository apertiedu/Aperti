import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain, CheckCircle2, XCircle, ArrowRight, Sparkles, RotateCcw,
  Target, TrendingUp, BookOpen, Zap,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { MathRenderer } from "@/components/math-renderer";


async function postJSON(url: string, body: unknown) {
  const r = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function fetchJSON(url: string) {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

type Phase = "intro" | "quiz" | "results";

export default function MicroAssessmentPage() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const topicParam = params.get("topic") ?? "";

  const { toast } = useToast();
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>("intro");
  const [assessment, setAssessment] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [results, setResults] = useState<any>(null);
  const [currentQ, setCurrentQ] = useState(0);

  const { data: history } = useQuery({
    queryKey: ["micro-assessment-history"],
    queryFn: () => fetchJSON("/api/micro-assessment/history"),
    staleTime: 30_000,
  });

  const generateMutation = useMutation({
    mutationFn: (data: any) => postJSON("/api/micro-assessment/generate", data),
    onSuccess: (data) => { setAssessment(data.assessment); setPhase("quiz"); setAnswers({}); setCurrentQ(0); },
    onError: () => toast({ title: "Failed to generate assessment", variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: (data: any) => postJSON("/api/micro-assessment/submit", data),
    onSuccess: (data) => { setResults(data); setPhase("results"); qc.invalidateQueries({ queryKey: ["micro-assessment-history"] }); },
    onError: () => toast({ title: "Failed to submit", variant: "destructive" }),
  });

  const questions = assessment?.questions ?? [];
  const currentQuestion = questions[currentQ];
  const totalQ = questions.length;
  const answeredCount = Object.keys(answers).length;

  const handleAnswer = (qId: string, optIdx: number) => {
    const newAnswers = { ...answers, [qId]: optIdx };
    setAnswers(newAnswers);
    if (currentQ < totalQ - 1) {
      setTimeout(() => setCurrentQ(q => q + 1), 400);
    }
  };

  const reset = () => { setPhase("intro"); setAssessment(null); setAnswers({}); setResults(null); setCurrentQ(0); };

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-background p-4 md:p-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Target className="h-7 w-7 text-primary" /> Quick Assessment
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Bite-sized knowledge checks to strengthen mastery</p>
      </motion.div>

      <div className="max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {/* INTRO */}
          {phase === "intro" && (
            <motion.div key="intro" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-5">
              <Card className="shadow-sm border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Brain className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-lg font-bold mb-2">Knowledge Check</h2>
                  <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
                    A quick 4-question quiz to test your understanding and update your mastery record.
                    {topicParam && <strong> Topic: {topicParam}</strong>}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                      className="gap-2"
                      disabled={generateMutation.isPending}
                      onClick={() => generateMutation.mutate({ topic: topicParam || undefined, type: "knowledge_check" })}
                    >
                      <Sparkles className="h-4 w-4" />
                      {generateMutation.isPending ? "Generating…" : topicParam ? `Start: ${topicParam}` : "Generate Quiz"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* History */}
              {(history?.count ?? 0) > 0 && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="text-sm flex items-center gap-2 justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" /> Recent Assessments
                      </div>
                      <Badge variant="secondary" className="text-xs">Avg: {history.avgScore}%</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2">
                    {(history.history as any[]).slice(0, 5).map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-muted/40">
                        <span className="font-medium truncate flex-1">{a.topic ?? "General"}</span>
                        <Badge variant={parseFloat(a.score) >= 70 ? "default" : "destructive"} className="text-[10px] h-4 ml-2">
                          {parseFloat(a.score ?? 0).toFixed(0)}%
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}

          {/* QUIZ */}
          {phase === "quiz" && currentQuestion && (
            <motion.div key={`quiz-${currentQ}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <Card className="shadow-sm">
                <CardContent className="p-6">
                  {/* Progress */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs text-muted-foreground">Question {currentQ + 1} of {totalQ}</span>
                    <Badge variant="outline" className="text-xs">{assessment?.topic}</Badge>
                  </div>
                  <Progress value={((currentQ) / totalQ) * 100} className="h-1.5 mb-6" />

                  {/* Question */}
                  <div className="font-semibold text-base leading-relaxed mb-6">
                    <MathRenderer content={currentQuestion.question} />
                  </div>

                  {/* Options */}
                  <div className="space-y-3">
                    {(currentQuestion.options as string[]).map((opt, idx) => {
                      const isAnswered = answers[currentQuestion.id] !== undefined;
                      const isSelected = answers[currentQuestion.id] === idx;
                      return (
                        <motion.button
                          key={idx} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all text-sm font-medium
                            ${isAnswered && isSelected ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40 hover:bg-primary/5"}`}
                          onClick={() => !isAnswered && handleAnswer(currentQuestion.id, idx)}
                          disabled={isAnswered}
                        >
                          <span className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-muted text-xs font-bold mr-2">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <MathRenderer content={opt} inline />
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center justify-between mt-6">
                    <Button variant="ghost" size="sm" onClick={reset}>Exit</Button>
                    {answeredCount > 0 && currentQ === totalQ - 1 ? (
                      <Button className="gap-2" onClick={() => submitMutation.mutate({ assessmentId: assessment.id, answers })} disabled={submitMutation.isPending}>
                        {submitMutation.isPending ? "Submitting…" : <><CheckCircle2 className="h-4 w-4" /> Submit</>}
                      </Button>
                    ) : answers[currentQuestion.id] !== undefined && currentQ < totalQ - 1 ? (
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => setCurrentQ(q => q + 1)}>
                        Next <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* RESULTS */}
          {phase === "results" && results && (
            <motion.div key="results" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
              {/* Score card */}
              <Card className={`shadow-sm border-2 ${results.score >= 80 ? "border-emerald-400" : results.score >= 50 ? "border-amber-400" : "border-destructive/40"}`}>
                <CardContent className="p-6 text-center">
                  <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-bold
                    ${results.score >= 80 ? "bg-emerald-100 text-emerald-700" : results.score >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                    {results.score}%
                  </div>
                  <p className="font-bold text-lg">{results.score >= 80 ? "Excellent! 🎉" : results.score >= 50 ? "Good effort! 💪" : "Keep practising! 📚"}</p>
                  <p className="text-sm text-muted-foreground mt-1">{results.feedback}</p>
                  <div className="flex justify-center gap-3 mt-3">
                    <Badge variant="outline">{results.correct}/{results.total} correct</Badge>
                    <Badge variant="secondary">{results.nextStep}</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Per-question breakdown */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2 px-4 pt-4">
                  <CardTitle className="text-sm">Question Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {(results.results as any[]).map((r: any, idx: number) => (
                    <div key={r.questionId} className={`p-3 rounded-xl text-xs ${r.correct ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
                      <div className="flex items-start gap-2">
                        {r.correct ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
                        <div>
                          <p className="font-medium">Q{idx + 1}: {r.correct ? "Correct" : "Incorrect"}</p>
                          {!r.correct && r.correctAnswer && (
                            <p className="text-xs mt-0.5">Correct answer: <MathRenderer content={String(r.correctAnswer)} inline /></p>
                          )}
                          {r.explanation && <MathRenderer content={r.explanation} className="text-muted-foreground mt-0.5" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" className="gap-2" onClick={reset}>
                  <RotateCcw className="h-4 w-4" /> Try Again
                </Button>
                <Link href={`/mentor?topic=${encodeURIComponent(assessment?.topic ?? "")}`}>
                  <Button variant="outline" className="gap-2">
                    <Brain className="h-4 w-4" /> Ask Mentor
                  </Button>
                </Link>
                <Link href="/learning-path">
                  <Button className="gap-2">
                    <Zap className="h-4 w-4" /> View Learning Path
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
