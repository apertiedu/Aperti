import { useState } from "react";
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
import { Trash2, Plus, Pencil, Clock, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const DAY_COLORS: Record<string, string> = {
  Monday: "bg-blue-100 text-blue-800",
  Tuesday: "bg-purple-100 text-purple-800",
  Wednesday: "bg-green-100 text-green-800",
  Thursday: "bg-orange-100 text-orange-800",
  Friday: "bg-rose-100 text-rose-800",
  Saturday: "bg-amber-100 text-amber-800",
  Sunday: "bg-slate-100 text-slate-700",
};

type Session = { id: number; lessonNumber: number; dayOfWeek: string; startTime: string };
type FormState = { lessonNumber: string; dayOfWeek: string; startTime: string };

function SessionFormDialog({
  trigger,
  title,
  initial,
  onSave,
  saving,
}: {
  trigger: React.ReactNode;
  title: string;
  initial: FormState;
  onSave: (data: { lessonNumber: number; dayOfWeek: string; startTime: string }) => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initial);

  const handleOpen = (v: boolean) => {
    setOpen(v);
    if (v) setForm(initial);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ lessonNumber: parseInt(form.lessonNumber, 10), dayOfWeek: form.dayOfWeek, startTime: form.startTime });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Lesson Number</Label>
            <Select value={form.lessonNumber} onValueChange={(v) => setForm({ ...form, lessonNumber: v })}>
              <SelectTrigger><SelectValue placeholder="Pick lesson..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Lesson 1</SelectItem>
                <SelectItem value="2">Lesson 2</SelectItem>
                <SelectItem value="3">Lesson 3</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Day of Week</Label>
            <Select value={form.dayOfWeek} onValueChange={(v) => setForm({ ...form, dayOfWeek: v })}>
              <SelectTrigger><SelectValue placeholder="Pick day..." /></SelectTrigger>
              <SelectContent>
                {DAYS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Start Time</Label>
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={saving || !form.lessonNumber || !form.dayOfWeek || !form.startTime}
          >
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

  const { data: sessions, isLoading } = useListSessions({
    query: { queryKey: getListSessionsQueryKey() },
  });

  const createMutation = useCreateSession({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        toast({ title: "Session created" });
      },
      onError: (err: any) =>
        toast({ title: "Error", description: err?.response?.data?.message || err.message, variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteSession({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        toast({ title: "Session deleted" });
      },
    },
  });

  const handleEdit = async (session: Session, data: { lessonNumber: number; dayOfWeek: string; startTime: string }) => {
    setEditSaving(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Update failed");
      }
      queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
      toast({ title: "Session updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  };

  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Session Setup</h1>
          <p className="text-muted-foreground mt-1">
            Define your weekly recurring class schedule. Sessions repeat automatically every week.
          </p>
        </div>
        <SessionFormDialog
          trigger={
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Session
            </Button>
          }
          title="Add New Session"
          initial={{ lessonNumber: "", dayOfWeek: "", startTime: "" }}
          onSave={(data) => createMutation.mutate({ data: { lessonNumber: data.lessonNumber as 1|2|3, dayOfWeek: data.dayOfWeek as any, startTime: data.startTime } })}
          saving={createMutation.isPending}
        />
      </div>

      <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm flex items-center gap-2 text-muted-foreground">
        <CalendarDays className="h-4 w-4 text-primary flex-shrink-0" />
        Sessions repeat every week automatically. Today is{" "}
        <span className="font-semibold text-foreground">{todayName}</span>.
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center text-muted-foreground">Loading...</div>
          ) : !sessions || sessions.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No sessions yet. Click "Add Session" to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Lesson</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-semibold">Lesson {session.lessonNumber}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${DAY_COLORS[session.dayOfWeek] ?? "bg-muted text-muted-foreground"}`}>
                        {session.dayOfWeek}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-sm">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {session.startTime}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <SessionFormDialog
                          trigger={
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          }
                          title={`Edit Session — Lesson ${session.lessonNumber}`}
                          initial={{
                            lessonNumber: String(session.lessonNumber),
                            dayOfWeek: session.dayOfWeek,
                            startTime: session.startTime,
                          }}
                          onSave={(data) => handleEdit(session, data)}
                          saving={editSaving}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm("Delete this session? Students assigned to it will lose this slot.")) {
                              deleteMutation.mutate({ id: session.id });
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
