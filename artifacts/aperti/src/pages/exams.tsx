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
import { ClipboardList, Plus, Trash2, Pencil, Eye, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";

type Subject = { id: number; name: string };
type Exam = { id: number; name: string; subjectId: number | null; examDate: string | null; totalMarks: string | null; createdAt: string };
type Question = { id: number; examId: number; questionText: string | null; topic: string | null; maxMarks: string; questionOrder: number };
type Student = { id: number; studentCode: string; studentName: string };
type Mark = { studentId: number; questionId: number; marksScored: string | null; mistakes: string | null };

export default function Exams() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAssistant = user?.role === "assistant";

  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [savingExam, setSavingExam] = useState(false);
  const [examForm, setExamForm] = useState({ name: "", subjectId: "", examDate: "", totalMarks: "" });

  // Drill-down state
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [examDetail, setExamDetail] = useState<{ exam: Exam; questions: Question[]; students: Student[]; marks: Mark[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Question form
  const [isAddQOpen, setIsAddQOpen] = useState(false);
  const [qForm, setQForm] = useState({ questionText: "", topic: "", maxMarks: "" });
  const [savingQ, setSavingQ] = useState(false);

  // Mark entry
  const [markData, setMarkData] = useState<Record<string, { marksScored: string; mistakes: string }>>({});
  const [savingMarks, setSavingMarks] = useState(false);

  // Results view
  const [results, setResults] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [examsRes, subjectsRes] = await Promise.all([
        fetch("/api/exams", { credentials: "include" }),
        fetch("/api/subjects", { credentials: "include" }),
      ]);
      if (examsRes.ok) setExams(await examsRes.json());
      if (subjectsRes.ok) setSubjects(await subjectsRes.json());
    } finally { setLoading(false); }
  };

  const loadDetail = async (examId: number) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/exams/${examId}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setExamDetail(data);
        // Build initial mark data from existing marks
        const md: Record<string, { marksScored: string; mistakes: string }> = {};
        for (const m of data.marks) {
          md[`${m.studentId}_${m.questionId}`] = {
            marksScored: m.marksScored ?? "",
            mistakes: m.mistakes ?? "",
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
      const res = await fetch("/api/exams", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...examForm, subjectId: examForm.subjectId || null, totalMarks: examForm.totalMarks || null }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message); }
      toast({ title: "Exam created" });
      setIsAddOpen(false);
      setExamForm({ name: "", subjectId: "", examDate: "", totalMarks: "" });
      load();
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSavingExam(false); }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExam) return;
    setSavingQ(true);
    try {
      const res = await fetch(`/api/exams/${selectedExam.id}/questions`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...qForm, maxMarks: parseFloat(qForm.maxMarks), questionOrder: (examDetail?.questions.length ?? 0) + 1 }),
      });
      if (!res.ok) throw new Error("Failed to add question");
      toast({ title: "Question added" });
      setIsAddQOpen(false);
      setQForm({ questionText: "", topic: "", maxMarks: "" });
      loadDetail(selectedExam.id);
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setSavingQ(false); }
  };

  const handleDeleteQuestion = async (qId: number) => {
    if (!confirm("Delete this question? All marks for it will be lost.")) return;
    await fetch(`/api/exam-questions/${qId}`, { method: "DELETE", credentials: "include" });
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
            marks.push({ studentId: student.id, questionId: q.id, marksScored: entry.marksScored !== "" ? parseFloat(entry.marksScored) : null, mistakes: entry.mistakes || null });
          }
        }
      }
      const res = await fetch(`/api/exams/${selectedExam.id}/marks`, {
        method: "POST", credentials: "include",
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
    const res = await fetch(`/api/exams/${selectedExam.id}/results`, { credentials: "include" });
    if (res.ok) { setResults(await res.json()); setShowResults(true); }
  };

  const handleDeleteExam = async (id: number) => {
    if (!confirm("Delete this exam and all its data?")) return;
    await fetch(`/api/exams/${id}`, { method: "DELETE", credentials: "include" });
    toast({ title: "Exam deleted" });
    if (selectedExam?.id === id) setSelectedExam(null);
    load();
  };

  if (selectedExam) {
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
            <p className="text-muted-foreground text-sm mt-0.5">
              {selectedExam.examDate && `Date: ${selectedExam.examDate} · `}
              {selectedExam.totalMarks && `Total: ${selectedExam.totalMarks} marks`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={handleLoadResults}><Eye className="h-4 w-4" />View Results</Button>
            {!isAssistant && (
              <Dialog open={isAddQOpen} onOpenChange={setIsAddQOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="h-4 w-4" />Add Question</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Question</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddQuestion} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <Label>Question / Description</Label>
                      <Input placeholder="e.g. Q1: Describe Newton's First Law..." value={qForm.questionText} onChange={e => setQForm({ ...qForm, questionText: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Topic</Label>
                        <Input placeholder="e.g. Mechanics, Waves..." value={qForm.topic} onChange={e => setQForm({ ...qForm, topic: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Max Marks</Label>
                        <Input type="number" min="0" step="0.5" placeholder="10" value={qForm.maxMarks} onChange={e => setQForm({ ...qForm, maxMarks: e.target.value })} required />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={savingQ}>{savingQ ? "Adding..." : "Add Question"}</Button>
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
                    {examDetail?.questions.map((q, i) => (
                      <Card key={q.id} className="border-border/50">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">Q{i + 1}{q.questionText ? `: ${q.questionText}` : ""}</p>
                              {q.topic && <p className="text-xs text-primary mt-0.5">{q.topic}</p>}
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
                            Q{i + 1}<br /><span className="text-[10px] font-normal">/{q.maxMarks}</span>
                          </th>
                        ))}
                        <th className="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[160px]">Mistakes/Notes</th>
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
                                  type="number"
                                  min="0"
                                  max={max}
                                  step="0.5"
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-indigo-600" />
            Exams & Marks
          </h1>
          <p className="text-muted-foreground mt-1">Create exams, add questions, and record student marks.</p>
        </div>
        {!isAssistant && (
          <Dialog open={isAddOpen} onOpenChange={v => { setIsAddOpen(v); if (!v) setExamForm({ name: "", subjectId: "", examDate: "", totalMarks: "" }); }}>
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
                <div className="space-y-1.5">
                  <Label>Total Marks (optional — auto-calculated from questions)</Label>
                  <Input type="number" placeholder="e.g. 100" value={examForm.totalMarks} onChange={e => setExamForm({ ...examForm, totalMarks: e.target.value })} />
                </div>
                <Button type="submit" className="w-full" disabled={savingExam}>{savingExam ? "Creating..." : "Create Exam"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading exams...</div>
      ) : exams.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
            <ClipboardList className="h-12 w-12 opacity-20" />
            <p>No exams yet.</p>
            {!isAssistant && <p className="text-sm">Create your first exam to start tracking student marks.</p>}
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
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {exam.examDate && <span>{new Date(exam.examDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
                        {exam.totalMarks && <span>{exam.totalMarks} marks</span>}
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
                    <ChevronRight className="h-3.5 w-3.5" />
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
