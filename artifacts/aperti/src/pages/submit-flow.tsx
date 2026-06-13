import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, BookOpen, Eye, CheckCircle, Clock, FileText, Users,
  Pencil, Trash2, Calendar, AlignLeft, Upload, CheckSquare, Lightbulb,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = "/api";
async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const SUBMISSION_TYPES = [
  { value: "file", label: "File Upload", icon: <Upload className="h-4 w-4" /> },
  { value: "text", label: "Text Entry", icon: <AlignLeft className="h-4 w-4" /> },
  { value: "both", label: "File + Text", icon: <FileText className="h-4 w-4" /> },
  { value: "none", label: "No submission (informational)", icon: <CheckSquare className="h-4 w-4" /> },
];

const EMPTY_FORM = {
  title: "", description: "", instructions: "",
  subject_id: "", lesson_id: "", rubric_id: "",
  due_date: "", total_marks: "10",
  submission_type: "file", allow_late: true,
  is_published: false, estimated_mins: "30",
};

export default function SubmitFlow() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("assignments");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { data: hwData, isLoading } = useQuery({
    queryKey: ["homework-teacher"],
    queryFn: () => apiFetch("/homework/teacher"),
  });

  const { data: subjects } = useQuery<any[]>({
    queryKey: ["subjects"],
    queryFn: () => apiFetch("/subjects"),
  });

  const { data: lessons } = useQuery<any[]>({
    queryKey: ["lessons"],
    queryFn: () => apiFetch("/lessons"),
  });

  const { data: rubrics } = useQuery<any[]>({
    queryKey: ["rubrics"],
    queryFn: () => apiFetch("/rubrics"),
  });

  const hwList: any[] = Array.isArray(hwData) ? hwData : (hwData as any)?.homework ?? [];
  const subjectList: any[] = Array.isArray(subjects) ? subjects : [];
  const lessonList: any[] = Array.isArray(lessons) ? lessons : [];
  const rubricList: any[] = Array.isArray(rubrics) ? rubrics : [];

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editing
        ? apiFetch(`/homework/${editing.id}`, { method: "PUT", body: JSON.stringify(data) })
        : apiFetch("/homework", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homework-teacher"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "assignment-queue"] });
      setDialogOpen(false);
      toast({ title: editing ? "Assignment updated" : "Assignment created", description: form.title });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/homework/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["homework-teacher"] }),
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  }

  function openEdit(hw: any) {
    setEditing(hw);
    setForm({
      title: hw.title ?? "", description: hw.description ?? "", instructions: hw.instructions ?? "",
      subject_id: hw.subjectId ? String(hw.subjectId) : "",
      lesson_id: hw.lessonId ? String(hw.lessonId) : "",
      rubric_id: hw.rubric_id ? String(hw.rubric_id) : "",
      due_date: hw.dueDate ? hw.dueDate.slice(0, 10) : "",
      total_marks: String(hw.totalMarks ?? 10),
      submission_type: hw.submission_type ?? "file",
      allow_late: hw.allowLate ?? true,
      is_published: hw.isPublished ?? false,
      estimated_mins: String(hw.estimated_mins ?? 30),
    });
    setDialogOpen(true);
  }

  function handleSave() {
    saveMutation.mutate({
      title: form.title,
      description: form.description,
      instructions: form.instructions,
      subjectId: form.subject_id ? parseInt(form.subject_id) : null,
      lessonId: form.lesson_id ? parseInt(form.lesson_id) : null,
      rubric_id: form.rubric_id ? parseInt(form.rubric_id) : null,
      dueDate: form.due_date || null,
      totalMarks: parseFloat(form.total_marks),
      submission_type: form.submission_type,
      allowLate: form.allow_late,
      isPublished: form.is_published,
      estimated_mins: parseInt(form.estimated_mins),
    });
  }

  const published = hwList.filter(h => h.isPublished);
  const drafts = hwList.filter(h => !h.isPublished);

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">SubmitFlow™</h1>
          <p className="text-muted-foreground text-sm">Create, publish and manage assignments for your students.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> New Assignment
        </Button>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Assignments", value: hwList.length, icon: <BookOpen className="h-4 w-4 text-primary" /> },
          { label: "Published", value: published.length, icon: <CheckCircle className="h-4 w-4 text-emerald-500" /> },
          { label: "Drafts", value: drafts.length, icon: <Clock className="h-4 w-4 text-amber-500" /> },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">{s.icon}</div>
              <div>
                <p className="text-xl font-bold tabular-nums">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="assignments">All Assignments</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
          <TabsTrigger value="drafts">Drafts</TabsTrigger>
        </TabsList>

        {(["assignments", "published", "drafts"] as const).map(tabKey => {
          const list = tabKey === "published" ? published : tabKey === "drafts" ? drafts : hwList;
          return (
            <TabsContent key={tabKey} value={tabKey}>
              {isLoading ? (
                <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
              ) : list.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center text-muted-foreground">
                    <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No assignments yet</p>
                    <Button onClick={openCreate} className="mt-3 gap-2 text-sm"><Plus className="h-4 w-4" /> Create one</Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Marks</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-24">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {list.map((hw: any) => (
                          <TableRow key={hw.id}>
                            <TableCell className="font-medium">{hw.title}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{hw.subjectName ?? "—"}</TableCell>
                            <TableCell className="text-sm">
                              {hw.dueDate ? new Date(hw.dueDate).toLocaleDateString() : <span className="text-muted-foreground">No due date</span>}
                            </TableCell>
                            <TableCell>{hw.totalMarks ?? "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs capitalize">{hw.submission_type ?? "file"}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={hw.isPublished ? "default" : "secondary"} className="text-xs">
                                {hw.isPublished ? "Published" : "Draft"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(hw)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(hw.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Assignment" : "New Assignment"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input placeholder="e.g. Chapter 3 Review Questions" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Select value={form.subject_id} onValueChange={v => setForm(f => ({ ...f, subject_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {subjectList.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Link to Lesson (optional)</Label>
                <Select value={form.lesson_id} onValueChange={v => setForm(f => ({ ...f, lesson_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="No link" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {lessonList.map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.title ?? `Lesson ${l.lesson_number}`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Rubric (optional)</Label>
                <Select value={form.rubric_id} onValueChange={v => setForm(f => ({ ...f, rubric_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="No rubric" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {rubricList.map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Submission Type</Label>
                <Select value={form.submission_type} onValueChange={v => setForm(f => ({ ...f, submission_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUBMISSION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Total Marks</Label>
                <Input type="number" min={1} value={form.total_marks} onChange={e => setForm(f => ({ ...f, total_marks: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Est. Time (minutes)</Label>
                <Input type="number" min={5} value={form.estimated_mins} onChange={e => setForm(f => ({ ...f, estimated_mins: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description / Context</Label>
              <Textarea rows={2} placeholder="Topic context, learning objectives…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Student Instructions</Label>
              <Textarea rows={3} placeholder="Clear step-by-step instructions for students…" value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.allow_late} onCheckedChange={v => setForm(f => ({ ...f, allow_late: v }))} />
                <Label className="text-sm">Allow late submissions</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_published} onCheckedChange={v => setForm(f => ({ ...f, is_published: v }))} />
                <Label className="text-sm">Publish immediately</Label>
              </div>
            </div>
          </div>
          {/* ── Content quality hints ── */}
          {form.title && (() => {
            const hints: string[] = [];
            if (!form.rubric_id) hints.push("Attach a rubric so students know how they'll be graded.");
            if (!form.instructions.trim()) hints.push("Add clear step-by-step instructions to reduce confusion.");
            if (!form.due_date) hints.push("Set a due date so students can plan their workload.");
            if (parseInt(form.estimated_mins) < 10) hints.push("Estimated time seems low — double-check so students can plan.");
            if (hints.length === 0) return null;
            return (
              <div className="flex flex-col gap-1.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <p className="text-xs font-bold text-amber-700">Quality tips</p>
                </div>
                {hints.map((h, i) => (
                  <p key={i} className="text-xs text-amber-700 leading-snug pl-5">· {h}</p>
                ))}
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.title || saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : editing ? "Update" : "Create Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
