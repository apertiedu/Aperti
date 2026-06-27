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
  ChevronLeft, ChevronRight, CheckCircle2, FileText,
  User, Clock, AlertCircle, Send,
} from "lucide-react";
import { AppEmptyState } from "@/components/app-empty-state";
import { useToast } from "@/hooks/use-toast";
import { StatusButton, useMutationStatus } from "@/components/ui/status-button";
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

export default function GradeFlow() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedHwId, setSelectedHwId] = useState<number | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");

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
      if (currentIdx > 0) setCurrentIdx(i => i - 1);
    },
  });

  function handleSubmitGrade() {
    if (!current) return;
    gradeMutation.mutate({ subId: current.id, marksAwarded: totalAwarded, tf: feedback });
  }

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-3xl font-bold">GradeFlow™</h1>
        <p className="text-muted-foreground text-sm">Split-screen marking workspace. Teachers grade; teachers approve.</p>
      </motion.div>

      {/* Assignment selector */}
      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-48 space-y-1">
            <Label className="text-xs">Select Assignment</Label>
            {hwLoading ? <Skeleton className="h-9 w-full" /> : (
              <Select onValueChange={v => { setSelectedHwId(Number(v)); setCurrentIdx(0); setMarks({}); setFeedback(""); }}>
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
        <AppEmptyState
          type="homework"
          title="Select an assignment to begin marking"
          description="Assignments with pending submissions will appear in the list above."
          size="lg"
        />
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
                <Label className="text-xs">Teacher Feedback</Label>
                <Textarea
                  rows={3}
                  placeholder="Enter feedback for the student…"
                  className="text-sm resize-none"
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                />
              </div>

              <StatusButton
                status={useMutationStatus(gradeMutation.isPending, gradeMutation.isSuccess, gradeMutation.isError)}
                idleText={<><Send className="h-4 w-4" />Submit Grade</>}
                loadingText="Saving grade…"
                successText="Grade saved"
                errorText="Save failed"
                onClick={handleSubmitGrade}
                disabled={gradeMutation.isPending}
                className="w-full"
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
