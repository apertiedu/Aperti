import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AIStatusBanner, ConfidenceBadge } from "@/components/ai-status-banner";
import {
  CheckCircle2, XCircle, Edit3, ArrowLeft, User,
  BookOpen, Brain, AlertTriangle, Clock, ThumbsUp, ThumbsDown,
} from "lucide-react";

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };

type Decision = "approved" | "modified" | "rejected";

export default function SnapGradeReview() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [decision, setDecision] = useState<Decision | null>(null);
  const [overrideGrade, setOverrideGrade] = useState("");
  const [overrideFeedback, setOverrideFeedback] = useState("");
  const [notes, setNotes] = useState("");

  const { data: submission, isLoading, error } = useQuery({
    queryKey: ["snapgrade-submission", id],
    queryFn: async () => {
      const res = await apiFetch(`/api/snapgrade/submissions/${id}`);
      if (!res.ok) throw new Error("Submission not found");
      return res.json();
    },
    enabled: !!id,
  });

  const reviewMutation = useMutation({
    mutationFn: async (payload: { decision: Decision; override_grade?: number; override_feedback?: string; notes?: string }) => {
      const res = await apiFetch(`/api/snapgrade/submissions/${id}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Review failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Review saved", description: data.message });
      qc.invalidateQueries({ queryKey: ["snapgrade-submission", id] });
      qc.invalidateQueries({ queryKey: ["admin-ai-pending-reviews"] });
      navigate("/teacher/snapgrade");
    },
    onError: (err: Error) => {
      toast({ title: "Review failed", description: err.message, variant: "destructive" });
    },
  });

  function handleSubmit() {
    if (!decision) return;
    reviewMutation.mutate({
      decision,
      override_grade: decision === "approved" ? undefined : overrideGrade ? parseFloat(overrideGrade) : undefined,
      override_feedback: overrideFeedback || undefined,
      notes: notes || undefined,
    });
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Brain size={32} className="text-teal-500 animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading submission...</p>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <AIStatusBanner
          status="unavailable"
          message="Could not load this submission. It may have already been reviewed or deleted."
          onManual={() => navigate(-1 as any)}
        />
      </div>
    );
  }

  const s = submission;
  const confidence: number | null = s.ai_confidence != null ? parseFloat(s.ai_confidence) : null;
  const isLowConfidence = confidence !== null && confidence < 0.65;
  const alreadyReviewed = s.teacher_reviewed === true;

  const aiAnalysis = s.ai_analysis ?? {};
  const keywords = aiAnalysis.keywords_found ?? [];
  const missingKeywords = aiAnalysis.missing_keywords ?? [];

  return (
    <motion.div
      className="max-w-3xl mx-auto px-4 py-8 space-y-5"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
    >
      <motion.div variants={fadeUp} className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1 as any)} className="gap-1.5">
          <ArrowLeft size={15} />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">SnapGrade Review</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Human override for AI-marked submission</p>
        </div>
        {alreadyReviewed ? (
          <Badge className="bg-emerald-100 text-emerald-700">Already Reviewed</Badge>
        ) : isLowConfidence ? (
          <Badge className="bg-amber-100 text-amber-700 gap-1"><AlertTriangle size={11} /> Review Required</Badge>
        ) : null}
      </motion.div>

      {isLowConfidence && !alreadyReviewed && (
        <motion.div variants={fadeUp}>
          <AIStatusBanner
            status="low-confidence"
            message={`AI confidence is ${confidence !== null ? Math.round(confidence * 100) : "?"}% on this submission — below the 65% threshold. Please review and confirm or override the AI grade.`}
          />
        </motion.div>
      )}

      {alreadyReviewed && (
        <motion.div variants={fadeUp}>
          <AIStatusBanner
            status="available"
            message="This submission has already been reviewed. You can re-review it below."
          />
        </motion.div>
      )}

      <motion.div variants={fadeUp} className="grid sm:grid-cols-2 gap-4">
        <Card className="border border-border shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User size={14} className="text-teal-600" />
              Student
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm font-medium text-foreground">{s.student_name ?? "Unknown Student"}</p>
            <p className="text-xs text-muted-foreground">{s.student_code ?? ""}</p>
            <p className="text-xs text-muted-foreground">
              Submitted {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Brain size={14} className="text-teal-600" />
              AI Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-foreground">
                {s.grade != null ? parseFloat(s.grade).toFixed(1) : "—"}
              </span>
              <span className="text-sm text-muted-foreground">marks</span>
              <ConfidenceBadge confidence={confidence} />
            </div>
            <p className="text-xs text-muted-foreground">
              Source: {s.ai_source ?? "AI"} · {isLowConfidence ? "Low confidence" : "Acceptable confidence"}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {s.homework_title && (
        <motion.div variants={fadeUp}>
          <Card className="border border-border shadow-sm bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BookOpen size={14} className="text-teal-600" />
                Assignment: {s.homework_title}
              </CardTitle>
            </CardHeader>
          </Card>
        </motion.div>
      )}

      {s.ocr_text && (
        <motion.div variants={fadeUp}>
          <Card className="border border-border shadow-sm bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Extracted Text (OCR)</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs text-foreground whitespace-pre-wrap font-mono bg-muted/40 rounded-lg p-3 max-h-48 overflow-y-auto">
                {s.ocr_text}
              </pre>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div variants={fadeUp}>
        <Card className="border border-border shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">AI Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {s.feedback ? (
              <p className="text-sm text-foreground leading-relaxed">{s.feedback}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No AI feedback generated.</p>
            )}
            {(keywords.length > 0 || missingKeywords.length > 0) && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                {keywords.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">Keywords found</p>
                    <div className="flex flex-wrap gap-1">
                      {keywords.slice(0, 6).map((k: string) => (
                        <span key={k} className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{k}</span>
                      ))}
                    </div>
                  </div>
                )}
                {missingKeywords.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-rose-700 dark:text-rose-400 mb-1">Missing keywords</p>
                    <div className="flex flex-wrap gap-1">
                      {missingKeywords.slice(0, 6).map((k: string) => (
                        <span key={k} className="text-xs px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">{k}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {!alreadyReviewed && (
        <motion.div variants={fadeUp}>
          <Card className="border border-border shadow-sm bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Edit3 size={14} className="text-teal-600" />
                Teacher Decision
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {(["approved", "modified", "rejected"] as Decision[]).map((d) => {
                  const labels: Record<Decision, string> = { approved: "Approve AI Grade", modified: "Modify Grade", rejected: "Reject — Manual Required" };
                  const icons: Record<Decision, React.ReactNode> = {
                    approved: <ThumbsUp size={13} />,
                    modified: <Edit3 size={13} />,
                    rejected: <ThumbsDown size={13} />,
                  };
                  const colors: Record<Decision, string> = {
                    approved: decision === d ? "bg-emerald-600 text-white border-emerald-600" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
                    modified: decision === d ? "bg-amber-600 text-white border-amber-600" : "border-amber-200 text-amber-700 hover:bg-amber-50",
                    rejected: decision === d ? "bg-rose-600 text-white border-rose-600" : "border-rose-200 text-rose-700 hover:bg-rose-50",
                  };
                  return (
                    <Button
                      key={d}
                      variant="outline"
                      size="sm"
                      className={`gap-1.5 flex-1 ${colors[d]}`}
                      onClick={() => setDecision(d)}
                    >
                      {icons[d]}
                      {labels[d]}
                    </Button>
                  );
                })}
              </div>

              {decision === "modified" && (
                <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/20">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Override Grade</Label>
                    <Input
                      type="number"
                      placeholder={`AI gave: ${s.grade ?? "?"}`}
                      value={overrideGrade}
                      onChange={(e) => setOverrideGrade(e.target.value)}
                      min={0}
                      step={0.5}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Override Feedback</Label>
                    <Textarea
                      placeholder="Enter revised feedback for the student..."
                      value={overrideFeedback}
                      onChange={(e) => setOverrideFeedback(e.target.value)}
                      className="text-sm min-h-[80px] resize-none"
                    />
                  </div>
                </div>
              )}

              {decision === "rejected" && (
                <div className="flex items-start gap-2 p-3 rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-800">
                  <XCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-700 dark:text-rose-400">
                    The AI grade will be removed and the submission marked as requiring manual grading. You can assign a manual grade from the gradebook.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Internal Notes (optional)</Label>
                <Textarea
                  placeholder="Notes for audit trail — not shown to student..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-sm min-h-[60px] resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock size={12} />
                  {decision === "approved"
                    ? "AI grade will be accepted as final"
                    : decision === "modified"
                    ? "Your grade will replace the AI grade"
                    : decision === "rejected"
                    ? "Submission returned for manual grading"
                    : "Select a decision above"}
                </div>
                <Button
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
                  disabled={!decision || reviewMutation.isPending}
                  onClick={handleSubmit}
                >
                  <CheckCircle2 size={13} />
                  {reviewMutation.isPending ? "Saving..." : "Save Review"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {alreadyReviewed && s.teacher_override_grade != null && (
        <motion.div variants={fadeUp}>
          <Card className="border border-border shadow-sm bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600" />
                Review Record
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Original AI Grade</p>
                  <p className="text-lg font-bold text-foreground">{s.grade != null ? parseFloat(s.grade).toFixed(1) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Final Teacher Grade</p>
                  <p className="text-lg font-bold text-emerald-600">{parseFloat(s.teacher_override_grade).toFixed(1)}</p>
                </div>
              </div>
              {s.reviewed_at && (
                <p className="text-xs text-muted-foreground">
                  Reviewed {new Date(s.reviewed_at).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
