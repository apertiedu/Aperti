import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, BookOpen, Users, CheckCircle2, XCircle, Edit3, Trash2, Eye, EyeOff, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const TEAL = "#00796B";
const tok = () => localStorage.getItem("aperti_token") || "";
const authFetch = (url: string, opts?: RequestInit) =>
  fetch(url, { ...opts, headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json", ...(opts?.headers || {}) } });

interface Course {
  id: number; title: string; description: string | null; subject: string | null;
  price_egp: string | null; is_published: boolean; duration_weeks: number;
  pending_count: string; approved_count: string; created_at: string;
}
interface Enrollment {
  id: number; course_title: string; student_name: string; student_username: string;
  student_email: string | null; status: string; requested_at: string;
}

function CourseForm({ course, onClose }: { course?: Course | null; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: course?.title ?? "",
    description: course?.description ?? "",
    subject: course?.subject ?? "",
    priceEgp: course?.price_egp ?? "",
    durationWeeks: course?.duration_weeks?.toString() ?? "8",
    isPublished: course?.is_published ?? false,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(course ? `/courses/${course.id}` : "/courses", {
        method: course ? "PUT" : "POST",
        body: JSON.stringify({ ...form, priceEgp: form.priceEgp || null, durationWeeks: parseInt(form.durationWeeks) }),
      });
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-courses"] });
      toast({ title: course ? "Course updated" : "Course created ✅" });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="space-y-4 mt-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Course Title *</Label>
        <Input required value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="e.g. IGCSE Physics Intensive" className="h-10 rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Description</Label>
        <Textarea rows={3} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="What will students learn?" className="rounded-xl resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Subject</Label>
          <Input value={form.subject} onChange={e => setForm(f => ({...f, subject: e.target.value}))} placeholder="Physics, Math…" className="h-10 rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Price (EGP / mo)</Label>
          <Input type="number" value={form.priceEgp} onChange={e => setForm(f => ({...f, priceEgp: e.target.value}))} placeholder="299" className="h-10 rounded-xl" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Duration (weeks)</Label>
        <Input type="number" value={form.durationWeeks} onChange={e => setForm(f => ({...f, durationWeeks: e.target.value}))} className="h-10 rounded-xl" />
      </div>
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input type="checkbox" checked={form.isPublished} onChange={e => setForm(f => ({...f, isPublished: e.target.checked}))} className="rounded" />
        <span className="text-sm text-gray-700">Publish immediately (visible in marketplace)</span>
      </label>
      <Button type="submit" className="w-full h-10 rounded-xl font-semibold" style={{ background: TEAL }} disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : course ? "Save Changes" : "Create Course"}
      </Button>
    </form>
  );
}

export default function MyCourses() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);

  const { data: courses = [], isLoading: coursesLoading } = useQuery<Course[]>({
    queryKey: ["teacher-courses"],
    queryFn: () => authFetch("/courses/teacher/my").then(r => r.json()),
  });

  const { data: enrollments = [] } = useQuery<Enrollment[]>({
    queryKey: ["teacher-enrollments"],
    queryFn: () => authFetch("/courses/teacher/enrollments").then(r => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => authFetch(`/courses/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teacher-courses"] }); toast({ title: "Course deleted" }); },
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: number; isPublished: boolean }) =>
      authFetch(`/courses/${id}`, { method: "PUT", body: JSON.stringify({ isPublished }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teacher-courses"] }),
  });

  const enrollMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      authFetch(`/courses/enrollments/${id}`, { method: "PUT", body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teacher-enrollments"] }); toast({ title: "Enrollment updated" }); },
  });

  const pending = enrollments.filter(e => e.status === "pending");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" /> My Courses
          </h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage your published courses.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={v => { setDialogOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl" style={{ background: TEAL }} onClick={() => setEditing(null)}>
              <Plus className="h-4 w-4" /> New Course
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{editing ? "Edit Course" : "Create Course"}</DialogTitle></DialogHeader>
            <CourseForm course={editing} onClose={() => { setDialogOpen(false); setEditing(null); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="courses">
        <TabsList className="bg-gray-100 rounded-xl p-1">
          <TabsTrigger value="courses" className="rounded-lg text-xs">My Courses ({courses.length})</TabsTrigger>
          <TabsTrigger value="enrollments" className="rounded-lg text-xs">
            Enrollment Requests {pending.length > 0 && <Badge className="ml-1 bg-primary text-white text-[10px] px-1.5">{pending.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="mt-4">
          {coursesLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_,i) => <div key={i} className="h-20 bg-white animate-pulse rounded-2xl" />)}</div>
          ) : courses.length === 0 ? (
            <Card className="border-dashed border-2 border-gray-200"><CardContent className="p-10 text-center text-gray-400">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No courses yet</p>
              <p className="text-sm mt-1">Create your first course to start enrolling students.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {courses.map((c, i) => (
                <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="border border-gray-100 shadow-sm">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${TEAL}12` }}>
                        <BookOpen className="h-5 w-5" style={{ color: TEAL }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-gray-900 truncate">{c.title}</p>
                          <Badge variant={c.is_published ? "default" : "secondary"} className={`text-[10px] px-2 rounded-full ${c.is_published ? "bg-emerald-100 text-emerald-700" : ""}`}>
                            {c.is_published ? "Published" : "Draft"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                          {c.subject && <span>{c.subject}</span>}
                          {c.price_egp && <span>{parseFloat(c.price_egp).toLocaleString()} EGP/mo</span>}
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.approved_count} enrolled</span>
                          {parseInt(c.pending_count) > 0 && <span className="text-amber-600 font-medium">{c.pending_count} pending</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-gray-700"
                          onClick={() => publishMutation.mutate({ id: c.id, isPublished: !c.is_published })}
                          title={c.is_published ? "Unpublish" : "Publish"}>
                          {c.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-gray-700"
                          onClick={() => { setEditing(c); setDialogOpen(true); }}>
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500"
                          onClick={() => deleteMutation.mutate(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="enrollments" className="mt-4">
          {enrollments.length === 0 ? (
            <Card className="border-dashed border-2 border-gray-200"><CardContent className="p-10 text-center text-gray-400">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No enrollment requests</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {enrollments.map((e, i) => (
                <motion.div key={e.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="border border-gray-100 shadow-sm">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold" style={{ background: TEAL }}>
                        {(e.student_name || e.student_username).slice(0,2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900">{e.student_name || e.student_username}</p>
                        <p className="text-xs text-gray-400">→ {e.course_title}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {new Date(e.requested_at).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {e.status === "pending" ? (
                          <>
                            <Button size="sm" className="h-7 px-3 rounded-lg gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => enrollMutation.mutate({ id: e.id, status: "approved" })}>
                              <CheckCircle2 className="h-3 w-3" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 px-3 rounded-lg gap-1 text-xs text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => enrollMutation.mutate({ id: e.id, status: "rejected" })}>
                              <XCircle className="h-3 w-3" /> Reject
                            </Button>
                          </>
                        ) : (
                          <Badge variant={e.status === "approved" ? "default" : "destructive"}
                            className={`text-[10px] rounded-full ${e.status === "approved" ? "bg-emerald-100 text-emerald-700" : ""}`}>
                            {e.status}
                          </Badge>
                        )}
                      </div>
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
