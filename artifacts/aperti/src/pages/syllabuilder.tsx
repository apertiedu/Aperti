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
import { Plus, BookOpen, Trash2, ChevronDown, ChevronUp } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const token = () => localStorage.getItem("aperti_token");
async function fetchJSON(url: string, opts?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export default function Syllabuilder() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", subjectId: "", year: new Date().getFullYear().toString(), description: "" });

  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => fetchJSON("/subjects"),
  });

  const { data: courses, isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: () => fetchJSON("/courses"),
  });

  const createCourse = useMutation({
    mutationFn: (data: any) => fetchJSON("/courses", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["courses"] }); setDialogOpen(false); setForm({ title: "", subjectId: "", year: new Date().getFullYear().toString(), description: "" }); },
  });

  const deleteCourse = useMutation({
    mutationFn: (id: number) => fetchJSON(`/courses/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["courses"] }),
  });

  const subjectList: any[] = Array.isArray(subjects) ? subjects : (subjects?.subjects ?? []);
  const courseList: any[] = Array.isArray(courses) ? courses : (courses?.courses ?? []);

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Syllabuilder<span className="text-primary">™</span></h1>
          <p className="text-muted-foreground">Design and manage course syllabi for each subject and year group.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Syllabus</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Course Syllabus</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Course Title</Label>
                <Input placeholder="e.g. IGCSE Physics 0625" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
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
                  <Label>Academic Year</Label>
                  <Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description / Objectives</Label>
                <Textarea placeholder="Learning objectives, exam board, syllabus code…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
              </div>
              <Button
                className="w-full"
                disabled={!form.title || !form.subjectId || createCourse.isPending}
                onClick={() => createCourse.mutate({ title: form.title, subjectId: parseInt(form.subjectId), academicYear: parseInt(form.year), description: form.description })}
              >
                {createCourse.isPending ? "Creating…" : "Create Syllabus"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {isLoading ? (
        <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : courseList.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No syllabi yet. Create your first course syllabus to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {courseList.map((course: any) => (
            <motion.div key={course.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="card-hover">
                <CardContent className="p-0">
                  <button
                    className="w-full p-4 flex items-center gap-3 text-left"
                    onClick={() => setExpandedId(expandedId === course.id ? null : course.id)}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <BookOpen className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{course.title || course.name}</p>
                      <div className="flex gap-2 mt-0.5">
                        {course.subjectName && <Badge variant="outline" className="text-xs">{course.subjectName}</Badge>}
                        {course.academicYear && <Badge variant="secondary" className="text-xs">{course.academicYear}</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); deleteCourse.mutate(course.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      {expandedId === course.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {expandedId === course.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="border-t px-4 pb-4 pt-3"
                    >
                      <p className="text-sm text-muted-foreground mb-4">{course.description || "No description provided."}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        {[
                          { label: "Lessons", value: course.lessonCount ?? 0 },
                          { label: "Students", value: course.studentCount ?? 0 },
                          { label: "Exams", value: course.examCount ?? 0 },
                          { label: "Avg Grade", value: course.avgGrade != null ? `${course.avgGrade}%` : "—" },
                        ].map(stat => (
                          <div key={stat.label} className="rounded-lg bg-muted/50 p-3 text-center">
                            <p className="text-xl font-bold">{stat.value}</p>
                            <p className="text-xs text-muted-foreground">{stat.label}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
