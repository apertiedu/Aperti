import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, BookOpen, Trash2, ChevronDown, ChevronUp,
  Library, FlaskConical, FileText, Info, ExternalLink,
} from "lucide-react";

const API = "/api";
async function fetchJSON(url: string, opts?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const BOARDS = ["CAIE", "Edexcel", "IB", "AQA", "OCR", "WJEC", "Pearson", "Other"];
const LEVELS = ["IGCSE", "AS Level", "A Level", "O Level", "GCSE", "IB DP", "IB MYP", "Pre-IGCSE", "Other"];

const DEFAULT_PAPERS = {
  extended: [
    { num: "2", name: "MCQ Extended" },
    { num: "4", name: "Theory Extended" },
    { num: "6", name: "Alternative to Practical" },
  ],
  core: [
    { num: "1", name: "MCQ Core" },
    { num: "3", name: "Theory Core" },
    { num: "5", name: "Practical" },
  ],
};

/* ── Subject creation form ─────────────────────────────────────────────────── */
function SubjectForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "", board: "CAIE", level: "IGCSE", code: "",
    syllabusCodes: "", codeExplainer: "", pdfUrl: "",
    papersBreakdown: DEFAULT_PAPERS,
  });

  const f = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }));

  const updatePaper = (tier: "extended" | "core", idx: number, field: "num" | "name", val: string) => {
    const papers = { ...form.papersBreakdown };
    papers[tier] = [...papers[tier]];
    papers[tier][idx] = { ...papers[tier][idx], [field]: val };
    f("papersBreakdown", papers);
  };

  const addPaper = (tier: "extended" | "core") => {
    const papers = { ...form.papersBreakdown };
    papers[tier] = [...papers[tier], { num: "", name: "" }];
    f("papersBreakdown", papers);
  };

  const removePaper = (tier: "extended" | "core", idx: number) => {
    const papers = { ...form.papersBreakdown };
    papers[tier] = papers[tier].filter((_, i) => i !== idx);
    f("papersBreakdown", papers);
  };

  const create = useMutation({
    mutationFn: () => fetchJSON("/subjects", {
      method: "POST",
      body: JSON.stringify({
        name: form.name,
        board: form.board,
        code: form.code,
        level: form.level,
        syllabusCodes: form.syllabusCodes,
        papersBreakdown: form.papersBreakdown,
        pdfUrl: form.pdfUrl,
        codeExplainer: form.codeExplainer,
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subjects"] });
      onDone();
    },
  });

  const multipleCodesDetected = form.syllabusCodes.includes(",");

  return (
    <div className="space-y-4 mt-2 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Subject Name *</Label>
          <Input placeholder="e.g. IGCSE Chemistry" value={form.name} onChange={e => f("name", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Exam Board *</Label>
          <Select value={form.board} onValueChange={v => f("board", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{BOARDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Level</Label>
          <Select value={form.level} onValueChange={v => f("level", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Syllabus Code(s)</Label>
        <Input
          placeholder="e.g. 0620, 0971 (comma-separated if multiple)"
          value={form.syllabusCodes}
          onChange={e => f("syllabusCodes", e.target.value)}
        />
        <p className="text-xs text-gray-400">Enter multiple codes separated by commas. They will be explained below.</p>
      </div>

      {multipleCodesDetected && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
          <div className="space-y-1.5">
            <Label>Code Explainer <span className="text-gray-400 font-normal">(helps parents & students choose)</span></Label>
            <Textarea
              placeholder={`e.g. "0620 is the standard IGCSE Chemistry for most centres. 0971 is identical content but assessed using UK grading notation — check which your school uses."`}
              value={form.codeExplainer}
              onChange={e => f("codeExplainer", e.target.value)}
              rows={3}
            />
          </div>
        </motion.div>
      )}

      {/* Papers Breakdown */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          Papers Breakdown
          <span className="text-xs font-normal text-gray-400">Click + to add, × to remove</span>
        </Label>
        {(["extended", "core"] as const).map(tier => (
          <div key={tier} className="rounded-xl border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700 capitalize">{tier} Papers</span>
              <button
                type="button"
                onClick={() => addPaper(tier)}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add paper
              </button>
            </div>
            <div className="space-y-1.5">
              {form.papersBreakdown[tier].map((paper, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    placeholder="No."
                    value={paper.num}
                    onChange={e => updatePaper(tier, idx, "num", e.target.value)}
                    className="w-16 h-8 text-xs"
                  />
                  <Input
                    placeholder="Paper name"
                    value={paper.name}
                    onChange={e => updatePaper(tier, idx, "name", e.target.value)}
                    className="flex-1 h-8 text-xs"
                  />
                  <button type="button" onClick={() => removePaper(tier, idx)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label>Official Syllabus PDF URL <span className="text-gray-400 font-normal">(optional)</span></Label>
        <Input
          placeholder="https://… (direct link to the board's PDF)"
          value={form.pdfUrl}
          onChange={e => f("pdfUrl", e.target.value)}
        />
        <p className="text-xs text-gray-400">Students and parents will see a "Download Syllabus" button with this link.</p>
      </div>

      <Button
        className="w-full bg-primary text-white hover:bg-primary/90"
        disabled={!form.name || create.isPending}
        onClick={() => create.mutate()}
      >
        {create.isPending ? "Creating…" : "Add Subject"}
      </Button>
    </div>
  );
}

/* ── Subject card ──────────────────────────────────────────────────────────── */
function SubjectCard({ subject, onDelete }: { subject: any; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const papers = subject.papers_breakdown as typeof DEFAULT_PAPERS | null;

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        <button
          className="w-full p-4 flex items-center gap-3 text-left"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FlaskConical className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm text-gray-900">{subject.name}</p>
              <Badge variant="outline" className="text-xs">{subject.board}</Badge>
              {subject.level && <Badge variant="secondary" className="text-xs">{subject.level}</Badge>}
            </div>
            {subject.syllabus_codes && (
              <p className="text-xs text-gray-400 mt-0.5 font-mono">{subject.syllabus_codes}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {subject.pdf_url && (
              <a
                href={subject.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <FileText className="h-3.5 w-3.5" /> PDF
              </a>
            )}
            <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1.5 rounded hover:bg-red-50">
              <Trash2 className="h-4 w-4 text-red-400" />
            </button>
            {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t px-4 pb-4 pt-3 space-y-3"
            >
              {subject.code_explainer && (
                <div className="flex gap-2 p-3 bg-blue-50 rounded-xl">
                  <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 leading-relaxed">{subject.code_explainer}</p>
                </div>
              )}

              {papers && (
                <div className="grid grid-cols-2 gap-3">
                  {(["extended", "core"] as const).map(tier => (
                    papers[tier]?.length > 0 && (
                      <div key={tier} className="space-y-1.5">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{tier}</p>
                        {papers[tier].map((p: any) => (
                          <div key={p.num} className="flex items-center gap-2 text-xs">
                            <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-700 shrink-0 text-[10px]">{p.num}</span>
                            <span className="text-gray-600">{p.name}</span>
                          </div>
                        ))}
                      </div>
                    )
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────────── */
export default function Syllabuilder() {
  const qc = useQueryClient();
  const [subjectDialog, setSubjectDialog] = useState(false);
  const [courseDialog, setCourseDialog] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [courseForm, setCourseForm] = useState({ title: "", subjectId: "", year: new Date().getFullYear().toString(), description: "" });

  const { data: subjects, isLoading: subjectsLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => fetchJSON("/subjects"),
  });

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: () => fetchJSON("/courses"),
  });

  const deleteSubject = useMutation({
    mutationFn: (id: number) => fetchJSON(`/subjects/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subjects"] }),
  });

  const createCourse = useMutation({
    mutationFn: (data: any) => fetchJSON("/courses", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["courses"] });
      setCourseDialog(false);
      setCourseForm({ title: "", subjectId: "", year: new Date().getFullYear().toString(), description: "" });
    },
  });

  const deleteCourse = useMutation({
    mutationFn: (id: number) => fetchJSON(`/courses/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses"] }),
  });

  const subjectList: any[] = Array.isArray(subjects) ? subjects : (subjects?.subjects ?? []);
  const courseList: any[] = Array.isArray(courses) ? courses : (courses?.courses ?? []);

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Syllabuilder</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage global subjects and course syllabi.</p>
      </motion.div>

      <Tabs defaultValue="subjects">
        <div className="flex items-center justify-between mb-5">
          <TabsList className="bg-card border border-border rounded-xl p-1 shadow-sm">
            <TabsTrigger value="subjects" className="rounded-lg text-sm gap-2">
              <FlaskConical className="h-3.5 w-3.5" /> Subjects ({subjectList.length})
            </TabsTrigger>
            <TabsTrigger value="syllabi" className="rounded-lg text-sm gap-2">
              <Library className="h-3.5 w-3.5" /> Syllabi ({courseList.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Dialog open={subjectDialog} onOpenChange={setSubjectDialog}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-white hover:bg-primary/90 gap-2">
                  <Plus className="h-4 w-4" /> Add Subject
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Subject</DialogTitle>
                </DialogHeader>
                <SubjectForm onDone={() => setSubjectDialog(false)} />
              </DialogContent>
            </Dialog>

            <Dialog open={courseDialog} onOpenChange={setCourseDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" /> New Syllabus
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Course Syllabus</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="space-y-1.5">
                    <Label>Course Title</Label>
                    <Input placeholder="e.g. IGCSE Chemistry 0620 — Full Course" value={courseForm.title} onChange={e => setCourseForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Subject</Label>
                      <Select value={courseForm.subjectId} onValueChange={v => setCourseForm(f => ({ ...f, subjectId: v }))}>
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
                      <Input type="number" value={courseForm.year} onChange={e => setCourseForm(f => ({ ...f, year: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description / Objectives</Label>
                    <Textarea placeholder="Learning objectives, covered topics…" value={courseForm.description} onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))} rows={3} />
                  </div>
                  <Button
                    className="w-full bg-primary text-white"
                    disabled={!courseForm.title || !courseForm.subjectId || createCourse.isPending}
                    onClick={() => createCourse.mutate({ title: courseForm.title, subjectId: parseInt(courseForm.subjectId), academicYear: parseInt(courseForm.year), description: courseForm.description })}
                  >
                    {createCourse.isPending ? "Creating…" : "Create Syllabus"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* SUBJECTS TAB */}
        <TabsContent value="subjects">
          {subjectsLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
          ) : subjectList.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-12 text-center text-gray-400">
                <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-semibold">No subjects yet</p>
                <p className="text-sm mt-1">Add your first subject to define boards, codes, and paper structures.</p>
                <Button onClick={() => setSubjectDialog(true)} className="mt-4 bg-primary text-white" size="sm">Add Subject</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {subjectList.map((s: any, i: number) => (
                <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <SubjectCard subject={s} onDelete={() => deleteSubject.mutate(s.id)} />
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* SYLLABI TAB */}
        <TabsContent value="syllabi">
          {coursesLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
          ) : courseList.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-12 text-center text-gray-400">
                <Library className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-semibold">No syllabi yet</p>
                <p className="text-sm mt-1">Create a course syllabus once you've added your subjects.</p>
                <Button onClick={() => setCourseDialog(true)} variant="outline" className="mt-4" size="sm">New Syllabus</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {courseList.map((course: any) => (
                <motion.div key={course.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-0">
                      <button
                        className="w-full p-4 flex items-center gap-3 text-left"
                        onClick={() => setExpandedId(expandedId === course.id ? null : course.id)}
                      >
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <BookOpen className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{course.title || course.name}</p>
                          <div className="flex gap-2 mt-0.5">
                            {course.subjectName && <Badge variant="outline" className="text-xs">{course.subjectName}</Badge>}
                            {course.academicYear && <Badge variant="secondary" className="text-xs">{course.academicYear}</Badge>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={e => { e.stopPropagation(); deleteCourse.mutate(course.id); }} className="p-1.5 rounded hover:bg-red-50">
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </button>
                          {expandedId === course.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                        </div>
                      </button>
                      {expandedId === course.id && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="border-t px-4 pb-4 pt-3">
                          <p className="text-sm text-gray-500 mb-4">{course.description || "No description."}</p>
                          <div className="grid grid-cols-4 gap-3">
                            {[
                              { label: "Lessons", value: course.lessonCount ?? 0 },
                              { label: "Students", value: course.studentCount ?? 0 },
                              { label: "Exams", value: course.examCount ?? 0 },
                              { label: "Avg Grade", value: course.avgGrade != null ? `${course.avgGrade}%` : "—" },
                            ].map(stat => (
                              <div key={stat.label} className="rounded-xl bg-gray-50 p-3 text-center">
                                <p className="text-xl font-bold">{stat.value}</p>
                                <p className="text-xs text-gray-400">{stat.label}</p>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
