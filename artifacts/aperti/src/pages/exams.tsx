import { apiFetch } from "@/lib/api";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList, Plus, Trash2, Eye, ChevronRight, CheckCircle2,
  Monitor, FileQuestion, PenLine, Clock, AlignLeft
} from "lucide-react";
import { AppEmptyState } from "@/components/app-empty-state";

type Subject = { id: number; name: string };
type Exam = {
  id: number; name: string; subjectId: number | null; examDate: string | null;
  totalMarks: string | null; timeLimitMinutes: number | null; createdAt: string
};
type Question = {
  id: number; examId: number; questionText: string | null; topic: string | null;
  maxMarks: string; questionOrder: number; questionType: string;
  options: string[] | null; correctOption: number | null;
};
type Student = { id: number; studentCode: string; studentName: string };
type Mark = { studentId: number; questionId: number; marksScored: string | null; mistakes: string | null };

const OPTION_LABELS = ["A", "B", "C", "D"];

const emptyQForm = {
  questionText: "", topic: "", maxMarks: "", questionType: "written",
  options: ["", "", "", ""], correctOption: 0,
};

export default function Exams() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAssistant = user?.role === "assistant";

  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [savingExam, setSavingExam] = useState(false);
  const [examForm, setExamForm] = useState({ name: "", subjectId: "", examDate: "", totalMarks: "", timeLimitMinutes: "" });

  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [examDetail, setExamDetail] = useState<{ exam: Exam; questions: Question[]; students: Student[]; marks: Mark[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [isAddQOpen, setIsAddQOpen] = useState(false);
  const [qForm, setQForm] = useState(emptyQForm);
  const [savingQ, setSavingQ] = useState(false);

  const [markData, setMarkData] = useState<Record<string, { marksScored: string; mistakes: string }>>({});
  const [savingMarks, setSavingMarks] = useState(false);

  const [results, setResults] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [examsRes, subjectsRes] = await Promise.all([
        apiFetch("/api/exams", { credentials: "include" }),
        apiFetch("/api/subjects", { credentials: "include" }),
      ]);
      if (examsRes.ok) setExams(await examsRes.json());
      if (subjectsRes.ok) setSubjects(await subjectsRes.json());
    } finally { setLoading(false); }
  };

  const loadDetail = async (examId: number) => {
    setDetailLoading(true);
    try {
      const res = await apiFetch(`/api/exams/${examId}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setExamDetail(data);
        const md: Record<string, { marksScored: string; mistakes: string }> = {};
        for (const m of data.marks) {
          md[`${m.studentId}_${m.questionId}`] = {
            marksScored: m.marksScored ?? "", mistakes: m.mistakes ?? "",
          };
        }
        setMarkData(md);
      }
    } finally { setDetailLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (selectedExam) { loadDetail(selectedExam.id); setShowResults(false); } }, [selectedExam]);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingExam(true);
    try {
      const res = await apiFetch("/api/exams", {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...examForm,
          subjectId: examForm.subjectId || null,
          totalMarks: examForm.totalMarks || null,
          timeLimitMinutes: examForm.timeLimitMinutes ? parseInt(examForm.timeLimitMinutes) : null,
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message); }
      toast({ title: "Exam created" });
      setIsAddOpen(false);
      setExamForm({ name: "", subjectId: "", examDate: "", totalMarks: "", timeLimitMinutes: "" });
      load();
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSavingExam(false); }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExam) return;
    if (qForm.questionType === "mcq") {
      const filled = qForm.options.filter(o => o.trim());
      if (filled.length < 2) { toast({ title: "Add at least 2 MCQ options", variant: "destructive" }); return; }
    }
    setSavingQ(true);
    try {
      const body: any = {
        questionText: qForm.questionText,
        topic: qForm.topic,
        maxMarks: parseFloat(qForm.maxMarks),
        questionOrder: (examDetail?.questions.length ?? 0) + 1,
        questionType: qForm.questionType,
      };
      if (qForm.questionType === "mcq") {
        body.options = qForm.options.filter(o => o.trim());
        body.correctOption = qForm.correctOption;
      }
      const res = await apiFetch(`/api/exams/${selectedExam.id}/questions`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to add question");
      toast({ title: "Question added" });
      setIsAddQOpen(false);
      setQForm(emptyQForm);
      loadDetail(selectedExam.id);
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSavingQ(false); }
  };

  const handleDeleteQuestion = async (qId: number) => {
    if (!confirm("Delete this question? All marks for it will be lost.")) return;
    await apiFetch(`/api/exam-questions/${qId}`, { method: "DELETE" });
    toast({ title: "Question deleted" });
    if (selectedExam) loadDetail(selectedExam.id);
  };

  const handleSaveMarks = async () => {
    if (!selectedExam || !examDetail) return;
    setSavingMarks(true);
    try {
      const marks = [];
      for (const student of examDetail.students) {
        for (const q of examDetail.questions) {
          const key = `${student.id}_${q.id}`;
          const entry = markData[key];
          if (entry) {
            marks.push({
              studentId: student.id, questionId: q.id,
              marksScored: entry.marksScored !== "" ? parseFloat(entry.marksScored) : null,
              mistakes: entry.mistakes || null,
            });
          }
        }
      }
      const res = await apiFetch(`/api/exams/${selectedExam.id}/marks`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marks }),
      });
      if (!res.ok) throw new Error("Failed to save marks");
      toast({ title: "Marks saved successfully" });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSavingMarks(false); }
  };

  const handleLoadResults = async () => {
    if (!selectedExam) return;
    const res = await apiFetch(`/api/exams/${selectedExam.id}/results`, { credentials: "include" });
    if (res.ok) { setResults(await res.json()); setShowResults(true); }
  };

  const handleDeleteExam = async (id: number) => {
    if (!confirm("Delete this exam and all its data?")) return;
    await apiFetch(`/api/exams/${id}`, { method: "DELETE" });
    toast({ title: "Exam deleted" });
    if (selectedExam?.id === id) setSelectedExam(null);
    load();
  };

  // ── EXAM DETAIL VIEW ────────────────────────────────────────────────────────
  if (selectedExam) {
    const writtenQs = examDetail?.questions.filter(q => q.questionType !== "mcq") ?? [];
    const mcqQs = examDetail?.questions.filter(q => q.questionType === "mcq") ?? [];

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={() => setSelectedExam(null)} className="hover:text-foreground transition-colors">Exams</button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{selectedExam.name}</span>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">{selectedExam.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
              {selectedExam.examDate && <span>Date: {new Date(selectedExam.examDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
              {selectedExam.totalMarks && <span>· {selectedExam.totalMarks} marks</span>}
              {selectedExam.timeLimitMinutes && (
                <span className="flex items-center gap-1 text-amber-600">
                  <Clock className="h-3.5 w-3.5" />{selectedExam.timeLimitMinutes}min limit
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" className="gap-2" onClick={handleLoadResults}><Eye className="h-4 w-4" />View Results</Button>
            <Button variant="outline" className="gap-2" onClick={() => window.location.href = `/exams/${selectedExam.id}/monitor`}>
              <Monitor className="h-4 w-4" />Live Monitor
            </Button>
            {!isAssistant && (
              <Dialog open={isAddQOpen} onOpenChange={v => { setIsAddQOpen(v); if (!v) setQForm(emptyQForm); }}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="h-4 w-4" />Add Question</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Add Question</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddQuestion} className="space-y-4 pt-2">
                    {/* Question Type Toggle */}
                    <div className="space-y-1.5">
                      <Label>Question Type</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "written", label: "Structured / Written", icon: AlignLeft },
                          { id: "mcq", label: "Multiple Choice (MCQ)", icon: FileQuestion },
                        ].map(({ id, label, icon: Icon }) => (
                          <button key={id} type="button"
                            onClick={() => setQForm(f => ({ ...f, questionType: id }))}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                              qForm.questionType === id
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/50"
                            }`}>
                            <Icon className="h-4 w-4 flex-shrink-0" />{label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Question Text</Label>
                      {qForm.questionType === "mcq" ? (
                        <Input
                          placeholder="e.g. Which of the following is Newton's First Law?"
                          value={qForm.questionText}
                          onChange={e => setQForm(f => ({ ...f, questionText: e.target.value }))}
                          required
                        />
                      ) : (
                        <Textarea
                          placeholder="e.g. Describe Newton's First Law and give an example..."
                          value={qForm.questionText}
                          onChange={e => setQForm(f => ({ ...f, questionText: e.target.value }))}
                          rows={2}
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Topic</Label>
                        <Input placeholder="e.g. Mechanics" value={qForm.topic} onChange={e => setQForm(f => ({ ...f, topic: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Max Marks</Label>
                        <Input type="number" min="0" step="0.5" placeholder="1" value={qForm.maxMarks}
                          onChange={e => setQForm(f => ({ ...f, maxMarks: e.target.value }))} required />
                      </div>
                    </div>

                    {qForm.questionType === "mcq" && (
                      <div className="space-y-2">
                        <Label>Options <span className="text-muted-foreground font-normal text-xs">(click the letter to mark as correct)</span></Label>
                        {qForm.options.map((opt, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <button type="button"
                              onClick={() => setQForm(f => ({ ...f, correctOption: i }))}
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border-2 transition-all ${
                                qForm.correctOption === i
                                  ? "bg-emerald-500 border-emerald-500 text-white"
                                  : "border-border text-muted-foreground hover:border-emerald-400"
                              }`}>{OPTION_LABELS[i]}</button>
                            <Input
                              placeholder={`Option ${OPTION_LABELS[i]}`}
                              value={opt}
                              onChange={e => setQForm(f => {
                                const opts = [...f.options];
                                opts[i] = e.target.value;
                                return { ...f, options: opts };
                              })}
                            />
                          </div>
                        ))}
                        <p className="text-xs text-muted-foreground">Green letter = correct answer</p>
                      </div>
                    )}

                    <Button type="submit" className="w-full" disabled={savingQ}>
                      {savingQ ? "Adding..." : `Add ${qForm.questionType === "mcq" ? "MCQ" : "Structured"} Question`}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {showResults && results ? (
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b border-border/50 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Exam Results</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowResults(false)}>Back to Mark Entry</Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4 grid grid-cols-3 gap-3 border-b border-border/50">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{results.results.length}</p>
                  <p className="text-xs text-muted-foreground">Students</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{results.totalMax}</p>
                  <p className="text-xs text-muted-foreground">Total Marks</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">
                    {results.results.length > 0 ? Math.round(results.results.reduce((s: number, r: any) => s + r.percentage, 0) / results.results.length) : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Class Average</p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>%</TableHead>
                    <TableHead>Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.results.map((r: any, i: number) => (
                    <TableRow key={r.studentId}>
                      <TableCell className="text-muted-foreground font-mono">{i + 1}</TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{r.studentName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{r.studentCode}</p>
                      </TableCell>
                      <TableCell className="font-semibold">{r.totalScored} / {r.totalMax}</TableCell>
                      <TableCell>
                        <span className={`font-semibold ${r.percentage >= 70 ? "text-emerald-600" : r.percentage >= 50 ? "text-amber-600" : "text-red-600"}`}>
                          {r.percentage}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${r.percentage >= 80 ? "bg-emerald-100 text-emerald-700" : r.percentage >= 60 ? "bg-blue-100 text-blue-700" : r.percentage >= 40 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                          {r.percentage >= 90 ? "A*" : r.percentage >= 80 ? "A" : r.percentage >= 70 ? "B" : r.percentage >= 60 ? "C" : r.percentage >= 50 ? "D" : r.percentage >= 40 ? "E" : "U"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Questions */}
            <div className="space-y-3">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Questions</h2>
              {detailLoading ? <div className="text-muted-foreground text-sm">Loading...</div> :
                examDetail?.questions.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="p-6 text-center text-muted-foreground text-sm">
                      No questions yet. Add questions to start entering marks.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {/* MCQ badge summary */}
                    {mcqQs.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                        <FileQuestion className="h-3.5 w-3.5 text-violet-500" />
                        <span>{mcqQs.length} MCQ · {writtenQs.length} Written</span>
                      </div>
                    )}
                    {examDetail?.questions.map((q, i) => (
                      <Card key={q.id} className="border-border/50">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-xs font-mono text-muted-foreground">Q{i + 1}</span>
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${q.questionType === "mcq" ? "border-violet-300 text-violet-600 bg-violet-50" : "border-blue-300 text-blue-600 bg-blue-50"}`}>
                                  {q.questionType === "mcq" ? "MCQ" : "Written"}
                                </Badge>
                              </div>
                              {q.questionText && <p className="text-sm font-medium leading-snug line-clamp-2">{q.questionText}</p>}
                              {q.topic && <p className="text-xs text-primary mt-0.5">{q.topic}</p>}
                              {q.questionType === "mcq" && q.options && (
                                <div className="mt-1.5 space-y-0.5">
                                  {q.options.map((opt, oi) => (
                                    <p key={oi} className={`text-xs flex items-center gap-1 ${oi === q.correctOption ? "text-emerald-600 font-semibold" : "text-muted-foreground"}`}>
                                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] flex-shrink-0 ${oi === q.correctOption ? "bg-emerald-100" : "bg-muted"}`}>
                                        {OPTION_LABELS[oi]}
                                      </span>
                                      {opt} {oi === q.correctOption && "✓"}
                                    </p>
                                  ))}
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">{q.maxMarks} marks</p>
                            </div>
                            {!isAssistant && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteQuestion(q.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    <div className="text-xs text-muted-foreground text-right pr-1">
                      Total: {examDetail?.questions.reduce((s, q) => s + parseFloat(q.maxMarks), 0)} marks
                    </div>
                  </div>
                )
              }
            </div>

            {/* Mark Entry */}
            <div className="xl:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Mark Entry</h2>
                <Button size="sm" className="gap-2" onClick={handleSaveMarks} disabled={savingMarks || !examDetail?.questions.length}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {savingMarks ? "Saving..." : "Save All Marks"}
                </Button>
              </div>
              {!examDetail?.questions.length ? (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center text-muted-foreground text-sm">
                    Add questions first before entering marks.
                  </CardContent>
                </Card>
              ) : !examDetail?.students.length ? (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center text-muted-foreground text-sm">
                    No students found. Add students to enter their marks.
                  </CardContent>
                </Card>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground sticky left-0 bg-muted/50 min-w-[140px]">Student</th>
                        {examDetail.questions.map((q, i) => (
                          <th key={q.id} className="px-2 py-2.5 text-center font-medium text-muted-foreground min-w-[90px]">
                            Q{i + 1}
                            {q.questionType === "mcq" && <span className="ml-1 text-[9px] text-violet-500 font-normal">MCQ</span>}
                            <br /><span className="text-[10px] font-normal">/{q.maxMarks}</span>
                          </th>
                        ))}
                        <th className="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[160px]">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {examDetail.students.map(student => (
                        <tr key={student.id} className="hover:bg-muted/20">
                          <td className="px-3 py-2 sticky left-0 bg-card border-r border-border/50">
                            <p className="font-medium text-xs">{student.studentName}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{student.studentCode}</p>
                          </td>
                          {examDetail.questions.map(q => {
                            const key = `${student.id}_${q.id}`;
                            const val = markData[key]?.marksScored ?? "";
                            const max = parseFloat(q.maxMarks);
                            const score = val !== "" ? parseFloat(val) : null;
                            return (
                              <td key={q.id} className="px-2 py-2">
                                <Input
                                  type="number" min="0" max={max} step="0.5"
                                  className={`h-8 w-20 text-center text-sm ${score !== null && score > max ? "border-red-400" : ""}`}
                                  value={val}
                                  onChange={e => setMarkData(prev => ({
                                    ...prev,
                                    [key]: { ...prev[key] ?? { marksScored: "", mistakes: "" }, marksScored: e.target.value },
                                  }))}
                                  placeholder="—"
                                />
                              </td>
                            );
                          })}
                          <td className="px-2 py-2">
                            <Input
                              className="h-8 text-xs"
                              placeholder="e.g. forgot formula..."
                              value={markData[`${student.id}_notes`]?.mistakes ?? ""}
                              onChange={e => setMarkData(prev => ({
                                ...prev,
                                [`${student.id}_notes`]: { marksScored: "", mistakes: e.target.value },
                              }))}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── EXAMS LIST ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-indigo-600" />
            Exams & Marks
          </h1>
          <p className="text-muted-foreground mt-1">Create exams, add MCQ or written questions, and record student marks.</p>
        </div>
        {!isAssistant && (
          <Dialog open={isAddOpen} onOpenChange={v => { setIsAddOpen(v); if (!v) setExamForm({ name: "", subjectId: "", examDate: "", totalMarks: "", timeLimitMinutes: "" }); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Create Exam</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Exam</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateExam} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Exam Name</Label>
                  <Input placeholder="e.g. Term 1 Physics Exam" value={examForm.name} onChange={e => setExamForm({ ...examForm, name: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Subject (optional)</Label>
                    <Select value={examForm.subjectId} onValueChange={v => setExamForm({ ...examForm, subjectId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {subjects.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Exam Date</Label>
                    <Input type="date" value={examForm.examDate} onChange={e => setExamForm({ ...examForm, examDate: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Total Marks (optional)</Label>
                    <Input type="number" placeholder="e.g. 100" value={examForm.totalMarks} onChange={e => setExamForm({ ...examForm, totalMarks: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Online Time Limit (min)</Label>
                    <Input type="number" min="5" max="300" step="5" placeholder="e.g. 60" value={examForm.timeLimitMinutes}
                      onChange={e => setExamForm({ ...examForm, timeLimitMinutes: e.target.value })} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={savingExam}>{savingExam ? "Creating..." : "Create Exam"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-muted/40 rounded-xl animate-pulse" />)}
        </div>
      ) : exams.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-4">
            <AppEmptyState
              type="assessments"
              title="No exams yet"
              description={isAssistant ? "No exams have been created yet. Contact your teacher to schedule one." : "Create your first exam to start scheduling, entering marks, and generating grade reports."}
              size="lg"
              actions={isAssistant ? [] : [{ label: "Create First Exam", primary: true, icon: Plus, onClick: undefined }]}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {exams.map(exam => {
            const subject = subjects.find(s => s.id === exam.subjectId);
            return (
              <Card key={exam.id} className="border-border/50 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => setSelectedExam(exam)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate group-hover:text-primary transition-colors">{exam.name}</p>
                      {subject && <p className="text-xs text-primary mt-0.5">{subject.name}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        {exam.examDate && <span>{new Date(exam.examDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
                        {exam.totalMarks && <span>{exam.totalMarks} marks</span>}
                        {exam.timeLimitMinutes && (
                          <span className="flex items-center gap-0.5 text-amber-600">
                            <Clock className="h-3 w-3" />{exam.timeLimitMinutes}min
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!isAssistant && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={e => { e.stopPropagation(); handleDeleteExam(exam.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                    <PenLine className="h-3.5 w-3.5" />
                    <span>Click to open</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
