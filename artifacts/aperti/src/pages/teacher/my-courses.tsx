import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import CourseHealthBadge from "@/components/course-health-badge";
import {
  Plus, BookOpen, Users, CheckCircle2, XCircle, Edit3, Trash2,
  Eye, EyeOff, Clock, Search, GraduationCap, TrendingUp, Globe,
  ImageIcon, ChevronRight, AlertTriangle, BarChart2, Archive, ArchiveRestore,
} from "lucide-react";
import UpgradeModal from "@/components/upgrade-modal";
import PlanUsageBar from "@/components/plan-usage-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const TEAL = "#0D9488";
const TEAL_LIGHT = "#E0F2F1";
const tok = () => localStorage.getItem("aperti_token") || "";

const GRADE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "#dcfce7", text: "#16a34a", border: "#86efac" },
  B: { bg: "#E0F2F1", text: "#0D9488", border: "#5eead4" },
  C: { bg: "#fef3c7", text: "#d97706", border: "#fcd34d" },
  D: { bg: "#fee2e2", text: "#dc2626", border: "#fca5a5" },
};

function CourseCoverageBadge({ courseId }: { courseId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["course-coverage", courseId],
    queryFn: () =>
      fetch(`/api/course-health/${courseId}/coverage`, {
        headers: { Authorization: `Bearer ${tok()}` },
      }).then(r => r.ok ? r.json() : null),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  if (isLoading) return <span className="inline-block h-4 w-10 rounded bg-gray-100 animate-pulse" />;
  if (!data || data.totalSubjects === 0) return null;

  const pct = data.summary?.coveragePct ?? 0;
  const color = pct >= 80 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626";
  const bg = pct >= 80 ? "#dcfce7" : pct >= 50 ? "#fef3c7" : "#fee2e2";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[10px] font-bold shrink-0 cursor-default border"
          style={{ background: bg, color, borderColor: color + "55" }}
        >
          <BarChart2 className="h-2.5 w-2.5" />
          {pct}%
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-[200px]">
        <p className="font-bold mb-1">Syllabus Coverage ({pct}%)</p>
        <p>{data.summary?.withAssessments ?? 0}/{data.totalSubjects} subjects have assessments</p>
        <p>{data.summary?.withRevisionNotes ?? 0}/{data.totalSubjects} have revision notes</p>
        <p>{data.summary?.withQuestions ?? 0}/{data.totalSubjects} have question bank entries</p>
        {data.gaps?.length > 0 && (
          <p className="mt-1 text-orange-600 text-[10px]">{data.gaps.length} gap{data.gaps.length > 1 ? "s" : ""} detected</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function QualityScoreBadge({ courseId }: { courseId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["quality-score", courseId],
    queryFn: () =>
      fetch(`/api/teacher/courses/${courseId}/quality-score`, {
        headers: { Authorization: `Bearer ${tok()}` },
      }).then(r => r.ok ? r.json() : null),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return <span className="inline-block h-5 w-7 rounded-full bg-gray-100 animate-pulse" />;
  }
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
const authFetch = (url: string, opts?: RequestInit) =>
  fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${tok()}`,
      "Content-Type": "application/json",
      ...(opts?.headers || {}),
    },
  });

interface Course {
  id: number;
  title: string;
  description: string | null;
  subject: string | null;
  price_egp: string | null;
  thumbnail_url: string | null;
  is_published: boolean;
  is_archived: boolean;
  duration_weeks: number;
  enrolled_count: number;
  pending_count: string;
  approved_count: string;
  created_at: string;
}

interface Enrollment {
  id: number;
  course_id: number;
  course_title: string;
  student_name: string;
  student_username: string;
  student_email: string | null;
  status: string;
  requested_at: string;
}

const DELIVERY_TYPES = ["Online", "Centre", "Hybrid"] as const;
const PAYMENT_MODELS = [
  { value: "monthly", label: "Monthly subscription" },
  { value: "per_lesson", label: "Per lesson" },
  { value: "full_course", label: "Full course (one-time)" },
  { value: "installments", label: "Half-course installments (2 payments)" },
] as const;

/* ── Course form ─────────────────────────────────────────────────────────── */
function CourseForm({ course, onClose, onLimitExceeded }: { course?: Course | null; onClose: () => void; onLimitExceeded?: (msg: string) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Fetch global subjects from API
  const { data: subjectsData } = useQuery({
    queryKey: ["global-subjects"],
    queryFn: () =>
      authFetch("/api/subjects").then(r => r.ok ? r.json() : []).then(data => Array.isArray(data) ? data : []),
  });
  const subjectOptions: { id: number; name: string }[] = Array.isArray(subjectsData) ? subjectsData : [];

  const [form, setForm] = useState({
    title: course?.title ?? "",
    description: course?.description ?? "",
    subject: course?.subject ?? "",
    priceEgp: course?.price_egp ?? "",
    thumbnailUrl: course?.thumbnail_url ?? "",
    durationWeeks: course?.duration_weeks?.toString() ?? "8",
    isPublished: course?.is_published ?? false,
    deliveryType: (course as any)?.delivery_type ?? "Online",
    paymentModel: (course as any)?.payment_model ?? "monthly",
    recordingsIncluded: (course as any)?.recordings_included ?? true,
    materialsFeeEgp: (course as any)?.materials_fee_egp ?? "",
  });

  const f = (k: keyof typeof form, v: string | boolean) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const paymentLabel = PAYMENT_MODELS.find(p => p.value === form.paymentModel)?.label ?? "";
  const priceHint = ({
    monthly: "EGP per month",
    per_lesson: "EGP per lesson",
    full_course: "EGP total (one-time)",
    installments: "EGP per instalment (×2)",
  } as Record<string, string>)[form.paymentModel] ?? "EGP";

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        title: form.title,
        description: form.description || null,
        subject: form.subject || null,
        priceEgp: form.priceEgp ? parseFloat(form.priceEgp) : null,
        thumbnailUrl: form.thumbnailUrl || null,
        durationWeeks: parseInt(form.durationWeeks) || 8,
        isPublished: form.isPublished,
        deliveryType: form.deliveryType,
        paymentModel: form.paymentModel,
        recordingsIncluded: form.recordingsIncluded,
        materialsFeeEgp: form.materialsFeeEgp ? parseFloat(form.materialsFeeEgp) : null,
      };
      const res = await authFetch(course ? `/courses/${course.id}` : "/courses", {
        method: course ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data.code === "LIMIT_EXCEEDED") {
        onLimitExceeded?.(data.error);
        return null;
      }
      if (!res.ok) throw new Error(data.error || "Failed to save");
      return data;
    },
    onSuccess: (data) => {
      if (!data) return;
      qc.invalidateQueries({ queryKey: ["teacher-courses"] });
      toast({ title: course ? "Course updated" : "Course created" });
      onClose();
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="space-y-4 mt-2 max-h-[75vh] overflow-y-auto pr-1">
      {/* Title */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-700">Course Title *</Label>
        <Input
          required
          value={form.title}
          onChange={e => f("title", e.target.value)}
          placeholder="e.g. IGCSE Physics Intensive"
          className="h-10 rounded-xl"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-700">Description</Label>
        <Textarea
          rows={3}
          value={form.description}
          onChange={e => f("description", e.target.value)}
          placeholder="What will students learn in this course?"
          className="rounded-xl resize-none text-sm"
        />
      </div>

      {/* Subject from API */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-gray-700">Subject</Label>
          <select
            value={form.subject}
            onChange={e => f("subject", e.target.value)}
            className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Select subject…</option>
            {subjectOptions.length > 0
              ? subjectOptions.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)
              : ["Physics", "Mathematics", "Chemistry", "Biology", "English", "Economics", "Computer Science", "Other"].map(s => <option key={s} value={s}>{s}</option>)
            }
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-gray-700">Delivery Type</Label>
          <div className="flex rounded-xl border border-input overflow-hidden h-10">
            {DELIVERY_TYPES.map(dt => (
              <button
                key={dt}
                type="button"
                onClick={() => f("deliveryType", dt)}
                className={`flex-1 text-xs font-semibold transition-colors ${form.deliveryType === dt ? "bg-[#0D9488] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                {dt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Model */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-700">Payment Model</Label>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_MODELS.map(pm => (
            <button
              key={pm.value}
              type="button"
              onClick={() => f("paymentModel", pm.value)}
              className={`text-xs text-left px-3 py-2 rounded-xl border transition-all font-medium ${form.paymentModel === pm.value ? "border-[#0D9488] bg-[#E0F2F1] text-[#0D9488]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
            >
              {pm.label}
            </button>
          ))}
        </div>
      </div>

      {/* Price */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-gray-700">Price ({priceHint})</Label>
          <Input
            type="number"
            min={0}
            value={form.priceEgp}
            onChange={e => f("priceEgp", e.target.value)}
            placeholder="e.g. 299"
            className="h-10 rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-gray-700">Materials Fee (EGP, optional)</Label>
          <Input
            type="number"
            min={0}
            value={form.materialsFeeEgp}
            onChange={e => f("materialsFeeEgp", e.target.value)}
            placeholder="Separate charge for printed materials"
            className="h-10 rounded-xl"
          />
        </div>
      </div>

      {/* Package inclusions */}
      <div className="bg-gray-50 rounded-xl p-3 space-y-2.5">
        <p className="text-xs font-bold text-gray-600">Package Inclusions</p>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-gray-700">Recordings included for absent students</span>
          <button
            type="button"
            onClick={() => f("recordingsIncluded", !form.recordingsIncluded)}
            className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${form.recordingsIncluded ? "bg-[#0D9488]" : "bg-gray-200"}`}
          >
            <span
              className="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform"
              style={{ transform: form.recordingsIncluded ? "translateX(20px)" : "translateX(2px)" }}
            />
          </button>
        </label>
      </div>

      {/* Thumbnail + Duration */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-700">Thumbnail URL</Label>
        <div className="flex gap-2 items-start">
          <Input
            value={form.thumbnailUrl}
            onChange={e => f("thumbnailUrl", e.target.value)}
            placeholder="https://… (optional)"
            className="h-10 rounded-xl flex-1"
          />
          {form.thumbnailUrl && (
            <div className="h-10 w-14 rounded-xl overflow-hidden border border-gray-200 shrink-0">
              <img src={form.thumbnailUrl} alt="" className="h-full w-full object-cover" onError={e => (e.currentTarget.style.display = "none")} />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-700">Duration (weeks)</Label>
        <Input
          type="number"
          min={1}
          max={104}
          value={form.durationWeeks}
          onChange={e => f("durationWeeks", e.target.value)}
          className="h-10 rounded-xl"
        />
      </div>

      {/* Publish toggle */}
      <label className="flex items-center gap-2.5 cursor-pointer py-1">
        <button
          type="button"
          onClick={() => f("isPublished", !form.isPublished)}
          className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${form.isPublished ? "bg-[#0D9488]" : "bg-gray-200"}`}
        >
          <span
            className="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform"
            style={{ transform: form.isPublished ? "translateX(20px)" : "translateX(2px)" }}
          />
        </button>
        <span className="text-sm text-gray-700 select-none">
          {form.isPublished ? "Published — visible in marketplace" : "Draft — hidden from students"}
        </span>
      </label>

      <Button
        type="submit"
        className="w-full h-10 rounded-xl font-semibold text-white"
        style={{ background: TEAL }}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? "Saving…" : course ? "Save Changes" : "Create Course"}
      </Button>
    </form>
  );
}

/* ── Enrollment request row ──────────────────────────────────────────────── */
function EnrollmentRow({ e, onAction }: {
  e: Enrollment;
  onAction: (id: number, status: string) => void;
}) {
  const initials = (e.student_name || e.student_username).slice(0, 2).toUpperCase();
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border border-gray-100 shadow-sm">
        <CardContent className="p-4 flex items-center gap-4">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
            style={{ background: TEAL }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900">
              {e.student_name || e.student_username}
            </p>
            <p className="text-xs text-gray-400 truncate">→ {e.course_title}</p>
            {e.student_email && (
              <p className="text-xs text-gray-300 truncate">{e.student_email}</p>
            )}
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <Clock className="h-3 w-3" />
              {new Date(e.requested_at).toLocaleDateString("en-GB", {
                day: "numeric", month: "short", year: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {e.status === "pending" ? (
              <>
                <Button
                  size="sm"
                  className="h-7 px-3 rounded-lg gap-1 text-xs text-white"
                  style={{ background: TEAL }}
                  onClick={() => onAction(e.id, "approved")}
                >
                  <CheckCircle2 className="h-3 w-3" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-3 rounded-lg gap-1 text-xs text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => onAction(e.id, "rejected")}
                >
                  <XCircle className="h-3 w-3" /> Reject
                </Button>
              </>
            ) : (
              <Badge
                className={`text-[10px] rounded-full px-2 ${
                  e.status === "approved"
                    ? "bg-[#E0F2F1] text-[#0D9488]"
                    : "bg-red-50 text-red-600"
                }`}
                variant="outline"
              >
                {e.status}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function MyCourses() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Course | null>(null);
  const [studentsFor, setStudentsFor] = useState<Course | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("courses");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState<string | undefined>(undefined);
  const handleLimitExceeded = (msg: string) => { setUpgradeMsg(msg); setUpgradeOpen(true); };

  /* ── queries ── */
  const { data: courses = [], isLoading: coursesLoading } = useQuery<Course[]>({
    queryKey: ["teacher-courses"],
    queryFn: () => authFetch("/courses/teacher/my").then(r => r.json()),
    refetchInterval: 30_000,
  });

  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery<Enrollment[]>({
    queryKey: ["teacher-enrollments"],
    queryFn: () => authFetch("/courses/teacher/enrollments").then(r => r.json()),
    refetchInterval: 20_000,
  });

  /* ── mutations ── */
  const deleteMutation = useMutation({
    mutationFn: (id: number) => authFetch(`/courses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-courses"] });
      toast({ title: "Course deleted" });
      setDeleteTarget(null);
    },
  });

  const togglePublish = useMutation({
    mutationFn: (c: Course) =>
      authFetch(`/courses/${c.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: c.title,
          description: c.description,
          subject: c.subject,
          priceEgp: c.price_egp ? parseFloat(c.price_egp) : null,
          thumbnailUrl: c.thumbnail_url,
          durationWeeks: c.duration_weeks,
          isPublished: !c.is_published,
        }),
      }),
    onSuccess: (_, c) => {
      qc.invalidateQueries({ queryKey: ["teacher-courses"] });
      toast({ title: c.is_published ? "Course unpublished" : "Course published" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, restore }: { id: number; restore?: boolean }) =>
      authFetch(`/courses/${id}/${restore ? "unarchive" : "archive"}`, { method: "PATCH" }),
    onSuccess: (_, { restore }) => {
      qc.invalidateQueries({ queryKey: ["teacher-courses"] });
      toast({ title: restore ? "Course restored" : "Course archived", description: restore ? "The course is now active again." : "The course has been archived and hidden from students." });
      setArchiveTarget(null);
    },
    onError: () => toast({ title: "Action failed", variant: "destructive" }),
  });

  const enrollMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      authFetch(`/courses/enrollments/${id}`, { method: "PUT", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-enrollments"] });
      qc.invalidateQueries({ queryKey: ["teacher-courses"] });
      toast({ title: "Enrollment updated" });
    },
  });

  /* ── derived data ── */
  const pending = useMemo(() => enrollments.filter(e => e.status === "pending"), [enrollments]);
  const filteredCourses = useMemo(() => {
    const q = search.toLowerCase();
    return q
      ? courses.filter(c =>
          c.title.toLowerCase().includes(q) ||
          (c.subject?.toLowerCase().includes(q) ?? false)
        )
      : courses;
  }, [courses, search]);

  const totalEnrolled = courses.reduce((s, c) => s + (parseInt(c.approved_count) || 0), 0);
  const published = courses.filter(c => c.is_published).length;

  /* ── course students sheet ── */
  const courseStudents = useMemo(
    () => studentsFor
      ? enrollments.filter(e => e.course_id === studentsFor.id && e.status === "approved")
      : [],
    [enrollments, studentsFor]
  );

  const openEdit = (c: Course) => { setEditing(c); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <BookOpen className="h-6 w-6" style={{ color: TEAL }} /> My Courses
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Create, manage and publish your courses to the student marketplace.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button
              className="gap-2 rounded-xl text-white shrink-0"
              style={{ background: TEAL }}
              onClick={() => { setEditing(null); setDialogOpen(true); }}
            >
              <Plus className="h-4 w-4" /> New Course
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Course" : "Create New Course"}</DialogTitle>
            </DialogHeader>
            <CourseForm course={editing} onClose={closeDialog} onLimitExceeded={handleLimitExceeded} />
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Plan usage bar ── */}
      <PlanUsageBar resource="courses" label="Course Slots" />

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Courses", value: courses.length, icon: BookOpen },
          { label: "Published", value: published, icon: Globe },
          { label: "Students Enrolled", value: totalEnrolled, icon: GraduationCap },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border border-gray-100 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: TEAL_LIGHT }}>
                <Icon className="h-4.5 w-4.5" style={{ color: TEAL }} />
              </div>
              <div>
                <p className="text-xl font-black text-gray-900">{value}</p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tabs ── */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList className="bg-gray-100 rounded-xl p-1">
            <TabsTrigger value="courses" className="rounded-lg text-xs">
              Courses ({courses.length})
            </TabsTrigger>
            <TabsTrigger value="enrollments" className="rounded-lg text-xs relative">
              Requests
              {pending.length > 0 && (
                <Badge
                  className="ml-1.5 text-white text-[10px] px-1.5 py-0 rounded-full h-4 min-w-4"
                  style={{ background: TEAL }}
                >
                  {pending.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {tab === "courses" && (
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search courses…"
                className="h-8 pl-8 rounded-xl text-xs"
              />
            </div>
          )}
        </div>

        {/* ── COURSES TAB ── */}
        <TabsContent value="courses" className="mt-4">
          {coursesLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-2xl" />
              ))}
            </div>
          ) : filteredCourses.length === 0 ? (
            <Card className="border-dashed border-2 border-gray-200">
              <CardContent className="p-12 text-center text-gray-400">
                <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-semibold">
                  {search ? "No courses match your search" : "No courses yet"}
                </p>
                {!search && (
                  <p className="text-sm mt-1">
                    Create your first course and publish it to start enrolling students.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {filteredCourses.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Card className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-0 flex overflow-hidden rounded-2xl">
                        {/* Thumbnail */}
                        <div
                          className="w-28 h-24 shrink-0 flex items-center justify-center"
                          style={{
                            background: c.thumbnail_url ? undefined : TEAL_LIGHT,
                          }}
                        >
                          {c.thumbnail_url ? (
                            <img
                              src={c.thumbnail_url}
                              alt={c.title}
                              className="w-full h-full object-cover"
                              onError={e => {
                                e.currentTarget.style.display = "none";
                                e.currentTarget.parentElement!.style.background = TEAL_LIGHT;
                              }}
                            />
                          ) : (
                            <ImageIcon className="h-6 w-6" style={{ color: TEAL, opacity: 0.4 }} />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 p-4 min-w-0 flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="font-bold text-sm text-gray-900 truncate">{c.title}</p>
                              <Badge
                                className={`text-[10px] px-2 rounded-full shrink-0 ${
                                  c.is_published
                                    ? "bg-[#E0F2F1] text-[#0D9488]"
                                    : "bg-gray-100 text-gray-500"
                                }`}
                                variant="outline"
                              >
                                {c.is_published ? "Published" : "Draft"}
                              </Badge>
                              <QualityScoreBadge courseId={c.id} />
                              <CourseHealthBadge courseId={c.id} showLabel />
                              <CourseCoverageBadge courseId={c.id} />
                            </div>
                            <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400">
                              {c.subject && <span className="font-medium text-gray-600">{c.subject}</span>}
                              {c.price_egp && <span>{parseFloat(c.price_egp).toLocaleString()} EGP/mo</span>}
                              <span>{c.duration_weeks}w</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 text-xs">
                              <button
                                onClick={() => setStudentsFor(c)}
                                className="flex items-center gap-1 text-gray-500 hover:text-[#0D9488] transition-colors"
                              >
                                <Users className="h-3 w-3" />
                                <span className="font-semibold">{c.approved_count}</span> enrolled
                                <ChevronRight className="h-2.5 w-2.5" />
                              </button>
                              {parseInt(c.pending_count) > 0 && (
                                <button
                                  onClick={() => setTab("enrollments")}
                                  className="flex items-center gap-1 font-semibold text-amber-600 hover:text-amber-700 transition-colors"
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  {c.pending_count} pending
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-gray-700 rounded-lg"
                              title={c.is_published ? "Unpublish" : "Publish"}
                              onClick={() => togglePublish.mutate(c)}
                              disabled={togglePublish.isPending}
                            >
                              {c.is_published
                                ? <EyeOff className="h-3.5 w-3.5" />
                                : <Eye className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-gray-700 rounded-lg"
                              onClick={() => openEdit(c)}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            {c.is_archived ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg"
                                    onClick={() => archiveMutation.mutate({ id: c.id, restore: true })}
                                    disabled={archiveMutation.isPending}
                                  >
                                    <ArchiveRestore className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">Restore course</TooltipContent>
                              </Tooltip>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                                    onClick={() => setArchiveTarget(c)}
                                  >
                                    <Archive className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">Archive course</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-gray-400 hover:text-red-500 rounded-lg"
                                  onClick={() => setDeleteTarget(c)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">Delete course</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        {/* ── ENROLLMENTS TAB ── */}
        <TabsContent value="enrollments" className="mt-4">
          {enrollmentsLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
            </div>
          ) : enrollments.length === 0 ? (
            <Card className="border-dashed border-2 border-gray-200">
              <CardContent className="p-12 text-center text-gray-400">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-semibold">No enrollment requests yet</p>
                <p className="text-sm mt-1">When students request to join your courses, they'll appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {pending.length > 0 && (
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 mb-3">
                  Pending ({pending.length})
                </p>
              )}
              {pending.map(e => (
                <EnrollmentRow key={e.id} e={e} onAction={(id, status) => enrollMutation.mutate({ id, status })} />
              ))}

              {enrollments.filter(e => e.status !== "pending").length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mt-5 mb-3">
                    Reviewed
                  </p>
                  {enrollments
                    .filter(e => e.status !== "pending")
                    .map(e => (
                      <EnrollmentRow key={e.id} e={e} onAction={(id, status) => enrollMutation.mutate({ id, status })} />
                    ))}
                </>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Delete confirm ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the course and all its enrollment data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete Course
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Archive confirm ── */}
      <AlertDialog open={!!archiveTarget} onOpenChange={v => !v && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive "{archiveTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The course will be hidden from students and unpublished. You can restore it at any time. No data is deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => archiveTarget && archiveMutation.mutate({ id: archiveTarget.id })}
            >
              Archive Course
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Enrolled students sheet ── */}
      <Sheet open={!!studentsFor} onOpenChange={v => !v && setStudentsFor(null)}>
        <SheetContent side="right" className="w-80">
          <SheetHeader>
            <SheetTitle className="text-base leading-tight">{studentsFor?.title}</SheetTitle>
            <p className="text-xs text-muted-foreground">Enrolled students</p>
          </SheetHeader>
          <div className="mt-4 space-y-2 overflow-y-auto">
            {courseStudents.length === 0 ? (
              <div className="text-center text-gray-400 py-10">
                <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No enrolled students yet</p>
              </div>
            ) : (
              courseStudents.map(e => (
                <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
                    style={{ background: TEAL }}
                  >
                    {(e.student_name || e.student_username).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {e.student_name || e.student_username}
                    </p>
                    {e.student_email && (
                      <p className="text-xs text-gray-400 truncate">{e.student_email}</p>
                    )}
                    <p className="text-[10px] text-gray-300">
                      Enrolled {new Date(e.requested_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          {courseStudents.length > 0 && (
            <div className="mt-4 p-3 rounded-xl flex items-center gap-2" style={{ background: TEAL_LIGHT }}>
              <TrendingUp className="h-4 w-4 shrink-0" style={{ color: TEAL }} />
              <p className="text-xs font-semibold" style={{ color: TEAL }}>
                {courseStudents.length} student{courseStudents.length !== 1 ? "s" : ""} enrolled
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        resource="courses"
        message={upgradeMsg}
      />
    </div>
  );
}
