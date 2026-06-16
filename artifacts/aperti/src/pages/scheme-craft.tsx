import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Grid3X3, Eye, Copy, Pencil, CheckSquare } from "lucide-react";
import { AppEmptyState } from "@/components/app-empty-state";
import { useToast } from "@/hooks/use-toast";

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

interface Criterion { keyword: string; marks: number; description: string; }

function CriteriaEditor({ criteria, onChange }: { criteria: Criterion[]; onChange: (c: Criterion[]) => void }) {
  function update(i: number, field: keyof Criterion, val: string | number) {
    const next = criteria.map((c, idx) => idx === i ? { ...c, [field]: val } : c);
    onChange(next);
  }
  function add() { onChange([...criteria, { keyword: "", marks: 1, description: "" }]); }
  function remove(i: number) { onChange(criteria.filter((_, idx) => idx !== i)); }

  return (
    <div className="space-y-2">
      {criteria.map((c, i) => (
        <div key={i} className="grid grid-cols-[1fr_80px_auto] gap-2 items-start p-3 rounded-lg bg-muted/40 border">
          <div className="space-y-1.5">
            <Input
              placeholder="Criterion / keyword"
              className="h-8 text-sm"
              value={c.keyword}
              onChange={e => update(i, "keyword", e.target.value)}
            />
            <Input
              placeholder="Description (optional)"
              className="h-8 text-xs"
              value={c.description}
              onChange={e => update(i, "description", e.target.value)}
            />
          </div>
          <Input
            type="number"
            min={0}
            max={100}
            className="h-8 text-sm text-center"
            value={c.marks}
            onChange={e => update(i, "marks", Number(e.target.value))}
          />
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(i)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full gap-2 mt-1" onClick={add}>
        <Plus className="h-4 w-4" /> Add Criterion
      </Button>
    </div>
  );
}

const EMPTY_FORM = {
  title: "", type: "analytic", max_marks: "10", subject_id: "", homework_id: "",
  criteria: [] as Criterion[],
};

export default function SchemeCraft() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("rubrics");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [previewRubric, setPreviewRubric] = useState<any | null>(null);

  const { data: rubrics, isLoading } = useQuery<any[]>({
    queryKey: ["rubrics"],
    queryFn: () => apiFetch("/rubrics"),
  });
  const { data: subjects } = useQuery<any[]>({
    queryKey: ["subjects"],
    queryFn: () => apiFetch("/subjects"),
  });
  const { data: homeworks } = useQuery<any[]>({
    queryKey: ["homework-teacher"],
    queryFn: () => apiFetch("/homework/teacher"),
  });

  const rubricList: any[] = Array.isArray(rubrics) ? rubrics : [];
  const subjectList: any[] = Array.isArray(subjects) ? subjects : [];
  const hwList: any[] = Array.isArray(homeworks) ? homeworks : (homeworks as any)?.homework ?? [];

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  }
  function openEdit(r: any) {
    setEditing(r);
    setForm({
      title: r.title ?? "",
      type: r.type ?? "analytic",
      max_marks: String(r.max_marks ?? 10),
      subject_id: r.subject_id ? String(r.subject_id) : "",
      homework_id: r.homework_id ? String(r.homework_id) : "",
      criteria: Array.isArray(r.criteria) ? r.criteria : [],
    });
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editing
        ? apiFetch(`/rubrics/${editing.id}`, { method: "PUT", body: JSON.stringify(data) })
        : apiFetch("/rubrics", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rubrics"] });
      setDialogOpen(false);
      toast({ title: editing ? "Rubric updated" : "Rubric created", description: form.title });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/rubrics/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rubrics"] }),
  });

  function handleSave() {
    saveMutation.mutate({
      title: form.title,
      type: form.type,
      max_marks: parseFloat(form.max_marks),
      subject_id: form.subject_id ? parseInt(form.subject_id) : null,
      homework_id: form.homework_id ? parseInt(form.homework_id) : null,
      criteria: form.criteria,
    });
  }

  const totalCriteriaMarks = form.criteria.reduce((s, c) => s + (Number(c.marks) || 0), 0);

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">SchemeCraft™</h1>
          <p className="text-muted-foreground text-sm">Build criteria-based rubrics and mark schemes for assessments.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> New Rubric
        </Button>
      </motion.div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : rubricList.length === 0 ? (
        <AppEmptyState
          type="assessments"
          title="No rubrics yet"
          description="Create your first rubric to enable structured marking across assignments."
          size="lg"
          actions={[{ label: "Create Rubric", primary: true, icon: Plus, onClick: openCreate }]}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rubricList.map((r: any) => {
            const criteria: Criterion[] = Array.isArray(r.criteria) ? r.criteria : [];
            const totalMarks = criteria.reduce((s, c) => s + (Number(c.marks) || 0), 0) || Number(r.max_marks) || 0;
            return (
              <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="card-hover">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{r.title}</CardTitle>
                        <CardDescription className="text-xs">
                          {r.subject_name ?? "Any subject"} · {totalMarks} marks · {criteria.length} criteria
                        </CardDescription>
                      </div>
                      <Badge variant={r.type === "analytic" ? "default" : "secondary"} className="text-xs shrink-0 capitalize">
                        {r.type}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="space-y-1">
                      {criteria.slice(0, 3).map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground truncate flex-1">{c.keyword}</span>
                          <span className="font-medium ml-2">{c.marks}m</span>
                        </div>
                      ))}
                      {criteria.length > 3 && (
                        <p className="text-xs text-muted-foreground">+{criteria.length - 3} more criteria</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1" onClick={() => openEdit(r)}>
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1" onClick={() => setPreviewRubric(r)}>
                        <Eye className="h-3 w-3" /> Preview
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(r.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Rubric" : "New Rubric"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input placeholder="e.g. Essay Marking Rubric" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="analytic">Analytic</SelectItem>
                    <SelectItem value="holistic">Holistic</SelectItem>
                    <SelectItem value="single-point">Single Point</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Total Marks</Label>
                <Input type="number" min={1} value={form.max_marks} onChange={e => setForm(f => ({ ...f, max_marks: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Subject (optional)</Label>
                <Select value={form.subject_id} onValueChange={v => setForm(f => ({ ...f, subject_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    {subjectList.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Link to Assignment (optional)</Label>
                <Select value={form.homework_id} onValueChange={v => setForm(f => ({ ...f, homework_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {hwList.map((h: any) => <SelectItem key={h.id} value={String(h.id)}>{h.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Criteria</Label>
                {form.criteria.length > 0 && (
                  <span className="text-xs text-muted-foreground">{totalCriteriaMarks} / {form.max_marks} marks assigned</span>
                )}
              </div>
              <CriteriaEditor criteria={form.criteria} onChange={c => setForm(f => ({ ...f, criteria: c }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.title || saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : editing ? "Update Rubric" : "Create Rubric"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewRubric} onOpenChange={() => setPreviewRubric(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Preview: {previewRubric?.title}</DialogTitle>
          </DialogHeader>
          {previewRubric && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="capitalize">{previewRubric.type}</Badge>
                <span>Total: {previewRubric.max_marks ?? 0} marks</span>
                {previewRubric.subject_name && <span>· {previewRubric.subject_name}</span>}
              </div>
              <div className="space-y-2">
                {(Array.isArray(previewRubric.criteria) ? previewRubric.criteria : []).map((c: Criterion, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{c.keyword}</p>
                      {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                    </div>
                    <Badge className="text-xs shrink-0">{c.marks}m</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
