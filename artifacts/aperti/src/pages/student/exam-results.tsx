import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, XCircle, Minus, ChevronDown, ChevronRight,
  ArrowLeft, MessageSquare, AlertTriangle, BarChart3,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const IGCSE_COLOR: Record<string, string> = {
  "A*": "text-yellow-500 bg-yellow-500/10",
  "A":  "text-emerald-500 bg-emerald-500/10",
  "B":  "text-green-500 bg-green-500/10",
  "C":  "text-teal-500 bg-teal-500/10",
  "D":  "text-blue-500 bg-blue-500/10",
  "E":  "text-orange-500 bg-orange-500/10",
  "F":  "text-amber-500 bg-amber-500/10",
  "G":  "text-red-400 bg-red-400/10",
  "U":  "text-red-600 bg-red-600/10",
};

export default function ExamResults({ params }: { params: { id: string } }) {
  const assessmentId = params?.id;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [appealForm, setAppealForm] = useState({ open: false, reason: "" });

  // First get student's submission for this assessment
  const { data, isLoading } = useQuery({
    queryKey: ["my-exam-results", assessmentId],
    queryFn: async () => {
      // Get current user's student profile then their submission
      const subRes = await apiFetch(`/api/assessments/${assessmentId}/submissions`);
      const subData = await subRes.json();
      const subs = subData.submissions ?? [];
      if (!subs.length) {
        // Try getting via results endpoint (need submission ID)
        return null;
      }
      const subId = subs[0]?.id;
      if (!subId) return null;
      const resRes = await apiFetch(`/api/submissions/${subId}/results`);
      return resRes.json();
    },
  });

  const appealMut = useMutation({
    mutationFn: async (submissionId: number) => {
      const res = await apiFetch("/api/appeals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: submissionId, reason: appealForm.reason }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { setAppealForm({ open: false, reason: "" }); toast({ title: "Appeal submitted" }); },
    onError: () => toast({ title: "Failed to submit appeal", variant: "destructive" }),
  });

  const submission = data?.submission;
  const answers = data?.answers ?? [];
  const pct = submission ? parseFloat(submission.percentage ?? 0) : 0;

  const toggleExpand = (id: number) => setExpanded(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  if (!submission) {
    return (
      <div className="text-center py-16">
        <BarChart3 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="font-medium text-muted-foreground">No results found for this exam.</p>
        <p className="text-xs text-muted-foreground mt-1">This may not be marked yet, or you haven't taken this exam.</p>
        <Link href="/exam-room"><Button variant="outline" className="mt-4">Back to Exams</Button></Link>
      </div>
    );
  }

  const correctCount = answers.filter((a: any) => a.is_correct === true).length;
  const graded = submission.status === "graded" || submission.status === "returned";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/exam-room">
          <Button variant="ghost" size="sm" className="h-8 text-muted-foreground">
            <ArrowLeft className="w-3.5 h-3.5" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold">{submission.title}</h1>
      </div>

      {/* Score card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl p-6 text-center space-y-4">
        {graded ? (
          <>
            <div>
              <p className="text-5xl font-bold text-primary">{Math.round(pct)}%</p>
              <p className="text-muted-foreground text-sm mt-1">{submission.score ?? "—"} / {submission.max_score ?? submission.total_marks} marks</p>
            </div>
            {submission.grade && (
              <span className={`inline-block px-4 py-1.5 rounded-full text-2xl font-bold ${IGCSE_COLOR[submission.grade] ?? ""}`}>
                {submission.grade}
              </span>
            )}
            <div className="grid grid-cols-3 gap-3 pt-2">
              {[
                { label: "Score", value: `${submission.score ?? 0}/${submission.max_score ?? submission.total_marks}` },
                { label: "Correct", value: `${correctCount}/${answers.length}` },
                { label: "Status", value: submission.status },
              ].map(s => (
                <div key={s.label} className="bg-muted/50 rounded-xl p-2.5">
                  <p className="text-sm font-bold">{s.value}</p>
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
            {submission.feedback && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-left">
                <p className="text-xs font-semibold text-blue-600 mb-1">Teacher Feedback</p>
                <p className="text-sm">{submission.feedback}</p>
              </div>
            )}
            {/* Progress bar */}
            <div>
              <div className="w-full bg-muted rounded-full h-2">
                <motion.div className="bg-primary rounded-full h-2" initial={{ width: 0 }} animate={{ width: `${Math.min(100, pct)}%` }} transition={{ delay: 0.3, duration: 0.8 }} />
              </div>
            </div>
          </>
        ) : (
          <div className="py-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <p className="font-semibold">Awaiting Marking</p>
            <p className="text-sm text-muted-foreground mt-1">Your teacher hasn't graded this exam yet. Check back later.</p>
          </div>
        )}
      </motion.div>

      {/* Per-question breakdown */}
      {answers.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-bold text-sm">Question Breakdown</h3>
          {answers.map((ans: any, i: number) => {
            const isExpanded = expanded.has(ans.id);
            const earned = ans.marks_awarded !== null ? parseFloat(ans.marks_awarded) : null;
            const max = parseFloat(ans.max_marks ?? 1);
            const icon = ans.is_correct === true ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              : ans.is_correct === false ? <XCircle className="w-4 h-4 text-red-400 shrink-0" />
              : <Minus className="w-4 h-4 text-muted-foreground shrink-0" />;

            return (
              <motion.div key={ans.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: i * 0.04 } }}
                className="bg-card border border-border rounded-xl overflow-hidden">
                <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpand(ans.id)}>
                  {icon}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{ans.question_text ?? `Question ${i+1}`}</p>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                      {earned !== null && <span className={earned >= max * 0.5 ? "text-emerald-500" : "text-red-400"}>{earned}/{max} marks</span>}
                      <Badge variant="outline" className="text-[9px] px-1">{ans.question_type}</Badge>
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                </button>
                {isExpanded && (
                  <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} className="border-t border-border px-4 py-3 space-y-3">
                    {ans.answer_text && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Your Answer</p>
                        <p className="text-sm bg-muted/50 rounded-lg px-3 py-2">{ans.answer_text}</p>
                      </div>
                    )}
                    {ans.correct_answer && (
                      <div>
                        <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-1">Correct Answer</p>
                        <p className="text-sm text-emerald-600 bg-emerald-500/10 rounded-lg px-3 py-2">{ans.correct_answer}</p>
                      </div>
                    )}
                    {ans.model_answer && !ans.correct_answer && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Model Answer</p>
                        <p className="text-sm bg-muted/50 rounded-lg px-3 py-2">{ans.model_answer}</p>
                      </div>
                    )}
                    {ans.grader_feedback && (
                      <div>
                        <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-1">AI / Marker Feedback</p>
                        <p className="text-sm text-muted-foreground bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-2">{ans.grader_feedback}</p>
                      </div>
                    )}
                    {/* Mark progress */}
                    {earned !== null && (
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Marks awarded</span><span>{earned}/{max}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1">
                          <div className={`rounded-full h-1 ${earned >= max ? "bg-emerald-500" : earned >= max * 0.5 ? "bg-primary" : "bg-red-400"}`}
                            style={{ width: `${max > 0 ? (earned / max) * 100 : 0}%` }} />
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Appeal */}
      {graded && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" />Disagree with your grade?</p>
          {appealForm.open ? (
            <div className="space-y-3">
              <textarea
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none h-24 outline-none focus:ring-1 focus:ring-primary"
                placeholder="Explain why you think this grade should be reviewed…"
                value={appealForm.reason}
                onChange={e => setAppealForm(f => ({ ...f, reason: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setAppealForm({ open: false, reason: "" })}>Cancel</Button>
                <Button size="sm" onClick={() => submission?.id && appealMut.mutate(submission.id)} disabled={!appealForm.reason.trim() || appealMut.isPending}>
                  {appealMut.isPending ? "Submitting…" : "Submit Appeal"}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setAppealForm(f => ({ ...f, open: true }))}>
              Request Re-mark
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
