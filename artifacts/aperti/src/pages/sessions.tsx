import { useState, useEffect } from "react";
import {
  useListSessions,
  useCreateSession,
  useDeleteSession,
  getListSessionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Pencil, Clock, CalendarDays, Wifi, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const DAY_COLORS: Record<string, string> = {
  Monday: "bg-blue-100 text-blue-800", Tuesday: "bg-purple-100 text-purple-800",
  Wednesday: "bg-green-100 text-green-800", Thursday: "bg-orange-100 text-orange-800",
  Friday: "bg-rose-100 text-rose-800", Saturday: "bg-amber-100 text-amber-800",
  Sunday: "bg-slate-100 text-slate-700",
};

type Subject = { id: number; name: string };
type Session = { id: number; lessonNumber: number; dayOfWeek: string; startTime: string; type: string; capacity: number | null; subjectId: number | null; onlineLink: string | null };

type FormState = {
  lessonNumber: string; dayOfWeek: string; startTime: string;
  type: string; capacity: string; subjectId: string; onlineLink: string;
};

function SessionFormDialog({ trigger, title, initial, onSave, saving, subjects }: {
  trigger: React.ReactNode; title: string; initial: FormState;
  onSave: (data: FormState) => void; saving: boolean; subjects: Subject[];
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initial);

  const handleOpen = (v: boolean) => { setOpen(v); if (v) setForm(initial); };
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(form); setOpen(false); };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Lesson Number</Label>
              <Select value={form.lessonNumber} onValueChange={v => setForm({ ...form, lessonNumber: v })}>
                <SelectTrigger><SelectValue placeholder="Pick lesson..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Lesson 1</SelectItem>
                  <SelectItem value="2">Lesson 2</SelectItem>
                  <SelectItem value="3">Lesson 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Day of Week</Label>
              <Select value={form.dayOfWeek} onValueChange={v => setForm({ ...form, dayOfWeek: v })}>
                <SelectTrigger><SelectValue placeholder="Pick day..." /></SelectTrigger>
                <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Time</Label>
              <Input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Subject (optional)</Label>
              <Select value={form.subjectId || "none"} onValueChange={v => setForm({ ...form, subjectId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select subject..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No subject</SelectItem>
                  {subjects.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Session Type</Label>
            <Select value={form.type} onValueChange={v => setForm({ ...form, type: v, capacity: "", onlineLink: "" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="centre"><span className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5" />Centre (Physical)</span></SelectItem>
                <SelectItem value="online"><span className="flex items-center gap-2"><Wifi className="h-3.5 w-3.5" />Online</span></SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.type === "centre" && (
            <div className="space-y-1.5">
              <Label>Seat Capacity</Label>
              <Input type="number" min="1" placeholder="e.g. 20 (leave empty for unlimited)" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} />
            </div>
          )}

          {form.type === "online" && (
            <div className="space-y-1.5">
              <Label>Meeting Link (optional)</Label>
              <Input type="url" placeholder="https://meet.google.com/..." value={form.onlineLink} onChange={e => setForm({ ...form, onlineLink: e.target.value })} />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={saving || !form.lessonNumber || !form.dayOfWeek || !form.startTime}>
            {saving ? "Saving..." : "Save Session"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Sessions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editSaving, setEditSaving] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const { data: sessions, isLoading } = useListSessions({ query: { queryKey: getListSessionsQueryKey() } });

  useEffect(() => {
    fetch("/api/subjects", { credentials: "include" }).then(r => r.ok ? r.json() : []).then(setSubjects);
  }, []);

  const createMutation = useCreateSession({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() }); toast({ title: "Session created" }); },
      onError: (err: any) => toast({ title: "Error", description: err?.response?.data?.message || err.message, variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteSession({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() }); toast({ title: "Session deleted" }); },
    },
  });

  const handleCreate = (form: FormState) => {
    createMutation.mutate({
      data: {
        lessonNumber: parseInt(form.lessonNumber, 10) as 1 | 2 | 3,
        dayOfWeek: form.dayOfWeek as any,
        startTime: form.startTime,
        type: form.type,
        capacity: form.capacity ? parseInt(form.capacity, 10) : undefined,
        subjectId: form.subjectId ? parseInt(form.subjectId, 10) : undefined,
        onlineLink: form.onlineLink || undefined,
      } as any,
    });
  };

  const handleEdit = async (session: Session, form: FormState) => {
    setEditSaving(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonNumber: parseInt(form.lessonNumber, 10),
          dayOfWeek: form.dayOfWeek,
          startTime: form.startTime,
          type: form.type,
          capacity: form.capacity ? parseInt(form.capacity, 10) : null,
          subjectId: form.subjectId ? parseInt(form.subjectId, 10) : null,
          onlineLink: form.onlineLink || null,
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message); }
      queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
      toast({ title: "Session updated" });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setEditSaving(false); }
  };

  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const centreSessions = (sessions ?? []).filter(s => (s as any).type === "centre");
  const onlineSessions = (sessions ?? []).filter(s => (s as any).type === "online");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Session Setup</h1>
          <p className="text-muted-foreground mt-1">Define weekly recurring sessions. Set type, capacity, and subject.</p>
        </div>
        <SessionFormDialog
          trigger={<Button className="gap-2"><Plus className="h-4 w-4" />Add Session</Button>}
          title="Add New Session"
          initial={{ lessonNumber: "", dayOfWeek: "", startTime: "", type: "centre", capacity: "", subjectId: "", onlineLink: "" }}
          onSave={handleCreate}
          saving={createMutation.isPending}
          subjects={subjects}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {[
          { label: "Total Sessions", value: sessions?.length ?? 0 },
          { label: "Centre Sessions", value: centreSessions.length },
          { label: "Online Sessions", value: onlineSessions.length },
          { label: "Today's Sessions", value: (sessions ?? []).filter(s => (s as any).dayOfWeek === todayName).length },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold mt-0.5">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center text-muted-foreground">Loading...</div>
          ) : !sessions || sessions.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No sessions yet. Click "Add Session" to get started.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Lesson</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sessions as Session[]).map(session => {
                  const subject = subjects.find(s => s.id === session.subjectId);
                  return (
                    <TableRow key={session.id}>
                      <TableCell>
                        <span className="font-semibold">Lesson {session.lessonNumber}</span>
                        {subject && <span className="ml-2 text-xs text-primary">{subject.name}</span>}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${DAY_COLORS[session.dayOfWeek] ?? "bg-muted text-muted-foreground"}`}>
                          {session.dayOfWeek}
                          {session.dayOfWeek === todayName && " ✓"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />{session.startTime}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`flex items-center gap-1.5 text-xs font-medium ${session.type === "online" ? "text-blue-600" : "text-amber-700"}`}>
                          {session.type === "online" ? <Wifi className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                          {session.type === "online" ? "Online" : "Centre"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {session.type === "centre" ? (
                          session.capacity ? (
                            <span className="text-sm font-medium">{session.capacity} seats</span>
                          ) : <span className="text-muted-foreground text-xs">Unlimited</span>
                        ) : (
                          session.onlineLink ? (
                            <a href={session.onlineLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block max-w-[120px]">
                              Meeting Link
                            </a>
                          ) : <span className="text-muted-foreground text-xs">No link</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <SessionFormDialog
                            trigger={<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"><Pencil className="h-3.5 w-3.5" /></Button>}
                            title={`Edit — Lesson ${session.lessonNumber}`}
                            initial={{
                              lessonNumber: String(session.lessonNumber), dayOfWeek: session.dayOfWeek, startTime: session.startTime,
                              type: session.type || "centre", capacity: session.capacity?.toString() ?? "", subjectId: session.subjectId?.toString() ?? "", onlineLink: session.onlineLink ?? "",
                            }}
                            onSave={(form) => handleEdit(session, form)}
                            saving={editSaving}
                            subjects={subjects}
                          />
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => { if (confirm("Delete this session?")) deleteMutation.mutate({ id: session.id }); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
