import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  CalendarDays, Plus, Pencil, Trash2, Clock, MapPin, Wifi,
  BookOpen, AlertTriangle, CheckCircle, ShieldAlert, ChevronRight,
} from "lucide-react";
import { AppEmptyState } from "@/components/app-empty-state";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MODES = ["online", "in-person", "hybrid"] as const;

type Subject = { id: number; name: string; code?: string };
type Lesson = {
  id: number; lessonNumber: number; dayOfWeek: string; startTime: string;
  mode: string; subjectId?: number | null; capacity?: number | null; onlineLink?: string | null;
};
type SessionSlot = {
  id: number; lessonId: number; slotLabel: string; dayOfWeek: string;
  startTime: string; endTime?: string; roomOrLink?: string;
  mode: string; capacity?: number; isActive: boolean; sortOrder: number;
};

function timeToMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
function overlaps(
  a: { startTime: string; endTime?: string | null },
  b: { startTime: string; endTime?: string | null },
) {
  const aS = timeToMins(a.startTime), bS = timeToMins(b.startTime);
  const aE = a.endTime ? timeToMins(a.endTime) : aS + 60;
  const bE = b.endTime ? timeToMins(b.endTime) : bS + 60;
  return aS < bE && bS < aE;
}

function LessonForm({
  subjects,
  initial,
  onSave,
  onClose,
}: {
  subjects: Subject[];
  initial?: Partial<Lesson>;
  onSave: (data: Partial<Lesson>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    lessonNumber: initial?.lessonNumber ? String(initial.lessonNumber) : "",
    dayOfWeek: initial?.dayOfWeek ?? "Monday",
    startTime: initial?.startTime ?? "09:00",
    mode: initial?.mode ?? "online",
    subjectId: initial?.subjectId ? String(initial.subjectId) : "",
    capacity: initial?.capacity ? String(initial.capacity) : "",
    onlineLink: initial?.onlineLink ?? "",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.lessonNumber || !form.dayOfWeek || !form.startTime) return;
    onSave({
      lessonNumber: parseInt(form.lessonNumber),
      dayOfWeek: form.dayOfWeek,
      startTime: form.startTime,
      mode: form.mode,
      subjectId: form.subjectId ? parseInt(form.subjectId) : undefined,
      capacity: form.capacity ? parseInt(form.capacity) : undefined,
      onlineLink: form.onlineLink || undefined,
    });
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Lesson Number <span className="text-destructive">*</span></Label>
          <Input
            type="number"
            min={1}
            value={form.lessonNumber}
            onChange={e => set("lessonNumber", e.target.value)}
            placeholder="e.g. 1"
            className="mt-1"
          />
        </div>
        <div>
          <Label>Day <span className="text-destructive">*</span></Label>
          <Select value={form.dayOfWeek} onValueChange={v => set("dayOfWeek", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Start Time <span className="text-destructive">*</span></Label>
          <Input type="time" value={form.startTime} onChange={e => set("startTime", e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Mode</Label>
          <Select value={form.mode} onValueChange={v => set("mode", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="in-person">In-person</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {subjects.length > 0 && (
        <div>
          <Label>Subject (optional)</Label>
          <Select value={form.subjectId} onValueChange={v => set("subjectId", v)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="No subject selected" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {subjects.map(s => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}{s.code ? ` (${s.code})` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Capacity</Label>
          <Input
            type="number"
            min={1}
            value={form.capacity}
            onChange={e => set("capacity", e.target.value)}
            placeholder="e.g. 20"
            className="mt-1"
          />
        </div>
        <div>
          <Label>Online Link</Label>
          <Input
            value={form.onlineLink}
            onChange={e => set("onlineLink", e.target.value)}
            placeholder="https://meet.google.com/…"
            className="mt-1"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          className="flex-1"
          onClick={handleSave}
          disabled={!form.lessonNumber || !form.dayOfWeek || !form.startTime}
        >
          {initial?.id ? "Save Changes" : "Create Lesson"}
        </Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

function SlotForm({
  lessons,
  initial,
  onSave,
  onClose,
  existingSlots = [],
  excludeId,
}: {
  lessons: Lesson[];
  initial?: Partial<SessionSlot>;
  onSave: (data: Partial<SessionSlot>) => void;
  onClose: () => void;
  existingSlots?: SessionSlot[];
  excludeId?: number;
}) {
  const [form, setForm] = useState({
    lessonId: initial?.lessonId ? String(initial.lessonId) : "",
    slotLabel: initial?.slotLabel ?? "",
    dayOfWeek: initial?.dayOfWeek ?? "Monday",
    startTime: initial?.startTime ?? "09:00",
    endTime: initial?.endTime ?? "",
    roomOrLink: initial?.roomOrLink ?? "",
    mode: initial?.mode ?? "in-person",
    capacity: initial?.capacity ? String(initial.capacity) : "",
    sortOrder: initial?.sortOrder ? String(initial.sortOrder) : "0",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const conflictWarnings = useMemo(() => {
    if (!form.startTime || !form.dayOfWeek) return [];
    const proposed = { startTime: form.startTime, endTime: form.endTime || null };
    const lessonId = parseInt(form.lessonId) || 0;
    const warnings: string[] = [];
    existingSlots
      .filter(s => s.isActive && s.id !== excludeId)
      .forEach(s => {
        if (s.dayOfWeek !== form.dayOfWeek) return;
        if (!overlaps(proposed, s)) return;
        if (s.lessonId === lessonId) {
          warnings.push(`Overlaps with "${s.slotLabel}" (${s.dayOfWeek} ${s.startTime})`);
        } else if (form.roomOrLink && s.roomOrLink === form.roomOrLink && form.mode !== "online") {
          warnings.push(`Room "${s.roomOrLink}" already in use on ${s.dayOfWeek} at ${s.startTime}`);
        }
      });
    return warnings;
  }, [form.dayOfWeek, form.startTime, form.endTime, form.lessonId, form.roomOrLink, form.mode, existingSlots, excludeId]);

  const handleSave = () => {
    if (!form.lessonId || !form.slotLabel || !form.dayOfWeek || !form.startTime) return;
    onSave({
      lessonId: parseInt(form.lessonId),
      slotLabel: form.slotLabel,
      dayOfWeek: form.dayOfWeek,
      startTime: form.startTime,
      endTime: form.endTime || undefined,
      roomOrLink: form.roomOrLink || undefined,
      mode: form.mode,
      capacity: form.capacity ? parseInt(form.capacity) : undefined,
      sortOrder: parseInt(form.sortOrder) || 0,
    });
  };

  return (
    <div className="space-y-4 pt-2">
      {conflictWarnings.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-800 mb-1">Scheduling conflict detected</p>
            {conflictWarnings.map((w, i) => <p key={i} className="text-xs text-amber-700">{w}</p>)}
          </div>
        </div>
      )}

      <div>
        <Label>Lesson <span className="text-destructive">*</span></Label>
        <Select value={form.lessonId} onValueChange={v => set("lessonId", v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Select a lesson…" /></SelectTrigger>
          <SelectContent>
            {lessons.map(l => (
              <SelectItem key={l.id} value={String(l.id)}>
                Lesson {l.lessonNumber} — {l.dayOfWeek} {l.startTime}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Slot Label <span className="text-destructive">*</span></Label>
        <Input
          value={form.slotLabel}
          onChange={e => set("slotLabel", e.target.value)}
          placeholder="e.g. Slot A – 9am Monday"
          className="mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Day <span className="text-destructive">*</span></Label>
          <Select value={form.dayOfWeek} onValueChange={v => set("dayOfWeek", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Mode</Label>
          <Select value={form.mode} onValueChange={v => set("mode", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="in-person">In-person</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Start Time <span className="text-destructive">*</span></Label>
          <Input type="time" value={form.startTime} onChange={e => set("startTime", e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>End Time</Label>
          <Input type="time" value={form.endTime} onChange={e => set("endTime", e.target.value)} className="mt-1" />
        </div>
      </div>

      <div>
        <Label>Room / Online Link</Label>
        <Input
          value={form.roomOrLink}
          onChange={e => set("roomOrLink", e.target.value)}
          placeholder="Room 3A or https://meet.google.com/…"
          className="mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Capacity</Label>
          <Input type="number" value={form.capacity} onChange={e => set("capacity", e.target.value)} placeholder="e.g. 20" className="mt-1" />
        </div>
        <div>
          <Label>Sort Order</Label>
          <Input type="number" value={form.sortOrder} onChange={e => set("sortOrder", e.target.value)} className="mt-1" />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          className="flex-1"
          onClick={handleSave}
          disabled={!form.lessonId || !form.slotLabel}
          variant={conflictWarnings.length > 0 ? "outline" : "default"}
        >
          {conflictWarnings.length > 0 ? "Save Anyway (conflicts exist)" : (initial?.id ? "Save Changes" : "Create Slot")}
        </Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

type TabType = "lessons" | "slots";

export default function TeacherSchedulePage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [tab, setTab] = useState<TabType>("lessons");
  const [createLessonOpen, setCreateLessonOpen] = useState(false);
  const [editLesson, setEditLesson] = useState<Lesson | null>(null);
  const [createSlotOpen, setCreateSlotOpen] = useState(false);
  const [editSlot, setEditSlot] = useState<SessionSlot | null>(null);

  const { data: lessons = [], isLoading: lessonsLoading } = useQuery<Lesson[]>({
    queryKey: ["teacher-lessons"],
    queryFn: () => apiFetch("/api/lessons").then(r => r.json()),
  });

  const { data: slots = [], isLoading: slotsLoading } = useQuery<SessionSlot[]>({
    queryKey: ["session-slots"],
    queryFn: () => apiFetch("/api/session-slots").then(r => r.json()),
  });

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["subjects"],
    queryFn: () => apiFetch("/api/subjects").then(r => r.json()),
  });

  const createLesson = useMutation({
    mutationFn: (data: Partial<Lesson>) =>
      apiFetch("/api/lessons", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-lessons"] });
      setCreateLessonOpen(false);
      toast({ title: "Lesson created" });
    },
    onError: () => toast({ title: "Failed to create lesson", variant: "destructive" }),
  });

  const updateLesson = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Lesson> }) =>
      apiFetch(`/api/lessons/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-lessons"] });
      setEditLesson(null);
      toast({ title: "Lesson updated" });
    },
    onError: () => toast({ title: "Failed to update lesson", variant: "destructive" }),
  });

  const deleteLesson = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/lessons/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teacher-lessons"] });
      toast({ title: "Lesson deleted" });
    },
    onError: () => toast({ title: "Failed to delete lesson", variant: "destructive" }),
  });

  const createSlot = useMutation({
    mutationFn: (data: Partial<SessionSlot>) =>
      apiFetch("/api/session-slots", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-slots"] });
      setCreateSlotOpen(false);
      toast({ title: "Session slot created" });
    },
    onError: () => toast({ title: "Failed to create slot", variant: "destructive" }),
  });

  const updateSlot = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SessionSlot> }) =>
      apiFetch(`/api/session-slots/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-slots"] });
      setEditSlot(null);
      toast({ title: "Slot updated" });
    },
    onError: () => toast({ title: "Failed to update slot", variant: "destructive" }),
  });

  const deleteSlot = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/session-slots/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-slots"] });
      toast({ title: "Slot removed" });
    },
    onError: () => toast({ title: "Failed to remove slot", variant: "destructive" }),
  });

  const toggleSlotActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiFetch(`/api/session-slots/${id}`, { method: "PUT", body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["session-slots"] }),
  });

  const sortedLessons = [...lessons].sort((a, b) => a.lessonNumber - b.lessonNumber);
  const activeSlots = slots.filter(s => s.isActive);

  const getSubjectName = (id?: number | null) => {
    if (!id) return null;
    return subjects.find(s => s.id === id)?.name ?? null;
  };

  const getLessonLabel = (lessonId: number) => {
    const l = lessons.find(l => l.id === lessonId);
    return l ? `Lesson ${l.lessonNumber} — ${l.dayOfWeek} ${l.startTime}` : `Lesson ${lessonId}`;
  };

  const slotsByLesson = useMemo(() => {
    const map: Record<number, SessionSlot[]> = {};
    for (const s of slots) {
      if (!map[s.lessonId]) map[s.lessonId] = [];
      map[s.lessonId].push(s);
    }
    return map;
  }, [slots]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="text-primary" size={24} />
            My Schedule
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your lessons and the time slots within each lesson
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100 w-fit">
        {(["lessons", "slots"] as TabType[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-all capitalize ${
              tab === t ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-card"
            }`}
          >
            {t === "lessons" ? <BookOpen size={15} /> : <Clock size={15} />}
            {t === "lessons" ? "Lessons" : "Session Slots"}
            {t === "lessons" && lessons.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${tab === t ? "bg-primary text-white" : "bg-slate-200 text-slate-600"}`}>
                {lessons.length}
              </span>
            )}
            {t === "slots" && activeSlots.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${tab === t ? "bg-primary text-white" : "bg-slate-200 text-slate-600"}`}>
                {activeSlots.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {tab === "lessons" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                {lessonsLoading ? "Loading…" : `${lessons.length} lesson${lessons.length === 1 ? "" : "s"} configured`}
              </p>
              <Dialog open={createLessonOpen} onOpenChange={setCreateLessonOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-primary hover:bg-primary/80">
                    <Plus size={16} />
                    New Lesson
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create Lesson</DialogTitle></DialogHeader>
                  <LessonForm
                    subjects={subjects}
                    onSave={d => createLesson.mutate(d)}
                    onClose={() => setCreateLessonOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>

            {lessonsLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
              </div>
            ) : sortedLessons.length === 0 ? (
              <AppEmptyState
                type="sessions"
                title="No lessons yet"
                description="Create your first lesson to define when your class meets. You can then add time slots to each lesson."
                size="lg"
                actions={[{ label: "Create Your First Lesson", primary: true, icon: Plus, onClick: () => setCreateLessonOpen(true) }]}
              />
            ) : (
              <div className="space-y-3">
                {sortedLessons.map(lesson => {
                  const slotCount = (slotsByLesson[lesson.id] ?? []).filter(s => s.isActive).length;
                  const subjectName = getSubjectName(lesson.subjectId);
                  return (
                    <motion.div
                      key={lesson.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <Card className="border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                                <span className="text-primary font-bold text-sm">{lesson.lessonNumber}</span>
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-slate-800">Lesson {lesson.lessonNumber}</span>
                                  <Badge variant="outline" className="text-xs">{lesson.dayOfWeek}</Badge>
                                  <span className="text-sm text-slate-500 flex items-center gap-1">
                                    <Clock size={12} />
                                    {lesson.startTime}
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className={`text-xs capitalize ${
                                      lesson.mode === "online" ? "bg-blue-50 text-blue-700"
                                      : lesson.mode === "in-person" ? "bg-green-50 text-green-700"
                                      : "bg-violet-50 text-violet-700"
                                    }`}
                                  >
                                    {lesson.mode === "online" ? <Wifi size={10} className="mr-1" /> : <MapPin size={10} className="mr-1" />}
                                    {lesson.mode}
                                  </Badge>
                                  {subjectName && (
                                    <span className="text-xs text-slate-400">{subjectName}</span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {slotCount} active slot{slotCount === 1 ? "" : "s"}
                                  {lesson.capacity ? ` · capacity ${lesson.capacity}` : ""}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-slate-500 gap-1 hover:text-primary"
                                onClick={() => { setTab("slots"); setCreateSlotOpen(true); }}
                              >
                                <Plus size={12} />
                                Add slot
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setEditLesson(lesson)}
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (confirm(`Delete Lesson ${lesson.lessonNumber}? All associated slots will also be removed.`))
                                    deleteLesson.mutate(lesson.id);
                                }}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}

                <button
                  onClick={() => setTab("slots")}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-primary/25 text-sm text-primary hover:bg-primary/8 transition-colors"
                >
                  Manage session slots
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "slots" && (
          <div className="space-y-4">
            {lessons.length === 0 ? (
              <Card className="border border-amber-100 bg-amber-50 shadow-sm">
                <CardContent className="p-8 text-center">
                  <AlertTriangle className="text-amber-500 mx-auto mb-3" size={32} />
                  <h3 className="font-semibold text-amber-800 mb-1">Create a lesson first</h3>
                  <p className="text-sm text-amber-700 mb-4">
                    Session slots must be linked to a lesson. Set up at least one lesson before adding slots.
                  </p>
                  <Button
                    variant="outline"
                    className="border-amber-300 text-amber-800 hover:bg-amber-100"
                    onClick={() => setTab("lessons")}
                  >
                    <BookOpen size={14} className="mr-2" />
                    Go to Lessons
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    {slotsLoading ? "Loading…" : `${activeSlots.length} active slot${activeSlots.length === 1 ? "" : "s"}`}
                  </p>
                  <Dialog open={createSlotOpen} onOpenChange={setCreateSlotOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2 bg-primary hover:bg-primary/80">
                        <Plus size={16} />
                        New Slot
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Create Session Slot</DialogTitle></DialogHeader>
                      <SlotForm
                        lessons={sortedLessons}
                        existingSlots={slots}
                        onSave={d => createSlot.mutate(d)}
                        onClose={() => setCreateSlotOpen(false)}
                      />
                    </DialogContent>
                  </Dialog>
                </div>

                {slotsLoading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
                  </div>
                ) : slots.length === 0 ? (
                  <AppEmptyState
                    type="sessions"
                    title="No session slots yet"
                    description="Add time slots to your lessons to define when students can attend."
                    size="md"
                    actions={[{ label: "Create First Slot", primary: true, icon: Plus, onClick: () => setCreateSlotOpen(true) }]}
                  />
                ) : (
                  <div className="space-y-3">
                    {sortedLessons.map(lesson => {
                      const lessonSlots = slotsByLesson[lesson.id] ?? [];
                      if (lessonSlots.length === 0) return null;
                      return (
                        <Card key={lesson.id} className="border border-slate-100 shadow-sm">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                              <CalendarDays size={14} className="text-primary" />
                              Lesson {lesson.lessonNumber}
                              <span className="text-slate-400 font-normal">— {lesson.dayOfWeek} {lesson.startTime}</span>
                              <Badge variant="secondary" className="text-[10px] ml-auto">{lessonSlots.length}</Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {lessonSlots.map(slot => (
                              <div key={slot.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-slate-800 truncate">{slot.slotLabel}</p>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                                      <Clock size={10} />
                                      {slot.startTime}{slot.endTime ? `–${slot.endTime}` : ""}
                                    </span>
                                    {slot.roomOrLink && (
                                      <span className="flex items-center gap-0.5 text-[10px] text-slate-500 truncate max-w-28">
                                        {slot.mode === "online" ? <Wifi size={10} /> : <MapPin size={10} />}
                                        {slot.roomOrLink}
                                      </span>
                                    )}
                                    {!slot.isActive && <Badge variant="outline" className="text-[9px] h-3.5 text-slate-400">inactive</Badge>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Switch
                                    checked={slot.isActive}
                                    onCheckedChange={v => toggleSlotActive.mutate({ id: slot.id, isActive: v })}
                                    className="scale-75"
                                  />
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditSlot(slot)}>
                                    <Pencil size={13} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => deleteSlot.mutate(slot.id)}
                                  >
                                    <Trash2 size={13} />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      );
                    })}

                    {slots.length > 0 && slots.every(s => !slotsByLesson[s.lessonId] || sortedLessons.every(l => !slotsByLesson[l.id])) && (
                      <p className="text-xs text-slate-400 text-center py-2">All slots shown above</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </motion.div>

      {editLesson && (
        <Dialog open={!!editLesson} onOpenChange={v => { if (!v) setEditLesson(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Lesson {editLesson.lessonNumber}</DialogTitle></DialogHeader>
            <LessonForm
              subjects={subjects}
              initial={editLesson}
              onSave={d => updateLesson.mutate({ id: editLesson.id, data: d })}
              onClose={() => setEditLesson(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {editSlot && (
        <Dialog open={!!editSlot} onOpenChange={v => { if (!v) setEditSlot(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Slot</DialogTitle></DialogHeader>
            <SlotForm
              lessons={sortedLessons}
              initial={editSlot}
              existingSlots={slots}
              excludeId={editSlot.id}
              onSave={d => updateSlot.mutate({ id: editSlot.id, data: d })}
              onClose={() => setEditSlot(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
