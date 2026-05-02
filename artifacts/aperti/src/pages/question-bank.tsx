import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookMarked, Plus, Pencil, Trash2, Search, Filter, Tag, BarChart2, Lightbulb } from "lucide-react";
import { useAuth } from "@/context/auth";

type Subject = { id: number; name: string };
type Question = {
  id: number; questionText: string; topic: string | null; subtopic: string | null;
  difficulty: string; maxMarks: string; modelAnswer: string | null; commonMistakes: string | null;
  tags: string | null; subjectId: number | null; subjectName: string | null;
  timesUsed: number; createdAt: string;
};

const DIFFICULTY_BADGE: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-red-100 text-red-700",
};

function QuestionFormDialog({
  mode, initial, subjects, onSave, trigger,
}: {
  mode: "create" | "edit"; initial?: Partial<Question>; subjects: Subject[];
  onSave: (data: any) => Promise<void>; trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    questionText: initial?.questionText ?? "",
    topic: initial?.topic ?? "",
    subtopic: initial?.subtopic ?? "",
    difficulty: initial?.difficulty ?? "medium",
    maxMarks: initial?.maxMarks ?? "1",
    modelAnswer: initial?.modelAnswer ?? "",
    commonMistakes: initial?.commonMistakes ?? "",
    tags: initial?.tags ?? "",
    subjectId: initial?.subjectId?.toString() ?? "",
  });
  const [saving, setSaving] = useState(false);

  const handleOpen = (v: boolean) => { setOpen(v); if (v && initial) setForm({ questionText: initial.questionText ?? "", topic: initial.topic ?? "", subtopic: initial.subtopic ?? "", difficulty: initial.difficulty ?? "medium", maxMarks: initial.maxMarks ?? "1", modelAnswer: initial.modelAnswer ?? "", commonMistakes: initial.commonMistakes ?? "", tags: initial.tags ?? "", subjectId: initial.subjectId?.toString() ?? "" }); };
  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); setSaving(true); try { await onSave({ ...form, subjectId: form.subjectId || null, maxMarks: parseFloat(form.maxMarks) }); setOpen(false); } finally { setSaving(false); } };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{mode === "create" ? "Add Question to Bank" : "Edit Question"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Question Text <span className="text-red-500">*</span></Label>
            <Textarea rows={3} placeholder="Enter the question..." value={form.questionText} onChange={e => setForm({ ...form, questionText: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select value={form.subjectId || "none"} onValueChange={v => setForm({ ...form, subjectId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select subject..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No subject</SelectItem>
                  {subjects.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <Select value={form.difficulty} onValueChange={v => setForm({ ...form, difficulty: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Topic</Label>
              <Input placeholder="e.g. Mechanics" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Subtopic</Label>
              <Input placeholder="e.g. Newton's Laws" value={form.subtopic} onChange={e => setForm({ ...form, subtopic: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Max Marks</Label>
              <Input type="number" min="0.5" step="0.5" value={form.maxMarks} onChange={e => setForm({ ...form, maxMarks: e.target.value })} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tags <span className="text-xs text-muted-foreground">(comma separated)</span></Label>
            <Input placeholder="e.g. calculation, formula, IGCSE" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Model Answer</Label>
            <Textarea rows={2} placeholder="The ideal answer..." value={form.modelAnswer} onChange={e => setForm({ ...form, modelAnswer: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Common Mistakes</Label>
            <Textarea rows={2} placeholder="Students often forget..." value={form.commonMistakes} onChange={e => setForm({ ...form, commonMistakes: e.target.value })} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving..." : mode === "create" ? "Add to Question Bank" : "Save Changes"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function QuestionBank() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterSubject) params.set("subjectId", filterSubject);
      if (filterDifficulty) params.set("difficulty", filterDifficulty);
      const [qRes, sRes] = await Promise.all([
        fetch(`/api/question-bank?${params}`, { credentials: "include" }),
        fetch("/api/subjects", { credentials: "include" }),
      ]);
      if (qRes.ok) setQuestions(await qRes.json());
      if (sRes.ok) setSubjects(await sRes.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, filterSubject, filterDifficulty]);

  const handleCreate = async (data: any) => {
    const res = await fetch("/api/question-bank", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message); }
    toast({ title: "Question added to bank" });
    load();
  };

  const handleEdit = async (id: number, data: any) => {
    const res = await fetch(`/api/question-bank/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Update failed");
    toast({ title: "Question updated" });
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this question from the bank?")) return;
    await fetch(`/api/question-bank/${id}`, { method: "DELETE", credentials: "include" });
    toast({ title: "Question deleted" });
    load();
  };

  const stats = {
    total: questions.length,
    easy: questions.filter(q => q.difficulty === "easy").length,
    medium: questions.filter(q => q.difficulty === "medium").length,
    hard: questions.filter(q => q.difficulty === "hard").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookMarked className="h-7 w-7 text-violet-600" />Question Bank
          </h1>
          <p className="text-muted-foreground mt-1">Build a reusable library of questions with model answers and difficulty ratings.</p>
        </div>
        <QuestionFormDialog
          mode="create" subjects={subjects} onSave={handleCreate}
          trigger={<Button className="gap-2"><Plus className="h-4 w-4" />Add Question</Button>}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Questions", value: stats.total, color: "text-foreground" },
          { label: "Easy", value: stats.easy, color: "text-emerald-600" },
          { label: "Medium", value: stats.medium, color: "text-amber-600" },
          { label: "Hard", value: stats.hard, color: "text-red-600" },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-9 h-8 text-sm" placeholder="Search questions..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterSubject || "all"} onValueChange={v => setFilterSubject(v === "all" ? "" : v)}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All subjects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {subjects.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterDifficulty || "all"} onValueChange={v => setFilterDifficulty(v === "all" ? "" : v)}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All levels" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : questions.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
              <BookMarked className="h-12 w-12 opacity-20" />
              <p>{search || filterSubject || filterDifficulty ? "No questions match your filters." : "No questions yet. Start building your question bank."}</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {questions.map(q => (
                <div key={q.id} className="p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        {q.subjectName && <span className="text-xs font-medium text-primary">{q.subjectName}</span>}
                        {q.topic && <span className="text-xs text-muted-foreground">{q.topic}{q.subtopic ? ` › ${q.subtopic}` : ""}</span>}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize ${DIFFICULTY_BADGE[q.difficulty]}`}>{q.difficulty}</span>
                        <span className="text-xs text-muted-foreground">{q.maxMarks} mark{parseFloat(q.maxMarks) !== 1 ? "s" : ""}</span>
                        {q.timesUsed > 0 && <span className="text-[10px] text-muted-foreground">Used {q.timesUsed}×</span>}
                      </div>
                      <p className="text-sm font-medium leading-relaxed line-clamp-2">{q.questionText}</p>
                      {q.tags && (
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          <Tag className="h-3 w-3 text-muted-foreground" />
                          {q.tags.split(",").map(t => t.trim()).filter(Boolean).map(t => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
                          ))}
                        </div>
                      )}

                      {expandedId === q.id && (
                        <div className="mt-3 space-y-2">
                          {q.modelAnswer && (
                            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                              <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1 mb-1"><Lightbulb className="h-3 w-3" />Model Answer</p>
                              <p className="text-xs text-emerald-800 whitespace-pre-wrap">{q.modelAnswer}</p>
                            </div>
                          )}
                          {q.commonMistakes && (
                            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                              <p className="text-xs font-semibold text-amber-700 mb-1">Common Mistakes</p>
                              <p className="text-xs text-amber-800 whitespace-pre-wrap">{q.commonMistakes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
                        onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}>
                        {expandedId === q.id ? "Less" : "More"}
                      </button>
                      <QuestionFormDialog
                        mode="edit" initial={q} subjects={subjects}
                        onSave={(data) => handleEdit(q.id, data)}
                        trigger={<Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"><Pencil className="h-3 w-3" /></Button>}
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(q.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
