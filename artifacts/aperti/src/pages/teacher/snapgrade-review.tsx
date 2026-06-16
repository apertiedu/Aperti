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
import { AIStatusBanner } from "@/components/ai-status-banner";
import {
  CheckCircle2, XCircle, Edit3, ArrowLeft, User,
  BookOpen, Brain, AlertTriangle, Clock, ThumbsUp, ThumbsDown,
  Info, ChevronDown, ChevronUp, Sparkles,
} from "lucide-react";

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };

type Decision = "approved" | "modified" | "rejected";
type OverrideReason = "AI misinterpretation" | "Rubric disagreement" | "Partial credit adjustment" | "Manual correction";

function ConfidenceTierBadge({ level, confidence }: { level: "high" | "medium" | "low" | null; confidence: number | null }) {
  if (!level) return null;
  const pct = confidence != null ? Math.round(confidence * 100) : null;
  const map = {
    high:   { cls: "bg-emerald-100 text-emerald-700 border-emerald-200", label: `High confidence${pct != null ? ` (${pct}%)` : ""}` },
    medium: { cls: "bg-amber-100 text-amber-700 border-amber-200",       label: `Medium confidence${pct != null ? ` (${pct}%)` : ""}` },
    low:    { cls: "bg-rose-100 text-rose-700 border-rose-200",           label: `Low confidence${pct != null ? ` (${pct}%)` : ""}` },
  };
  const { cls, label } = map[level];
  return (
    <Badge className={`${cls} border text-xs font-medium`}>
      {level === "low" && <AlertTriangle size={10} className="mr-1" />}
      {label}
    </Badge>
  );
}

function QualityBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return null;
  const pct = Math.round(score * 100);
  const cls = pct >= 75 ? "bg-emerald-50 text-emerald-700" : pct >= 50 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700";
  const label = pct >= 75 ? "High quality" : pct >= 50 ? "Medium quality" : "Low quality";
  return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{label} ({pct}%)</span>;
}

export default function SnapGradeReview() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [decision, setDecision] = useState<Decision | null>(null);
  const [overrideGrade, setOverrideGrade] = useState("");
  const [overrideFeedback, setOverrideFeedback] = useState("");
  const [notes, setNotes] = useState("");
  const [overrideReason, setOverrideReason] = useState<OverrideReason | "">("");
  const [showReasoning, setShowReasoning] = useState(false);
  const [showQuality, setShowQuality] = useState(false);

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
    mutationFn: async (payload: {
      decision: Decision;
      override_grade?: number;
      override_feedback?: string;
      notes?: string;
      override_reason_category?: OverrideReason;
    }) => {
      const res = await apiFetch(`/api/snapgrade/submissions/${id}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Review failed");
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
      override_grade: decision !== "approved" && overrideGrade ? parseFloat(overrideGrade) : undefined,
      override_feedback: overrideFeedback || undefined,
      notes: notes || undefined,
      override_reason_category: (overrideReason as OverrideReason) || undefined,
    });
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Brain size={32} className="text-primary animate-pulse" />
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
  const confidenceLevel: "high" | "medium" | "low" | null = s.confidence_level ?? (
    confidence != null ? (confidence >= 0.85 ? "high" : confidence >= 0.65 ? "medium" : "low") : null
  );
  const requiresReview = s.requires_review === true || confidenceLevel === "low";
  const isMediumReview = confidenceLevel === "medium" && !s.teacher_reviewed;
  const alreadyReviewed = s.teacher_reviewed === true;

  const aiAnalysis = s.ai_analysis ?? {};
  const keywords = aiAnalysis.keywords_found ?? [];
  const missingKeywords = aiAnalysis.missing_keywords ?? [];
  const reasoningSummary: string | null = s.reasoning_summary ?? aiAnalysis.reasoning_summary ?? null;
  const uncertaintyFactors: string[] = s.uncertainty_factors ?? aiAnalysis.uncertainty_factors ?? [];
  const aiQualityScore = s.ai_quality_score ?? aiAnalysis.ai_quality_score ?? null;
  const qualityFactors = s.quality_factors ?? aiAnalysis.quality_factors ?? null;

  const aiGrade = s.grade != null ? parseFloat(s.grade) : null;
  const teacherFinalGrade = s.teacher_override_grade != null ? parseFloat(s.teacher_override_grade) : null;
  const gradeDelta = aiGrade != null && teacherFinalGrade != null ? teacherFinalGrade - aiGrade : null;

  const overrideReasonOptions: OverrideReason[] = [
    "AI misinterpretation",
    "Rubric disagreement",
    "Partial credit adjustment",
    "Manual correction",
  ];

  const whyAIMightBeWrong: string[] = [
    ...(uncertaintyFactors.length > 0 ? uncertaintyFactors : []),
    ...(confidence != null && confidence < 0.65 ? ["AI confidence below acceptable threshold"] : []),
    ...(aiAnalysis.source === "rule_based" ? ["Rule-based fallback was used (no AI model)"] : []),
    ...(aiAnalysis.status === "degraded" ? ["AI service was degraded during grading"] : []),
  ].filter(Boolean);

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
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {confidenceLevel && <ConfidenceTierBadge level={confidenceLevel} confidence={confidence} />}
          {alreadyReviewed && <Badge className="bg-emerald-100 text-emerald-700">Already Reviewed</Badge>}
        </div>
      </motion.div>

      {requiresReview && !alreadyReviewed && (
        <motion.div variants={fadeUp}>
          <AIStatusBanner
            status="low-confidence"
            message={`AI confidence is ${confidence !== null ? Math.round(confidence * 100) : "?"}% on this submission — below the 65% threshold. Teacher review is required.`}
          />
        </motion.div>
      )}

      {isMediumReview && (
        <motion.div variants={fadeUp}>
          <div className="flex items-start gap-3 p-3.5 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <Info size={15} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Medium confidence ({confidence != null ? Math.round(confidence * 100) : "?"}%) — a soft review is recommended. The AI grade is likely acceptable but benefits from a quick check.
            </p>
          </div>
        </motion.div>
      )}

      {alreadyReviewed && (
        <motion.div variants={fadeUp}>
          <AIStatusBanner status="available" message="This submission has already been reviewed. You can re-review it below." />
        </motion.div>
      )}

      <motion.div variants={fadeUp} className="grid sm:grid-cols-2 gap-4">
        <Card className="border border-border shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User size={14} className="text-primary" />
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
              <Brain size={14} className="text-primary" />
              AI Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-2xl font-bold text-foreground">
                {aiGrade != null ? aiGrade.toFixed(1) : "—"}
              </span>
              <span className="text-sm text-muted-foreground">marks</span>
              {aiQualityScore != null && <QualityBadge score={aiQualityScore} />}
            </div>
            <p className="text-xs text-muted-foreground">
              Source: {s.ai_source ?? "AI"} · {confidenceLevel ? `${confidenceLevel} confidence` : "unknown confidence"}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {(reasoningSummary || uncertaintyFactors.length > 0 || whyAIMightBeWrong.length > 0) && (
        <motion.div variants={fadeUp} className="space-y-2">
          <button
            className="w-full flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors text-left"
            onClick={() => setShowReasoning(v => !v)}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles size={14} className="text-primary" />
              AI Reasoning & Uncertainty
            </span>
            {showReasoning ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
          </button>

          {showReasoning && (
            <Card className="border border-border shadow-sm bg-card">
              <CardContent className="pt-4 space-y-4">
                {reasoningSummary && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Why this grade was assigned</p>
                    <p className="text-sm text-foreground leading-relaxed bg-muted/30 rounded-lg p-3">{reasoningSummary}</p>
                  </div>
                )}

                {whyAIMightBeWrong.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
                      <AlertTriangle size={11} />
                      Why AI might be wrong
                    </p>
                    <ul className="space-y-1.5">
                      {whyAIMightBeWrong.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {qualityFactors && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Quality factor breakdown</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(qualityFactors).map(([k, v]) => (
                        <div key={k} className="space-y-0.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                            <span className="text-foreground">{Math.round((v as number) * 100)}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${(v as number) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {s.homework_title && (
        <motion.div variants={fadeUp}>
          <Card className="border border-border shadow-sm bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BookOpen size={14} className="text-primary" />
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
                <Edit3 size={14} className="text-primary" />
                Teacher Decision
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
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
                    <Button key={d} variant="outline" size="sm" className={`gap-1.5 flex-1 ${colors[d]}`} onClick={() => setDecision(d)}>
                      {icons[d]}
                      {labels[d]}
                    </Button>
                  );
                })}
              </div>

              {decision && decision !== "approved" && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Override Reason</Label>
                  <div className="flex flex-wrap gap-2">
                    {overrideReasonOptions.map((r) => (
                      <button
                        key={r}
                        onClick={() => setOverrideReason(r === overrideReason ? "" : r)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                          overrideReason === r
                            ? "bg-primary text-white border-primary"
                            : "border-border text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {decision === "modified" && (
                <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/20">
                  <div className="grid grid-cols-2 gap-4 p-2 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-xs text-muted-foreground">AI Grade</p>
                      <p className="text-xl font-bold text-foreground">{aiGrade != null ? aiGrade.toFixed(1) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Your Grade</p>
                      <p className="text-xl font-bold text-primary">{overrideGrade || "?"}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Override Grade</Label>
                    <Input
                      type="number"
                      placeholder={`AI gave: ${s.grade ?? "?"}`}
                      value={overrideGrade}
                      onChange={(e) => setOverrideGrade(e.target.value)}
                      min={0} step={0.5}
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
                    The AI grade will be removed and the submission marked as requiring manual grading.
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
                  className="bg-primary hover:bg-primary/80 text-white gap-1.5"
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

      {alreadyReviewed && (
        <motion.div variants={fadeUp}>
          <Card className="border border-border shadow-sm bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600" />
                Review Record
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Original AI Grade</p>
                  <p className="text-xl font-bold text-foreground">{aiGrade != null ? aiGrade.toFixed(1) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Final Teacher Grade</p>
                  <p className="text-xl font-bold text-emerald-600">{teacherFinalGrade != null ? teacherFinalGrade.toFixed(1) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Grade Delta</p>
                  <p className={`text-xl font-bold ${gradeDelta == null ? "text-muted-foreground" : gradeDelta > 0 ? "text-emerald-600" : gradeDelta < 0 ? "text-rose-600" : "text-foreground"}`}>
                    {gradeDelta != null ? `${gradeDelta > 0 ? "+" : ""}${gradeDelta.toFixed(1)}` : "—"}
                  </p>
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
