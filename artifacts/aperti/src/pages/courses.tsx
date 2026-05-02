import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BookOpen, Plus, Pencil, Trash2, Globe, Building2, Layers,
  DollarSign, Users, Calendar, Star, ChevronRight, Clock
} from "lucide-react";

type Course = {
  id: number; title: string; description: string | null; subject: string | null;
  difficulty: string; price_monthly: string | null; price_per_session: string | null;
  price_trial: string | null; mode: string; is_active: boolean; max_students: number | null;
  syllabus: string | null; created_at: string;
};

const DIFF_COLORS: Record<string, string> = {
  beginner: "bg-green-100 text-green-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced: "bg-red-100 text-red-700",
};
const MODE_ICONS: Record<string, React.ReactNode> = {
  online: <Globe className="h-3.5 w-3.5" />,
  center: <Building2 className="h-3.5 w-3.5" />,
  hybrid: <Layers className="h-3.5 w-3.5" />,
};

function CourseFormDialog({ course, onSave, trigger }: { course?: Course; onSave: (data: any) => Promise<void>; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: course?.title || "", description: course?.description || "",
    subject: course?.subject || "", difficulty: course?.difficulty || "beginner",
    priceMonthly: course?.price_monthly || "", pricePerSession: course?.price_per_session || "",
    priceTrial: course?.price_trial || "", mode: course?.mode || "online",
    maxStudents: course?.max_students?.toString() || "", syllabus: course?.syllabus || "",
  });
  const { toast } = useToast();
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setLoading(true);
    try { await onSave({ ...form }); setOpen(false); }
    catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{course ? "Edit Course" : "Create Course"}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Course Title *</Label>
            <Input placeholder="e.g. IGCSE Mathematics" value={form.title} onChange={e => set("title", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input placeholder="e.g. Maths" value={form.subject} onChange={e => set("subject", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <Select value={form.difficulty} onValueChange={v => set("difficulty", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Mode</Label>
            <Select value={form.mode} onValueChange={v => set("mode", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Monthly Price</Label>
              <Input type="number" placeholder="0.00" value={form.priceMonthly} onChange={e => set("priceMonthly", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Per Session</Label>
              <Input type="number" placeholder="0.00" value={form.pricePerSession} onChange={e => set("pricePerSession", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Trial Price</Label>
              <Input type="number" placeholder="0.00" value={form.priceTrial} onChange={e => set("priceTrial", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Max Students</Label>
            <Input type="number" placeholder="Leave blank for unlimited" value={form.maxStudents} onChange={e => set("maxStudents", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} placeholder="Brief course description..." value={form.description} onChange={e => set("description", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Syllabus Overview</Label>
            <Textarea rows={4} placeholder="Topics covered, learning objectives..." value={form.syllabus} onChange={e => set("syllabus", e.target.value)} />
          </div>
          <Button className="w-full" onClick={handleSave} disabled={loading || !form.title.trim()}>
            {loading ? "Saving..." : course ? "Save Changes" : "Create Course"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [trialsOpen, setTrialsOpen] = useState(false);
  const [trials, setTrials] = useState<any[]>([]);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/courses", { credentials: "include" });
      if (r.ok) setCourses(await r.json());
    } finally { setLoading(false); }
  };

  const loadTrials = async () => {
    const r = await fetch("/api/trials", { credentials: "include" });
    if (r.ok) setTrials(await r.json());
    setTrialsOpen(true);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data: any) => {
    const r = await fetch("/api/courses", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || "Failed to create course"); }
    await load(); toast({ title: "Course created!" });
  };

  const handleEdit = (course: Course) => async (data: any) => {
    const r = await fetch(`/api/courses/${course.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || "Failed to update"); }
    await load(); toast({ title: "Updated!" });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this course?")) return;
    await fetch(`/api/courses/${id}`, { method: "DELETE", credentials: "include" });
    await load(); toast({ title: "Course deleted" });
  };

  const handleToggleActive = async (course: Course) => {
    await fetch(`/api/courses/${course.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !course.is_active }) });
    setCourses(cs => cs.map(c => c.id === course.id ? { ...c, is_active: !c.is_active } : c));
  };

  const handleTrialStatus = async (id: number, status: string) => {
    await fetch(`/api/trials/${id}/status`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setTrials(ts => ts.map(t => t.id === id ? { ...t, status } : t));
    toast({ title: `Trial marked as ${status}` });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />Courses
          </h1>
          <p className="text-muted-foreground mt-1">Manage your courses, pricing, and trial bookings.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadTrials} className="gap-2"><Calendar className="h-4 w-4" />Trial Bookings</Button>
          <CourseFormDialog onSave={handleCreate} trigger={<Button className="gap-2"><Plus className="h-4 w-4" />New Course</Button>} />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-64 rounded-xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-muted-foreground opacity-30" />
          </div>
          <p className="text-muted-foreground">No courses yet. Create your first course to get started.</p>
          <CourseFormDialog onSave={handleCreate} trigger={<Button className="gap-2"><Plus className="h-4 w-4" />Create First Course</Button>} />
        </div>
      ) : (
        <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" initial="hidden" animate="show"
          variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
          {courses.map((course, i) => (
            <motion.div key={course.id} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
              <Card className={`border-border/50 shadow-sm h-full flex flex-col transition-all hover:shadow-md ${!course.is_active ? "opacity-60" : ""}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base leading-tight line-clamp-2">{course.title}</CardTitle>
                      {course.subject && <p className="text-xs text-muted-foreground mt-1">{course.subject}</p>}
                    </div>
                    <Switch checked={course.is_active} onCheckedChange={() => handleToggleActive(course)} className="shrink-0 mt-0.5" />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFF_COLORS[course.difficulty] || "bg-muted text-muted-foreground"}`}>
                      {course.difficulty}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium flex items-center gap-1">
                      {MODE_ICONS[course.mode]}{course.mode}
                    </span>
                    {!course.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Inactive</span>}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3 pt-0">
                  {course.description && <p className="text-sm text-muted-foreground line-clamp-2">{course.description}</p>}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {course.price_monthly && (
                      <div className="bg-green-50 rounded-lg p-2 text-center">
                        <p className="text-green-700 font-bold">${course.price_monthly}</p>
                        <p className="text-green-600">/ month</p>
                      </div>
                    )}
                    {course.price_per_session && (
                      <div className="bg-blue-50 rounded-lg p-2 text-center">
                        <p className="text-blue-700 font-bold">${course.price_per_session}</p>
                        <p className="text-blue-600">/ session</p>
                      </div>
                    )}
                    {course.price_trial && (
                      <div className="bg-amber-50 rounded-lg p-2 text-center">
                        <p className="text-amber-700 font-bold">${course.price_trial}</p>
                        <p className="text-amber-600">trial</p>
                      </div>
                    )}
                  </div>
                  {course.max_students && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" /><span>Max {course.max_students} students</span>
                    </div>
                  )}
                  {course.syllabus && (
                    <p className="text-xs text-muted-foreground line-clamp-2 italic">{course.syllabus}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <CourseFormDialog course={course} onSave={handleEdit(course)}
                      trigger={<Button variant="outline" size="sm" className="flex-1 gap-1.5"><Pencil className="h-3.5 w-3.5" />Edit</Button>} />
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(course.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Trial Bookings Dialog */}
      <Dialog open={trialsOpen} onOpenChange={setTrialsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" />Trial Session Bookings</DialogTitle></DialogHeader>
          {trials.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No trial bookings yet.</p>
          ) : (
            <div className="space-y-3">
              {trials.map(t => (
                <div key={t.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{t.student_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.course_title || "No course"} · {t.mode} {t.center_name ? `· ${t.center_name}` : ""}
                    </p>
                    {t.scheduled_at && <p className="text-xs text-muted-foreground">{new Date(t.scheduled_at).toLocaleString()}</p>}
                    {t.student_phone && <p className="text-xs text-muted-foreground">📞 {t.student_phone}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      t.status === "confirmed" ? "bg-green-100 text-green-700" :
                      t.status === "cancelled" ? "bg-red-100 text-red-700" :
                      t.status === "completed" ? "bg-blue-100 text-blue-700" :
                      "bg-amber-100 text-amber-700"}`}>
                      {t.status}
                    </span>
                    {t.status === "pending" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="text-xs h-6 px-2" onClick={() => handleTrialStatus(t.id, "confirmed")}>Confirm</Button>
                        <Button size="sm" variant="outline" className="text-xs h-6 px-2 text-destructive" onClick={() => handleTrialStatus(t.id, "cancelled")}>Cancel</Button>
                      </div>
                    )}
                    {t.status === "confirmed" && (
                      <Button size="sm" variant="outline" className="text-xs h-6 px-2" onClick={() => handleTrialStatus(t.id, "completed")}>Mark Done</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
