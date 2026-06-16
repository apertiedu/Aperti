import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppEmptyState } from "@/components/app-empty-state";
import {
  Plus, Pencil, Trash2, Clock, MapPin, Monitor, Users, CalendarDays, List,
  AlertTriangle, Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const API = "/api";

async function fetchJSON(url: string, opts?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts?.headers as any) },
    ...opts,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MODES = ["online", "centre", "hybrid"];
const HOURS = Array.from({ length: 14 }, (_, i) => `${(i + 7).toString().padStart(2, "0")}:00`);

const MODE_COLORS: Record<string, string> = {
  online: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
  centre: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  hybrid: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800",
};

const MODE_ICONS: Record<string, React.ReactNode> = {
  online: <Monitor className="h-3 w-3" />,
  centre: <MapPin className="h-3 w-3" />,
  hybrid: <Users className="h-3 w-3" />,
};

interface Lesson {
  id: number;
  lessonNumber: number;
  dayOfWeek: string;
  startTime: string;
  type: string;
  mode: string;
  subjectId: number | null;
  subjectName?: string;
  onlineLink: string | null;
  capacity: number | null;
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function detectConflicts(lessons: Lesson[]): Set<number> {
  const conflicts = new Set<number>();
  for (let i = 0; i < lessons.length; i++) {
    for (let j = i + 1; j < lessons.length; j++) {
      const a = lessons[i], b = lessons[j];
      if (a.dayOfWeek === b.dayOfWeek) {
        const aStart = timeToMinutes(a.startTime);
        const bStart = timeToMinutes(b.startTime);
        if (Math.abs(aStart - bStart) < 60) {
          conflicts.add(a.id);
          conflicts.add(b.id);
        }
      }
    }
  }
  return conflicts;
}

export default function PlanGrid() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");

  const { data: lessons, isLoading } = useQuery<Lesson[]>({
    queryKey: ["lessons"],
    queryFn: () => fetchJSON("/lessons"),
  });

  const { data: subjects } = useQuery<any[]>({
    queryKey: ["subjects"],
    queryFn: () => fetchJSON("/subjects"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${API}/lessons/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      toast({ title: "Lesson removed" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${API}/lessons/${id}/duplicate`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      toast({ title: "Lesson duplicated" });
    },
  });

  const lessonList: Lesson[] = Array.isArray(lessons) ? lessons : [];
  const conflicts = detectConflicts(lessonList);
  const subjectMap = Object.fromEntries(
    (Array.isArray(subjects) ? subjects : []).map((s: any) => [s.id, s.name])
  );

  function openCreate() { setEditingLesson(null); setDialogOpen(true); }
  function openEdit(l: Lesson) { setEditingLesson(l); setDialogOpen(true); }

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">PlanGrid™</h1>
          <p className="text-muted-foreground text-sm">
            Your intelligent timetable — {lessonList.length} lessons scheduled.
            {conflicts.size > 0 && (
              <span className="text-amber-600 ml-2">
                <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                {conflicts.size} conflict{conflicts.size > 1 ? "s" : ""} detected
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setViewMode(viewMode === "calendar" ? "list" : "calendar")}>
            {viewMode === "calendar" ? <List className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Add Lesson
          </Button>
        </div>
      </motion.div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Lessons", value: lessonList.length, color: "text-foreground" },
          { label: "Online", value: lessonList.filter(l => l.mode === "online").length, color: "text-blue-600" },
          { label: "Centre", value: lessonList.filter(l => l.mode === "centre").length, color: "text-emerald-600" },
          { label: "Hybrid", value: lessonList.filter(l => l.mode === "hybrid").length, color: "text-purple-600" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : viewMode === "calendar" ? (
        <WeekCalendar
          lessons={lessonList}
          conflicts={conflicts}
          subjectMap={subjectMap}
          onEdit={openEdit}
          onDelete={id => deleteMutation.mutate(id)}
          onDuplicate={id => duplicateMutation.mutate(id)}
        />
      ) : (
        <ListViewTable
          lessons={lessonList}
          conflicts={conflicts}
          subjectMap={subjectMap}
          onEdit={openEdit}
          onDelete={id => deleteMutation.mutate(id)}
          onDuplicate={id => duplicateMutation.mutate(id)}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLesson ? "Edit Lesson" : "New Lesson"}</DialogTitle>
          </DialogHeader>
          <LessonForm
            lesson={editingLesson}
            onClose={() => { setDialogOpen(false); setEditingLesson(null); }}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ["lessons"] })}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Weekly Calendar Grid ──────────────────────────────────────────────── */
function WeekCalendar({ lessons, conflicts, subjectMap, onEdit, onDelete, onDuplicate }: {
  lessons: Lesson[];
  conflicts: Set<number>;
  subjectMap: Record<number, string>;
  onEdit: (l: Lesson) => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
}) {
  const activeDays = DAYS.filter(d => lessons.some(l => l.dayOfWeek === d));
  const displayDays = activeDays.length > 0 ? activeDays : DAYS.slice(0, 5);

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Header */}
          <div className="grid border-b" style={{ gridTemplateColumns: `56px repeat(${displayDays.length}, 1fr)` }}>
            <div className="p-2 border-r bg-muted/30" />
            {displayDays.map(day => (
              <div key={day} className="p-3 text-center border-r last:border-r-0 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground">{day.slice(0, 3).toUpperCase()}</p>
                <p className="text-sm font-medium">{day}</p>
              </div>
            ))}
          </div>

          {/* Time rows */}
          {HOURS.map(hour => {
            const hourMinutes = timeToMinutes(hour);
            const rowLessons = lessons.filter(l => {
              const lMin = timeToMinutes(l.startTime);
              return lMin >= hourMinutes && lMin < hourMinutes + 60;
            });

            if (rowLessons.length === 0 && hourMinutes > 18 * 60) return null;

            return (
              <div
                key={hour}
                className="grid border-b last:border-b-0"
                style={{ gridTemplateColumns: `56px repeat(${displayDays.length}, 1fr)`, minHeight: 60 }}
              >
                <div className="p-2 border-r text-xs text-muted-foreground text-right pr-2 pt-2 shrink-0 bg-muted/10">{hour}</div>
                {displayDays.map(day => {
                  const dayLessons = rowLessons.filter(l => l.dayOfWeek === day);
                  return (
                    <div key={day} className="border-r last:border-r-0 p-1 relative">
                      {dayLessons.map(lesson => (
                        <LessonCard
                          key={lesson.id}
                          lesson={lesson}
                          hasConflict={conflicts.has(lesson.id)}
                          subjectMap={subjectMap}
                          onEdit={() => onEdit(lesson)}
                          onDelete={() => onDelete(lesson.id)}
                          onDuplicate={() => onDuplicate(lesson.id)}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {lessons.length === 0 && (
            <AppEmptyState
              type="sessions"
              title="No lessons scheduled"
              description="Click 'Add Lesson' to start building your timetable."
              size="md"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LessonCard({ lesson, hasConflict, subjectMap, onEdit, onDelete, onDuplicate }: {
  lesson: Lesson;
  hasConflict: boolean;
  subjectMap: Record<number, string>;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const subName = lesson.subjectId ? subjectMap[lesson.subjectId] : null;

  return (
    <div
      className={cn(
        "rounded-md border p-1.5 text-xs cursor-pointer mb-1 transition-all group relative",
        MODE_COLORS[lesson.mode],
        hasConflict && "ring-2 ring-amber-400"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onEdit}
    >
      <div className="flex items-center gap-1 mb-0.5">
        {MODE_ICONS[lesson.mode]}
        <span className="font-semibold truncate">L{lesson.lessonNumber}</span>
        {hasConflict && <AlertTriangle className="h-3 w-3 text-amber-500 ml-auto shrink-0" />}
      </div>
      <p className="text-[10px] opacity-80">{lesson.startTime}{subName ? ` · ${subName.slice(0, 12)}` : ""}</p>
      {hovered && (
        <div className="absolute inset-x-0 top-full z-10 mt-1 bg-popover border rounded-md shadow-lg p-2 text-xs text-foreground" onClick={e => e.stopPropagation()}>
          <p className="font-semibold mb-1">Lesson {lesson.lessonNumber}</p>
          <p className="text-muted-foreground mb-2">{lesson.dayOfWeek} @ {lesson.startTime} · {lesson.mode}</p>
          {subName && <p className="text-muted-foreground mb-2">{subName}</p>}
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-6 text-xs gap-1 flex-1" onClick={onEdit}>
              <Pencil className="h-3 w-3" /> Edit
            </Button>
            <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={e => { e.stopPropagation(); onDuplicate(); }}>
              <Copy className="h-3 w-3" />
            </Button>
            <Button variant="destructive" size="sm" className="h-6 text-xs gap-1 flex-1" onClick={onDelete}>
              <Trash2 className="h-3 w-3" /> Remove
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── List View ─────────────────────────────────────────────────────────── */
function ListViewTable({ lessons, conflicts, subjectMap, onEdit, onDelete, onDuplicate }: {
  lessons: Lesson[];
  conflicts: Set<number>;
  subjectMap: Record<number, string>;
  onEdit: (l: Lesson) => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Day</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lessons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <AppEmptyState type="sessions" title="No lessons yet" description='Click "Add Lesson" to build your timetable.' size="sm" />
                </TableCell>
              </TableRow>
            ) : (
              DAYS.flatMap(day =>
                lessons
                  .filter(l => l.dayOfWeek === day)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map(lesson => (
                    <TableRow key={lesson.id} className={conflicts.has(lesson.id) ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}>
                      <TableCell className="font-medium">
                        {conflicts.has(lesson.id) && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 inline mr-1" />}
                        L{lesson.lessonNumber}
                      </TableCell>
                      <TableCell>{lesson.dayOfWeek}</TableCell>
                      <TableCell className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />{lesson.startTime}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {lesson.subjectId ? (subjectMap[lesson.subjectId] ?? "—") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("border text-xs capitalize gap-1", MODE_COLORS[lesson.mode])}>
                          {MODE_ICONS[lesson.mode]}{lesson.mode}
                        </Badge>
                      </TableCell>
                      <TableCell>{lesson.capacity ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(lesson)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => onDuplicate(lesson.id)} title="Duplicate">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(lesson.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
              )
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ── Lesson Form ───────────────────────────────────────────────────────── */
function LessonForm({ lesson, onClose, onRefresh }: {
  lesson: Lesson | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: subjects } = useQuery<any[]>({ queryKey: ["subjects"], queryFn: () => fetchJSON("/subjects") });
  const subjectList: any[] = Array.isArray(subjects) ? subjects : [];

  const [form, setForm] = useState({
    lessonNumber: lesson?.lessonNumber ?? 1,
    dayOfWeek: lesson?.dayOfWeek ?? "Monday",
    startTime: lesson?.startTime ?? "09:00",
    type: lesson?.type ?? "lesson",
    mode: lesson?.mode ?? "online",
    subjectId: lesson?.subjectId ? String(lesson.subjectId) : "",
    onlineLink: lesson?.onlineLink ?? "",
    capacity: lesson?.capacity ?? 20,
  });

  const mutation = useMutation({
    mutationFn: (data: any) =>
      fetch(`${API}/lessons${lesson ? `/${lesson.id}` : ""}`, {
        method: lesson ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      onClose();
      onRefresh();
    },
  });

  return (
    <form
      onSubmit={e => { e.preventDefault(); mutation.mutate({ ...form, subjectId: form.subjectId ? parseInt(form.subjectId) : null }); }}
      className="space-y-4 mt-2"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Lesson #</Label>
          <Input type="number" min={1} value={form.lessonNumber} onChange={e => setForm(f => ({ ...f, lessonNumber: +e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Start Time</Label>
          <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Day</Label>
          <Select value={form.dayOfWeek} onValueChange={v => setForm(f => ({ ...f, dayOfWeek: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Mode</Label>
          <Select value={form.mode} onValueChange={v => setForm(f => ({ ...f, mode: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MODES.map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Subject</Label>
          <Select value={form.subjectId} onValueChange={v => setForm(f => ({ ...f, subjectId: v }))}>
            <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {subjectList.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Capacity</Label>
          <Input type="number" min={1} value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: +e.target.value }))} />
        </div>
      </div>
      {form.mode === "online" || form.mode === "hybrid" ? (
        <div className="space-y-1.5">
          <Label>Online Link</Label>
          <Input placeholder="https://meet.google.com/…" value={form.onlineLink} onChange={e => setForm(f => ({ ...f, onlineLink: e.target.value }))} />
        </div>
      ) : null}
      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : lesson ? "Update Lesson" : "Create Lesson"}
      </Button>
    </form>
  );
}
