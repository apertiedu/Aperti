import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  BookOpen, Plus, Pencil, Trash2, Users, Clock, ChevronRight,
  CheckCircle, Globe, Lock, TrendingUp, Layers, ArrowLeft,
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

const GRADE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "#dcfce7", text: "#16a34a", border: "#86efac" },
  B: { bg: "#ccfbf1", text: "#0d9488", border: "#5eead4" },
  C: { bg: "#fef3c7", text: "#d97706", border: "#fcd34d" },
  D: { bg: "#fee2e2", text: "#dc2626", border: "#fca5a5" },
};

function QualityScoreBadge({ courseId }: { courseId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["quality-score", courseId],
    queryFn: () =>
      fetch(`/api/teacher/courses/${courseId}/quality-score`, {
        headers: {},
      }).then(r => r.ok ? r.json() : null),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) return <span className="inline-block h-5 w-6 rounded-full bg-muted animate-pulse" />;
  if (!data?.grade) return null;

  const s = GRADE_STYLES[data.grade] ?? GRADE_STYLES.D;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1.5 rounded-full text-[10px] font-black shrink-0 cursor-default border"
          style={{ background: s.bg, color: s.text, borderColor: s.border }}
        >
          {data.grade}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-[160px]">
        <p className="font-bold mb-0.5">Quality: {data.label} ({data.qualityScore}%)</p>
        <p>Attendance {data.breakdown?.attendanceRate ?? "—"}%</p>
        <p>Exam avg {data.breakdown?.avgExamScore ?? "—"}%</p>
        <p>{data.breakdown?.enrolledStudents ?? 0} enrolled</p>
      </TooltipContent>
    </Tooltip>
  );
}

const BOARDS = ["CAIE", "Edexcel", "IB", "AQA", "OCR", "WJEC", "Other"];
const LEVELS = ["IGCSE", "AS Level", "A Level", "O Level", "GCSE", "IB DP", "Other"];
const EMPTY_FORM = {
  name: "", description: "", subject_id: "", board: "CAIE", level: "A Level",
  session: "", duration_weeks: "12", language: "English", visibility: "draft",
};

const VIS_BADGES: Record<string, React.ReactElement> = {
  draft: <Badge variant="secondary" className="text-xs">Draft</Badge>,
  private: <Badge variant="outline" className="text-xs"><Lock className="h-3 w-3 mr-1" />Private</Badge>,
  public: <Badge className="text-xs"><Globe className="h-3 w-3 mr-1" />Public</Badge>,
};

export default function TeacherCourses() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [tab, setTab] = useState("overview");

  const { data: courses, isLoading } = useQuery<any[]>({
    queryKey: ["teacher-courses"],
    queryFn: () => apiFetch("/teacher-courses"),
  });

  const { data: subjects } = useQuery<any[]>({
    queryKey: ["subjects"],
    queryFn: () => apiFetch("/subjects"),
  });

  const { data: courseDetail } = useQuery({
    queryKey: ["teacher-course-detail", selectedCourse?.id],
    queryFn: () => apiFetch(`/teacher-courses/${selectedCourse.id}`),
    enabled: !!selectedCourse,
  });

  const courseList: any[] = Array.isArray(courses) ? courses : [];
  const subjectList: any[] = Array.isArray(subjects) ? subjects : [];

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editingCourse
        ? apiFetch(`/teacher-courses/${editingCourse.id}`, { method: "PUT", body: JSON.stringify(data) })
        : apiFetch("/teacher-courses", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-courses"] });
      setDialogOpen(false);
      toast({ title: editingCourse ? "Course updated" : "Course created", description: form.name });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/teacher-courses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-courses"] });
      setSelectedCourse(null);
    },
  });

  function openCreate() {
    setEditingCourse(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  }

  function openEdit(course: any) {
    setEditingCourse(course);
    setForm({
      name: course.name ?? "", description: course.description ?? "",
      subject_id: course.subject_id ? String(course.subject_id) : "",
      board: course.board ?? "CAIE", level: course.level ?? "A Level",
      session: course.session ?? "", duration_weeks: String(course.duration_weeks ?? 12),
      language: course.language ?? "English", visibility: course.visibility ?? "draft",
    });
    setDialogOpen(true);
  }

  function handleSave() {
    saveMutation.mutate({
      name: form.name, description: form.description,
      subject_id: form.subject_id ? parseInt(form.subject_id) : null,
      board: form.board, level: form.level, session: form.session || null,
      duration_weeks: parseInt(form.duration_weeks), language: form.language,
      visibility: form.visibility,
    });
  }

  /* ── Detail View ───────────────────────────────────────────────────── */
  if (selectedCourse) {
    const detail = courseDetail ?? selectedCourse;
    const units: any[] = detail?.units ?? [];
    const enrolled = detail?.enrolled_count ?? 0;
    const completed = detail?.completed_count ?? 0;

    return (
      <div className="min-h-screen bg-background p-6 page-transition">
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
          <button
            onClick={() => setSelectedCourse(null)}
            className="flex items-center gap-2 text-muted-foreground text-sm mb-6 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Courses
          </button>

          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold">{detail.name}</h1>
                {VIS_BADGES[detail.visibility ?? "draft"]}
              </div>
              <p className="text-muted-foreground text-sm">{detail.board} · {detail.level} · {detail.duration_weeks} weeks</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => openEdit(selectedCourse)}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button variant="destructive" size="sm" className="gap-2" onClick={() => deleteMutation.mutate(selectedCourse.id)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Students Enrolled", value: enrolled, icon: <Users className="h-4 w-4 text-primary" /> },
              { label: "Units", value: units.length, icon: <Layers className="h-4 w-4 text-blue-500" /> },
              { label: "Completion Rate", value: enrolled > 0 ? `${Math.round((completed / enrolled) * 100)}%` : "—", icon: <TrendingUp className="h-4 w-4 text-emerald-500" /> },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">{s.icon}</div>
                  <div>
                    <p className="text-xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="overview">Units & Topics</TabsTrigger>
              <TabsTrigger value="students">Students</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              {units.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center text-muted-foreground">
                    <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No units yet</p>
                    <p className="text-sm mt-1">Units and topics will appear here once added to this course.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {units.map((unit: any, i: number) => (
                    <Card key={unit.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">
                            <span className="text-muted-foreground mr-2">Unit {i + 1}.</span>
                            {unit.title}
                          </CardTitle>
                          <Badge variant="outline" className="text-xs">{(unit.topics ?? []).length} topics</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1">
                          {(unit.topics ?? []).map((topic: any) => (
                            <div key={topic.id} className="flex items-center gap-2 text-sm text-muted-foreground py-1 border-b last:border-b-0">
                              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                              <span>{topic.title}</span>
                              <Badge variant="secondary" className="text-[10px] ml-auto capitalize">{topic.topic_type ?? "topic"}</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="students">
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">{enrolled} students enrolled</p>
                  <p className="text-sm mt-1">Student progress tracking coming in Phase 3.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Edit Dialog rendered at detail level too */}
        <CourseDialog open={dialogOpen} onOpenChange={setDialogOpen} form={form} setForm={setForm}
          onSave={handleSave} isPending={saveMutation.isPending} editing={!!editingCourse} subjectList={subjectList} />
      </div>
    );
  }

  /* ── List View ─────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">My Courses</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-12">Manage your structured teacher courses with units and topics.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> New Course
        </Button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Courses", value: courseList.length },
          { label: "Published", value: courseList.filter(c => c.visibility === "public").length },
          { label: "Draft", value: courseList.filter(c => c.visibility === "draft").length },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : courseList.length === 0 ? (
        <Card>
          <CardContent className="p-16 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-lg">No courses yet</p>
            <p className="text-sm mt-1">Create your first structured course to start organising your teaching.</p>
            <Button onClick={openCreate} className="mt-4 gap-2"><Plus className="h-4 w-4" /> Create First Course</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {courseList.map(course => (
            <motion.div key={course.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="card-hover cursor-pointer" onClick={() => setSelectedCourse(course)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm truncate">{course.name}</CardTitle>
                      <CardDescription className="text-xs">{course.board} · {course.level}</CardDescription>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <QualityScoreBadge courseId={course.id} />
                      {VIS_BADGES[course.visibility ?? "draft"]}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {course.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{course.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{course.duration_weeks}w</span>
                    <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{course.unit_count ?? 0} units</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1"
                      onClick={e => { e.stopPropagation(); openEdit(course); }}>
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button size="sm" className="h-7 text-xs flex-1" onClick={() => setSelectedCourse(course)}>
                      Open <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <CourseDialog open={dialogOpen} onOpenChange={setDialogOpen} form={form} setForm={setForm}
        onSave={handleSave} isPending={saveMutation.isPending} editing={!!editingCourse} subjectList={subjectList} />
    </div>
  );
}

/* ── Shared Course Dialog ──────────────────────────────────────────────── */
function CourseDialog({ open, onOpenChange, form, setForm, onSave, isPending, editing, subjectList }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Course" : "New Course"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Course Name</Label>
            <Input placeholder="e.g. CAIE A-Level Physics 2024/25" value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select value={form.subject_id} onValueChange={v => setForm((f: any) => ({ ...f, subject_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {subjectList.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Exam Board</Label>
              <Select value={form.board} onValueChange={v => setForm((f: any) => ({ ...f, board: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BOARDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Level</Label>
              <Select value={form.level} onValueChange={v => setForm((f: any) => ({ ...f, level: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Duration (weeks)</Label>
              <Input type="number" min={1} max={52} value={form.duration_weeks} onChange={e => setForm((f: any) => ({ ...f, duration_weeks: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Session (e.g. 2024/25)</Label>
              <Input placeholder="2024/25" value={form.session} onChange={e => setForm((f: any) => ({ ...f, session: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Visibility</Label>
              <Select value={form.visibility} onValueChange={v => setForm((f: any) => ({ ...f, visibility: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={2} placeholder="Describe the course scope and objectives…" value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={!form.name || isPending}>
            {isPending ? "Saving…" : editing ? "Update Course" : "Create Course"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
