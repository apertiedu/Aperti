import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, CheckCircle2, Sparkles, FileText,
  User, Clock, AlertCircle, Send, AlertTriangle, ShieldCheck, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const API = "/api";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    ...opts,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

type ConfidenceLevel = "high" | "medium" | "low";

function ConfidenceBadge({ level, score }: { level: ConfidenceLevel; score?: number }) {
  const config = {
    high:   { label: "High confidence",   bg: "bg-emerald-50 border-emerald-200 text-emerald-700", icon: <ShieldCheck className="h-3 w-3" /> },
    medium: { label: "Medium confidence", bg: "bg-amber-50 border-amber-200 text-amber-700",       icon: <Info className="h-3 w-3" /> },
    low:    { label: "Low confidence",    bg: "bg-red-50 border-red-200 text-red-700",              icon: <AlertTriangle className="h-3 w-3" /> },
  };
  const c = config[level];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${c.bg}`}>
      {c.icon}
      {c.label}{score !== undefined ? ` (${Math.round(score * 100)}%)` : ""}
    </span>
  );
}

export default function GradeFlow() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedHwId, setSelectedHwId] = useState<number | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiConfidence, setAiConfidence] = useState<{ level: ConfidenceLevel; score: number } | null>(null);
  const [aiMisconceptions, setAiMisconceptions] = useState<string[]>([]);

  const { data: hwList, isLoading: hwLoading } = useQuery<any[]>({
    queryKey: ["homework-teacher"],
    queryFn: () => apiFetch("/homework/teacher"),
  });

  const homeworks: any[] = Array.isArray(hwList) ? hwList : (hwList as any)?.homework ?? [];

  const { data: submissions, isLoading: subLoading } = useQuery<any[]>({
    queryKey: ["submissions", selectedHwId],
    queryFn: () => apiFetch(`/homework/${selectedHwId}/submissions`),
    enabled: !!selectedHwId,
  });

  const pending: any[] = (Array.isArray(submissions) ? submissions : []).filter(s => s.status === "submitted" || !s.marks_awarded);
  const current = pending[currentIdx] ?? null;

  const { data: rubric } = useQuery<any>({
    queryKey: ["homework-rubric", selectedHwId],
    queryFn: async () => {
      const hw = homeworks.find(h => h.id === selectedHwId);
      if (!hw?.rubric_id) return null;
      return apiFetch(`/rubrics/${hw.rubric_id}`);
    },
    enabled: !!selectedHwId,
  });

  const selectedHw = homeworks.find(h => h.id === selectedHwId);
  const criteria: any[] = rubric?.criteria ?? [];
  const totalMax = criteria.length > 0
    ? criteria.reduce((s: number, c: any) => s + Number(c.marks || 0), 0)
    : Number(selectedHw?.total_marks ?? 0);
  const totalAwarded = Object.values(marks).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  const gradeMutation = useMutation({
    mutationFn: ({ subId, marksAwarded, tf }: any) =>
      apiFetch(`/homework/${selectedHwId}/submissions/${subId}/grade`, {
        method: "POST",
        body: JSON.stringify({ marksAwarded, teacherFeedback: tf }),
      }),
    onMutate: async ({ subId }: any) => {
      await queryClient.cancelQueries({ queryKey: ["submissions", selectedHwId] });
      const prev = queryClient.getQueryData<any[]>(["submissions", selectedHwId]);
      queryClient.setQueryData<any[]>(["submissions", selectedHwId], old =>
        (old ?? []).map(s => s.id === subId ? { ...s, status: "graded", marks_awarded: totalAwarded } : s)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(["submissions", selectedHwId], ctx.prev);
      toast({ title: "Grading failed", description: "Could not save grade. Please try again.", variant: "destructive" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions", selectedHwId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "assignment-queue"] });
      toast({ title: "Graded!", description: `${current?.student_name ?? "Student"} graded successfully.` });
      setMarks({});
      setFeedback("");
      setAiConfidence(null);
      setAiMisconceptions([]);
      if (currentIdx > 0) setCurrentIdx(i => i - 1);
    },
  });

  async function handleAiFeedback() {
    if (!current || !selectedHw) return;
    setAiLoading(true);
    setAiConfidence(null);
    setAiMisconceptions([]);
    try {
      const data = await apiFetch("/tutorcraft/generate-feedback", {
        method: "POST",
        body: JSON.stringify({
          student_answer: current.content ?? "No answer provided",
          model_answer: selectedHw.description ?? "",
          marks_awarded: totalAwarded,
          max_marks: totalMax,
          question_text: selectedHw.title ?? selectedHw.description,
        }),
      });
      setFeedback(data.feedback ?? "");

      // Parse confidence from response
      if (data.confidence !== undefined) {
        const score = typeof data.confidence === "number" ? data.confidence : 0.7;
        const level: ConfidenceLevel = score >= 0.75 ? "high" : score >= 0.55 ? "medium" : "low";
        setAiConfidence({ level, score });
      } else {
        // Infer from marks ratio: high match = high confidence
        const ratio = totalMax > 0 ? totalAwarded / totalMax : 0.5;
        const score = 0.5 + ratio * 0.4;
        const level: ConfidenceLevel = score >= 0.75 ? "high" : score >= 0.55 ? "medium" : "low";
        setAiConfidence({ level, score });
      }

      if (data.misconceptions?.length) {
        setAiMisconceptions(data.misconceptions);
      }
    } catch {
      toast({ title: "AI feedback unavailable", description: "Write teacher feedback manually below.", variant: "destructive" });
      setFeedback(prev => prev || "");
    } finally {
      setAiLoading(false);
    }
  }

  function handleSubmitGrade() {
    if (!current) return;
    gradeMutation.mutate({ subId: current.id, marksAwarded: totalAwarded, tf: feedback });
  }

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-3xl font-bold">GradeFlow™</h1>
        <p className="text-muted-foreground text-sm">Split-screen marking workspace with AI feedback.</p>
      </motion.div>

      {/* Assignment selector */}
      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-48 space-y-1">
            <Label className="text-xs">Select Assignment</Label>
            {hwLoading ? <Skeleton className="h-9 w-full" /> : (
              <Select onValueChange={v => { setSelectedHwId(Number(v)); setCurrentIdx(0); setMarks({}); setFeedback(""); setAiConfidence(null); }}>
                <SelectTrigger><SelectValue placeholder="Choose an assignment…" /></SelectTrigger>
                <SelectContent>
                  {homeworks.map((hw: any) => (
                    <SelectItem key={hw.id} value={String(hw.id)}>
                      {hw.title} {hw.total_marks ? `(${hw.total_marks} marks)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {selectedHwId && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{pending.length} pending</span>
              {pending.length > 0 && (
                <Progress value={(currentIdx / pending.length) * 100} className="w-24 h-2" />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {!selectedHwId ? (
        <Card>
          <CardContent className="p-16 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Select an assignment to begin marking</p>
            <p className="text-sm mt-1">Assignments with pending submissions will appear in the list above.</p>
          </CardContent>
        </Card>
      ) : subLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-[500px] rounded-xl" />
          <Skeleton className="h-[500px] rounded-xl" />
        </div>
      ) : pending.length === 0 ? (
        <Card>
          <CardContent className="p-16 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500" />
            <p className="font-medium text-lg">All submissions graded!</p>
            <p className="text-muted-foreground text-sm mt-1">No pending submissions for this assignment.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* LEFT: Student Submission */}
          <AnimatePresence mode="wait">
            <motion.div key={current?.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <Card className="h-[600px] flex flex-col">
                <CardHeader className="pb-3 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">{current?.student_name ?? "Student"}</CardTitle>
                      <Badge variant="outline" className="text-xs">{current?.student_code ?? ""}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentIdx === 0} onClick={() => setCurrentIdx(i => i - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground">{currentIdx + 1} / {pending.length}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={currentIdx === pending.length - 1} onClick={() => setCurrentIdx(i => i + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="flex items-center gap-1 text-xs">
                    <Clock className="h-3 w-3" />
                    {current?.submitted_at ? `Submitted ${new Date(current.submitted_at).toLocaleString()}` : "Draft"}
                    {current?.is_late && <Badge variant="destructive" className="ml-2 text-[10px] h-4">Late</Badge>}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-4 pt-0">
                  <ScrollArea className="h-full">
                    {current?.file_url ? (
                      <div className="p-3 bg-muted rounded-lg">
                        <a href={current.file_url} target="_blank" rel="noopener noreferrer"
                          className="text-primary text-sm underline flex items-center gap-2">
                          <FileText className="h-4 w-4" /> View submitted file
                        </a>
                      </div>
                    ) : current?.content ? (
                      <div className="p-3 bg-muted/50 rounded-lg min-h-[200px]">
                        <p className="text-sm whitespace-pre-wrap">{current.content}</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm p-4">
                        <AlertCircle className="h-4 w-4" /> No submission content
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>

          {/* RIGHT: Marking Panel */}
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-3 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Mark Sheet</CardTitle>
                <Badge className={cn("text-xs", totalAwarded > 0 ? "bg-primary" : "bg-muted text-muted-foreground")}>
                  {totalAwarded} / {totalMax} marks
                </Badge>
              </div>

              {/* AI confidence indicator */}
              <AnimatePresence>
                {aiConfidence && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-2 pt-1">
                      <ConfidenceBadge level={aiConfidence.level} score={aiConfidence.score} />
                      {aiConfidence.level === "low" && (
                        <span className="text-[10px] text-red-600 font-medium">Review carefully — AI uncertain</span>
                      )}
                    </div>
                    {aiMisconceptions.length > 0 && (
                      <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-[10px] font-semibold text-amber-800 mb-1">Possible misconceptions detected:</p>
                        {aiMisconceptions.slice(0, 2).map((m, i) => (
                          <p key={i} className="text-[10px] text-amber-700">• {m}</p>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Low confidence mandatory review banner */}
              <AnimatePresence>
                {aiConfidence?.level === "low" && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg mt-1"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-red-700 font-medium">
                      AI confidence is low for this submission. Please manually review the mark scheme criteria before submitting.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-4 pt-0 flex flex-col gap-3">
              <ScrollArea className="flex-1">
                {criteria.length > 0 ? (
                  <div className="space-y-3">
                    {criteria.map((c: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg border bg-card">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="text-sm font-medium">{c.keyword}</p>
                            {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                          </div>
                          <Badge variant="secondary" className="text-xs shrink-0">/{c.marks}</Badge>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          max={Number(c.marks)}
                          placeholder={`0–${c.marks}`}
                          className="h-8 text-sm"
                          value={marks[`c${i}`] ?? ""}
                          onChange={e => setMarks(m => ({ ...m, [`c${i}`]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 pb-3">
                    <Label className="text-xs">Marks Awarded</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={totalMax}
                        placeholder="0"
                        className="h-9"
                        value={marks["total"] ?? ""}
                        onChange={e => setMarks({ total: e.target.value })}
                      />
                      <span className="text-sm text-muted-foreground shrink-0">/ {totalMax}</span>
                    </div>
                    {totalMax > 0 && marks["total"] && (
                      <Progress value={(parseFloat(marks["total"]) / totalMax) * 100} className="h-2" />
                    )}
                  </div>
                )}
              </ScrollArea>

              {/* Feedback */}
              <div className="space-y-1.5 shrink-0">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Teacher Feedback</Label>
                  <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-primary" onClick={handleAiFeedback} disabled={aiLoading}>
                    <Sparkles className="h-3 w-3" /> {aiLoading ? "Generating…" : "AI Draft"}
                  </Button>
                </div>
                <Textarea
                  rows={3}
                  placeholder="Enter feedback for the student…"
                  className={cn("text-sm resize-none transition-colors", aiConfidence?.level === "low" && "border-red-300 focus-visible:ring-red-300")}
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                />
              </div>

              <Button
                className="w-full gap-2 shrink-0"
                onClick={handleSubmitGrade}
                disabled={gradeMutation.isPending || (aiConfidence?.level === "low" && !feedback.trim())}
              >
                <Send className="h-4 w-4" />
                {gradeMutation.isPending
                  ? "Saving…"
                  : aiConfidence?.level === "low" && !feedback.trim()
                    ? "Add feedback before submitting"
                    : "Submit Grade"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
