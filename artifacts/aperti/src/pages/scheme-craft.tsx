import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Grid3X3, Trash2, Calendar } from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("aperti_token");
async function fetchJSON(url: string, opts?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const TERMS = ["Term 1", "Term 2", "Term 3", "Full Year"];

export default function SchemeCraft() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", subjectId: "", term: "Term 1", weeksCount: "12", objectives: "" });

  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => fetchJSON("/subjects"),
  });

  const { data: lessons, isLoading } = useQuery({
    queryKey: ["scheme-craft-lessons"],
    queryFn: () => fetchJSON("/lessons"),
  });

  const createLesson = useMutation({
    mutationFn: (data: any) => fetchJSON("/lessons", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["scheme-craft-lessons"] }); setDialogOpen(false); setForm({ title: "", subjectId: "", term: "Term 1", weeksCount: "12", objectives: "" }); },
  });

  const subjectList: any[] = Array.isArray(subjects) ? subjects : (subjects?.subjects ?? []);
  const lessonList: any[] = Array.isArray(lessons) ? lessons : (lessons?.lessons ?? []);

  const grouped = lessonList.reduce((acc: Record<string, any[]>, lesson: any) => {
    const key = lesson.subjectName || lesson.subject || "Uncategorised";
    if (!acc[key]) acc[key] = [];
    acc[key].push(lesson);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">SchemeCraft<span className="text-primary"></span></h1>
          <p className="text-muted-foreground">Build and manage your schemes of work term by term.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Lesson</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Lesson to Scheme</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Lesson Title</Label>
                <Input placeholder="e.g. Introduction to Forces" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <Select value={form.subjectId} onValueChange={v => setForm(f => ({ ...f, subjectId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {subjectList.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Term</Label>
                  <Select value={form.term} onValueChange={v => setForm(f => ({ ...f, term: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Learning Objectives</Label>
                <Textarea
                  placeholder="By the end of this lesson, students will be able to…"
                  rows={3}
                  value={form.objectives}
                  onChange={e => setForm(f => ({ ...f, objectives: e.target.value }))}
                />
              </div>
              <Button
                className="w-full"
                disabled={!form.title || !form.subjectId || createLesson.isPending}
                onClick={() => createLesson.mutate({
                  title: form.title,
                  subjectId: parseInt(form.subjectId),
                  term: form.term,
                  objectives: form.objectives,
                })}
              >
                {createLesson.isPending ? "Adding…" : "Add Lesson"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {isLoading ? (
        <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : lessonList.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <Grid3X3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No lessons in your scheme yet. Add your first lesson to begin planning.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([subject, items]) => (
            <motion.div key={subject} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <span>{subject}</span>
                <Badge variant="secondary">{(items as any[]).length} lessons</Badge>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {(items as any[]).map((lesson: any, i: number) => (
                  <Card key={lesson.id ?? i} className="card-hover">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-medium text-sm leading-tight">{lesson.title}</p>
                        {lesson.term && <Badge variant="outline" className="text-xs shrink-0">{lesson.term}</Badge>}
                      </div>
                      {lesson.objectives && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{lesson.objectives}</p>
                      )}
                      <div className="flex items-center gap-1 mt-3">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {lesson.updatedAt ? new Date(lesson.updatedAt).toLocaleDateString() : "—"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
