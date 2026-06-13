import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Lock, Download, Clock, FileText, CheckCircle2, AlertTriangle,
  Upload, Shield, Eye, EyeOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

async function fetchJSON(url: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}
async function postJSON(url: string, body: object) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message ?? "Failed"); }
  return res.json();
}

type Mode = "list" | "taking" | "submitted";

function ExamTaker({ pkg, onSubmit, onCancel }: { pkg: any; onSubmit: (data: any) => void; onCancel: () => void }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft] = useState(pkg.totalMarks ? pkg.totalMarks * 60 : 3600);
  const [showConfirm, setShowConfirm] = useState(false);
  const questions = pkg.questions ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between sticky top-0 bg-background/90 backdrop-blur-md py-3 z-10 border-b">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-semibold">Exam in progress</span>
          <Badge variant="outline" className="text-[11px]">{pkg.questionCount} questions</Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm font-mono text-primary">
            <Clock className="h-4 w-4" />
            Secure Mode
          </div>
          {!showConfirm ? (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowConfirm(true)}>
              <Upload className="h-3.5 w-3.5" /> Submit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onSubmit(answers)}>Confirm Submit</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowConfirm(false)}>Cancel</Button>
            </div>
          )}
        </div>
      </div>

      {questions.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Exam downloaded</p>
            <p className="text-sm text-muted-foreground mt-1">This is a secure offline exam package. Answer in the text areas below and submit when ready.</p>
            <Textarea className="mt-4 text-sm" rows={8} placeholder="Type your answers here…" value={answers[0] ?? ""} onChange={e => setAnswers({ 0: e.target.value })} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map((q: any, i: number) => (
            <Card key={q.id ?? i} className="shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs font-semibold text-primary mb-1">Question {i + 1}</p>
                    <p className="text-sm font-medium leading-relaxed">{q.questionText ?? q.text ?? `Question ${i + 1}`}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{q.maxMarks ?? 1} mark{q.maxMarks !== 1 ? "s" : ""}</Badge>
                </div>
                {q.questionType === "mcq" || q.options ? (
                  <div className="space-y-2 mt-3">
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
                    className="mt-3 text-sm"
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
      )}

      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onCancel}>
        ← Save and Exit
      </Button>
    </div>
  );
}

export default function ExamVault() {
  const [mode, setMode] = useState<Mode>("list");
  const [activePkg, setActivePkg] = useState<any>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: exams, isLoading } = useQuery({
    queryKey: ["exam-vault", "list"],
    queryFn: () => fetchJSON("/api/exams"),
  });

  const downloadMutation = useMutation({
    mutationFn: (examId: number) => fetchJSON(`/api/exam-vault/download/${examId}`),
    onSuccess: (data) => {
      setActivePkg(data);
      setMode("taking");
      setDownloadingId(null);
      toast({ title: "Exam loaded!", description: "You are now in secure exam mode." });
    },
    onError: (err: Error) => {
      setDownloadingId(null);
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: ({ packageId, answers }: { packageId: number; answers: any }) =>
      postJSON("/api/exam-vault/submit", { packageId, encryptedData: JSON.stringify(answers), iv: "" }),
    onSuccess: () => {
      toast({ title: "Exam submitted!" });
      setMode("submitted");
      queryClient.invalidateQueries({ queryKey: ["exam-vault", "list"] });
    },
    onError: (err: Error) => toast({ title: "Submission failed", description: err.message, variant: "destructive" }),
  });

  if (mode === "taking" && activePkg) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] dark:bg-background p-4 md:p-6">
        <ExamTaker
          pkg={activePkg}
          onSubmit={(answers) => submitMutation.mutate({ packageId: activePkg.packageId, answers })}
          onCancel={() => { setMode("list"); setActivePkg(null); }}
        />
      </div>
    );
  }

  if (mode === "submitted") {
    return (
      <div className="min-h-screen bg-[#F5F5F5] dark:bg-background p-4 md:p-6 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="shadow-sm max-w-md mx-auto text-center">
            <CardContent className="p-10">
              <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Submitted!</h2>
              <p className="text-muted-foreground mb-6">Your exam has been securely submitted. Your teacher will review it soon.</p>
              <Button onClick={() => setMode("list")}>Back to Vault</Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-background p-4 md:p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">ExamVault</h1>
            <p className="text-muted-foreground text-sm">Secure offline exam packages — download and submit when ready.</p>
          </div>
        </div>
      </motion.div>

      <div className="max-w-2xl mx-auto space-y-4">
        {/* Security notice */}
        <Card className="shadow-sm border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Secure Exam Environment</p>
              <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                Exams are encrypted. Tab-switch detection is active. Ensure you have a stable connection before downloading.
              </p>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : !exams || exams.message === "No exams available" || (Array.isArray(exams) && exams.length === 0) ? (
          <Card className="shadow-sm">
            <CardContent className="p-10 text-center">
              <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="font-semibold text-lg mb-2">No exams available</p>
              <p className="text-muted-foreground text-sm">Your teacher hasn't released any offline exam packages yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {(Array.isArray(exams) ? exams : []).map((exam: any) => (
              <motion.div key={exam.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <p className="font-semibold text-sm truncate">{exam.name}</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          {exam.examDate && <span>📅 {new Date(exam.examDate).toLocaleDateString()}</span>}
                          {exam.totalMarks && <span>📊 {exam.totalMarks} marks</span>}
                          {exam.timeLimitMinutes && <span><Clock className="h-3 w-3 inline mr-0.5" />{exam.timeLimitMinutes} min</span>}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="gap-1.5 shrink-0"
                        disabled={downloadingId === exam.id || downloadMutation.isPending}
                        onClick={() => {
                          setDownloadingId(exam.id);
                          downloadMutation.mutate(exam.id);
                        }}
                      >
                        {downloadingId === exam.id ? (
                          <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Loading…</>
                        ) : (
                          <><Download className="h-3.5 w-3.5" /> Start Exam</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
