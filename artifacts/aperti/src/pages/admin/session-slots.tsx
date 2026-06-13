import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  CalendarDays, Plus, Pencil, Trash2, Clock, MapPin, Wifi,
  AlertTriangle, CheckCircle, RefreshCw
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Lesson = { id: number; lessonNumber: number; dayOfWeek: string; startTime: string };
type SessionSlot = {
  id: number; lessonId: number; slotLabel: string; dayOfWeek: string;
  startTime: string; endTime?: string; roomOrLink?: string;
  mode: string; capacity?: number; isActive: boolean; sortOrder: number;
};

type ConflictResult = {
  hasConflicts: boolean;
  conflicts: Array<{ slot1: SessionSlot; slot2: SessionSlot; reason: string }>;
};

function SlotForm({
  lessons, initial, onSave, onClose,
}: {
  lessons: Lesson[];
  initial?: Partial<SessionSlot>;
  onSave: (data: Partial<SessionSlot>) => void;
  onClose: () => void;
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
      <div><Label>Lesson <span className="text-destructive">*</span></Label>
        <Select value={form.lessonId} onValueChange={v => set("lessonId", v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Select lesson…" /></SelectTrigger>
          <SelectContent>
            {lessons.map(l => (
              <SelectItem key={l.id} value={String(l.id)}>Lesson {l.lessonNumber} — {l.dayOfWeek} {l.startTime}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div><Label>Slot Label <span className="text-destructive">*</span></Label>
        <Input value={form.slotLabel} onChange={e => set("slotLabel", e.target.value)} placeholder="e.g. Slot A – 9am Monday" className="mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Day <span className="text-destructive">*</span></Label>
          <Select value={form.dayOfWeek} onValueChange={v => set("dayOfWeek", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Mode</Label>
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
        <div><Label>Start Time <span className="text-destructive">*</span></Label>
          <Input type="time" value={form.startTime} onChange={e => set("startTime", e.target.value)} className="mt-1" />
        </div>
        <div><Label>End Time</Label>
          <Input type="time" value={form.endTime} onChange={e => set("endTime", e.target.value)} className="mt-1" />
        </div>
      </div>
      <div><Label>Room / Online Link</Label>
        <Input value={form.roomOrLink} onChange={e => set("roomOrLink", e.target.value)} placeholder="Room 3A or https://meet.google.com/…" className="mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Capacity</Label>
          <Input type="number" value={form.capacity} onChange={e => set("capacity", e.target.value)} placeholder="e.g. 20" className="mt-1" />
        </div>
        <div><Label>Sort Order</Label>
          <Input type="number" value={form.sortOrder} onChange={e => set("sortOrder", e.target.value)} className="mt-1" />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button className="flex-1" onClick={handleSave} disabled={!form.lessonId || !form.slotLabel}>Save Slot</Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

export default function SessionSlotsAdminPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editSlot, setEditSlot] = useState<SessionSlot | null>(null);
  const [showConflicts, setShowConflicts] = useState(false);

  const { data: lessons = [], isLoading: lessonsLoading } = useQuery<Lesson[]>({
    queryKey: ["lessons", "all"],
    queryFn: () => apiFetch("/api/lessons").then(r => r.json()),
  });

  const { data: slots = [], isLoading: slotsLoading } = useQuery<SessionSlot[]>({
    queryKey: ["session-slots"],
    queryFn: () => apiFetch("/api/session-slots").then(r => r.json()),
  });

  const { data: conflicts } = useQuery<ConflictResult>({
    queryKey: ["session-slots", "conflicts"],
    queryFn: () => apiFetch("/api/session-slots/conflicts").then(r => r.json()),
    enabled: showConflicts,
  });

  const create = useMutation({
    mutationFn: (data: Partial<SessionSlot>) => apiFetch("/api/session-slots", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["session-slots"] }); setCreateOpen(false); toast({ title: "Session slot created" }); },
    onError: () => toast({ title: "Failed to create slot", variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SessionSlot> }) =>
      apiFetch(`/api/session-slots/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["session-slots"] }); setEditSlot(null); toast({ title: "Slot updated" }); },
    onError: () => toast({ title: "Failed to update slot", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/session-slots/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["session-slots"] }); toast({ title: "Slot deactivated" }); },
    onError: () => toast({ title: "Failed to deactivate slot", variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiFetch(`/api/session-slots/${id}`, { method: "PUT", body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["session-slots"] }),
  });

  const getLessonLabel = (lessonId: number) => {
    const lesson = lessons.find(l => l.id === lessonId);
    return lesson ? `Lesson ${lesson.lessonNumber}` : `Lesson ${lessonId}`;
  };

  const activeSlots = slots.filter(s => s.isActive);
  const inactiveSlots = slots.filter(s => !s.isActive);
  const slotsByDay = DAYS.reduce((acc, day) => {
    acc[day] = activeSlots.filter(s => s.dayOfWeek === day);
    return acc;
  }, {} as Record<string, SessionSlot[]>);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Session Slots</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage time slots within lessons — supports multi-slot scheduling per lesson</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowConflicts(s => !s)} className="gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            {showConflicts ? "Hide" : "Check"} Conflicts
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />New Slot</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Session Slot</DialogTitle></DialogHeader>
              <SlotForm lessons={lessons} onSave={d => create.mutate(d)} onClose={() => setCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Slots", value: slots.length, color: "text-foreground" },
          { label: "Active Slots", value: activeSlots.length, color: "text-emerald-600" },
          { label: "Inactive", value: inactiveSlots.length, color: "text-muted-foreground" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="shadow-sm">
            <CardContent className="p-4">
              <p className={`text-2xl font-bold ${color}`}>{slotsLoading ? "…" : value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Conflict detection */}
      {showConflicts && conflicts && (
        <Card className={`shadow-sm border ${conflicts.hasConflicts ? "border-red-200 bg-red-50 dark:bg-red-900/10" : "border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10"}`}>
          <CardContent className="p-4">
            {conflicts.hasConflicts ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <p className="font-semibold text-red-700 dark:text-red-400">{conflicts.conflicts.length} scheduling conflict(s) detected</p>
                </div>
                {conflicts.conflicts.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 mb-1">
                    <span className="font-mono text-xs">{c.slot1.slotLabel}</span>
                    <span>↔</span>
                    <span className="font-mono text-xs">{c.slot2.slotLabel}</span>
                    <span className="text-red-500">— {c.reason}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle className="h-4 w-4" />
                <p className="font-semibold">No scheduling conflicts detected</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Weekly grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {DAYS.map(day => {
          const daySlots = slotsByDay[day] ?? [];
          if (daySlots.length === 0 && !slotsLoading) return null;
          return (
            <Card key={day} className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                  {day}
                  <Badge variant="secondary" className="text-[10px] ml-auto">{daySlots.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {slotsLoading ? <Skeleton className="h-12 rounded-lg" /> :
                  daySlots.length === 0 ? <p className="text-xs text-muted-foreground py-1">No slots</p> :
                  daySlots.map(slot => (
                    <div key={slot.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{slot.slotLabel}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" />{slot.startTime}{slot.endTime ? `–${slot.endTime}` : ""}
                          </span>
                          {slot.roomOrLink && (
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground truncate max-w-24">
                              {slot.mode === "online" ? <Wifi className="h-2.5 w-2.5" /> : <MapPin className="h-2.5 w-2.5" />}
                              {slot.roomOrLink}
                            </span>
                          )}
                          <Badge variant="outline" className="text-[9px] h-3.5">{getLessonLabel(slot.lessonId)}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Switch checked={slot.isActive} onCheckedChange={v => toggleActive.mutate({ id: slot.id, isActive: v })} className="scale-75" />
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditSlot(slot)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => remove.mutate(slot.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                }
              </CardContent>
            </Card>
          );
        })}

        {!slotsLoading && activeSlots.length === 0 && (
          <Card className="shadow-sm md:col-span-2 xl:col-span-3">
            <CardContent className="p-8 text-center text-muted-foreground">
              <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No session slots yet</p>
              <p className="text-sm mt-1">Create your first session slot to get started.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit dialog */}
      {editSlot && (
        <Dialog open={!!editSlot} onOpenChange={v => { if (!v) setEditSlot(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Session Slot</DialogTitle></DialogHeader>
            <SlotForm
              lessons={lessons}
              initial={editSlot}
              onSave={d => update.mutate({ id: editSlot.id, data: d })}
              onClose={() => setEditSlot(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
