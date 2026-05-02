import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Pencil, Trash2, Users, CheckCircle2, Clock, Award, Eye, Star } from "lucide-react";

type Subject = { id: number; name: string };
type HW = {
  id: number; title: string; description: string | null; dueDate: string | null;
  totalMarks: string | null; classFilter: string | null; allowLate: boolean; isPublished: boolean;
  subjectId: number | null; subjectName: string | null; submissionCount: number; gradedCount: number; createdAt: string;
};
type Submission = {
  id: number; studentId: number; studentName: string; studentCode: string;
  content: string | null; status: string; marksAwarded: string | null; teacherFeedback: string | null;
  submittedAt: string | null; gradedAt: string | null;
};

function HomeworkFormDialog({ mode, initial, subjects, onSave, trigger }: { mode: "create" | "edit"; initial?: Partial<HW>; subjects: Subject[]; onSave: (d: any) => Promise<void>; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: initial?.title ?? "", description: initial?.description ?? "", instructions: "", dueDate: initial?.dueDate ?? "", totalMarks: initial?.totalMarks ?? "", subjectId: initial?.subjectId?.toString() ?? "", classFilter: initial?.classFilter ?? "", allowLate: initial?.allowLate ?? false });
  const [saving, setSaving] = useState(false);
  const handleOpen = (v: boolean) => { setOpen(v); if (v && initial) setForm({ title: initial.title ?? "", description: initial.description ?? "", instructions: "", dueDate: initial.dueDate ?? "", totalMarks: initial.totalMarks ?? "", subjectId: initial.subjectId?.toString() ?? "", classFilter: initial.classFilter ?? "", allowLate: initial.allowLate ?? false }); };
  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); setSaving(true); try { await onSave({ ...form, subjectId: form.subjectId || null, totalMarks: form.totalMarks || null }); setOpen(false); } finally { setSaving(false); } };
  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{mode === "create" ? "Create Homework" : "Edit Homework"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5"><Label>Title <span className="text-red-500">*</span></Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Instructions for Students</Label><Textarea rows={2} value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Subject</Label>
              <Select value={form.subjectId || "none"} onValueChange={v => setForm({ ...form, subjectId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent><SelectItem value="none">No subject</SelectItem>{subjects.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Total Marks</Label><Input type="number" min="0" step="0.5" value={form.totalMarks} onChange={e => setForm({ ...form, totalMarks: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Assign To</Label>
              <Select value={form.classFilter || "all"} onValueChange={v => setForm({ ...form, classFilter: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All students</SelectItem><SelectItem value="lesson1">Lesson 1</SelectItem><SelectItem value="lesson2">Lesson 2</SelectItem><SelectItem value="lesson3">Lesson 3</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.allowLate} onChange={e => setForm({ ...form, allowLate: e.target.checked })} className="rounded" /><span className="text-sm">Allow late submissions</span></label>
          <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving..." : mode === "create" ? "Create Homework" : "Save Changes"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GradeDialog({ hw, trigger }: { hw: HW; trigger: React.ReactNode }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [grading, setGrading] = useState<Record<number, { marks: string; feedback: string }>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const load = async () => { setLoading(true); const r = await fetch(`/api/homework/${hw.id}/submissions`, { credentials: "include" }); if (r.ok) setSubs(await r.json()); setLoading(false); };
  const handleOpen = (v: boolean) => { setOpen(v); if (v) load(); };
  const handleGrade = async (sub: Submission) => {
    const g = grading[sub.id]; if (!g) return;
    setSaving(sub.id);
    const r = await fetch(`/api/homework/submissions/${sub.id}/grade`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marksAwarded: g.marks || null, teacherFeedback: g.feedback }) });
    if (r.ok) { toast({ title: "Graded!" }); load(); }
    setSaving(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Submissions — {hw.title}</DialogTitle></DialogHeader>
        {loading ? <div className="py-8 text-center text-muted-foreground">Loading...</div> :
          subs.length === 0 ? <div className="py-12 text-center text-muted-foreground"><Users className="h-10 w-10 mx-auto mb-3 opacity-20" /><p>No submissions yet</p></div> :
          <div className="space-y-3 pt-2">
            {subs.map(sub => (
              <div key={sub.id} className="border border-border/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div><p className="font-semibold text-sm">{sub.studentName}</p><p className="text-xs text-muted-foreground font-mono">{sub.studentCode}</p></div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${sub.status === "graded" ? "bg-emerald-100 text-emerald-700" : sub.status === "submitted" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{sub.status}</span>
                </div>
                {sub.content && <div className="bg-muted/30 rounded-lg p-3 text-sm text-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">{sub.content}</div>}
                {sub.status !== "graded" && sub.status !== null ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      {hw.totalMarks && <Input type="number" placeholder={`/ ${hw.totalMarks}`} className="w-28 h-8 text-sm" value={grading[sub.id]?.marks ?? ""} onChange={e => setGrading(g => ({ ...g, [sub.id]: { ...g[sub.id], marks: e.target.value } }))} />}
                      <Input placeholder="Feedback for student..." className="h-8 text-sm flex-1" value={grading[sub.id]?.feedback ?? ""} onChange={e => setGrading(g => ({ ...g, [sub.id]: { ...g[sub.id], feedback: e.target.value } }))} />
                      <Button size="sm" className="h-8 gap-1.5 text-xs" disabled={saving === sub.id} onClick={() => handleGrade(sub)}><Star className="h-3 w-3" />{saving === sub.id ? "..." : "Grade"}</Button>
                    </div>
                  </div>
                ) : sub.status === "graded" && (
                  <div className="text-xs text-muted-foreground"><span className="font-medium">Marks: {sub.marksAwarded ?? "—"}</span>{sub.teacherFeedback && <span className="ml-3 italic">"{sub.teacherFeedback}"</span>}</div>
                )}
              </div>
            ))}
          </div>
        }
      </DialogContent>
    </Dialog>
  );
}

export default function HomeworkPage() {
  const { toast } = useToast();
  const [homework, setHomework] = useState<HW[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => { setLoading(true); const [h, s] = await Promise.all([fetch("/api/homework", { credentials: "include" }), fetch("/api/subjects", { credentials: "include" })]); if (h.ok) setHomework(await h.json()); if (s.ok) setSubjects(await s.json()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const handleCreate = async (data: any) => { const r = await fetch("/api/homework", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!r.ok) throw new Error("Failed"); toast({ title: "Homework created" }); load(); };
  const handleEdit = async (id: number, data: any) => { await fetch(`/api/homework/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); toast({ title: "Updated" }); load(); };
  const handleDelete = async (id: number) => { if (!confirm("Delete this homework?")) return; await fetch(`/api/homework/${id}`, { method: "DELETE", credentials: "include" }); toast({ title: "Deleted" }); load(); };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><BookOpen className="h-7 w-7 text-blue-600" />Homework</h1><p className="text-muted-foreground mt-1">Create and manage homework assignments for your students.</p></div>
        <HomeworkFormDialog mode="create" subjects={subjects} onSave={handleCreate} trigger={<Button className="gap-2"><Plus className="h-4 w-4" />New Homework</Button>} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total", value: homework.length, color: "text-foreground" },
          { label: "With Submissions", value: homework.filter(h => h.submissionCount > 0).length, color: "text-blue-600" },
          { label: "Fully Graded", value: homework.filter(h => h.gradedCount > 0 && h.gradedCount === h.submissionCount && h.submissionCount > 0).length, color: "text-emerald-600" },
        ].map(s => <Card key={s.label} className="border-border/50"><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p></CardContent></Card>)}
      </div>

      {loading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> :
        homework.length === 0 ? (
          <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-3"><BookOpen className="h-10 w-10 opacity-20" /><p>No homework yet.</p></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {homework.map(hw => {
              const isOverdue = hw.dueDate && hw.dueDate < today;
              return (
                <Card key={hw.id} className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm">{hw.title}</h3>
                          {hw.subjectName && <span className="text-xs text-primary font-medium">{hw.subjectName}</span>}
                          {!hw.isPublished && <Badge variant="outline" className="text-[10px] h-4">Draft</Badge>}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          {hw.dueDate && <span className={`flex items-center gap-1 ${isOverdue ? "text-red-500" : ""}`}><Clock className="h-3 w-3" />{isOverdue ? "Was due " : "Due "}{new Date(hw.dueDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
                          {hw.totalMarks && <span><Award className="h-3 w-3 inline mr-0.5" />{hw.totalMarks} marks</span>}
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{hw.submissionCount} submitted · {hw.gradedCount} graded</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <GradeDialog hw={hw} trigger={<Button variant="outline" size="sm" className="gap-1.5 text-xs h-8"><Eye className="h-3 w-3" />Submissions</Button>} />
                        <HomeworkFormDialog mode="edit" initial={hw} subjects={subjects} onSave={(d) => handleEdit(hw.id, d)} trigger={<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"><Pencil className="h-3.5 w-3.5" /></Button>} />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(hw.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
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
