import { useState } from "react";
import {
  useListSessions,
  useCreateSession,
  useDeleteSession,
  getListSessionsQueryKey,
  CreateSessionBodyLessonNumber,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Clock, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

const DAY_SHORT: Record<string, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
  Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};

const DAY_COLOR: Record<string, string> = {
  Monday: "bg-blue-100 text-blue-700",
  Tuesday: "bg-purple-100 text-purple-700",
  Wednesday: "bg-emerald-100 text-emerald-700",
  Thursday: "bg-orange-100 text-orange-700",
  Friday: "bg-rose-100 text-rose-700",
  Saturday: "bg-amber-100 text-amber-700",
  Sunday: "bg-slate-100 text-slate-600",
};

export default function Sessions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [newSession, setNewSession] = useState({
    lessonNumber: 1 as CreateSessionBodyLessonNumber,
    dayOfWeek: "Monday" as typeof DAYS[number],
    startTime: "09:00",
  });

  const { data: sessions, isLoading } = useListSessions({
    query: { queryKey: getListSessionsQueryKey() },
  });

  const createSessionMutation = useCreateSession({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        setIsAddOpen(false);
        setNewSession({ lessonNumber: 1, dayOfWeek: "Monday", startTime: "09:00" });
        toast({ title: "Session created", description: `Lesson ${newSession.lessonNumber} scheduled for every ${newSession.dayOfWeek}` });
      },
      onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    },
  });

  const deleteSessionMutation = useDeleteSession({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        toast({ title: "Session removed" });
      },
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSession.startTime.match(/^\d{2}:\d{2}$/)) {
      toast({ title: "Invalid time", description: "Enter time as HH:MM (e.g. 09:30)", variant: "destructive" });
      return;
    }
    createSessionMutation.mutate({ data: newSession });
  };

  const todayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Session Setup</h1>
          <p className="text-muted-foreground mt-1">
            Define your weekly recurring class schedule. Sessions repeat automatically every week.
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Session
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Weekly Session</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-5 pt-2">
              <div className="space-y-2">
                <Label>Lesson Number</Label>
                <Select
                  value={newSession.lessonNumber.toString()}
                  onValueChange={(v) =>
                    setNewSession({ ...newSession, lessonNumber: parseInt(v, 10) as CreateSessionBodyLessonNumber })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Lesson 1</SelectItem>
                    <SelectItem value="2">Lesson 2</SelectItem>
                    <SelectItem value="3">Lesson 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Day of Week</Label>
                <Select
                  value={newSession.dayOfWeek}
                  onValueChange={(v) => setNewSession({ ...newSession, dayOfWeek: v as typeof DAYS[number] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((day) => (
                      <SelectItem key={day} value={day}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="startTime"
                    type="time"
                    className="pl-10"
                    value={newSession.startTime}
                    onChange={(e) => setNewSession({ ...newSession, startTime: e.target.value })}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">24-hour format — e.g. 09:00, 13:30, 17:45</p>
              </div>

              <Button type="submit" className="w-full" disabled={createSessionMutation.isPending}>
                {createSessionMutation.isPending ? "Saving..." : "Create Session"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
        <CalendarDays className="h-4 w-4 shrink-0" />
        <span>
          Sessions defined here repeat every week automatically. Today is <strong>{todayName}</strong>.
        </span>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center text-muted-foreground">Loading sessions...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Lesson</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!sessions || sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No sessions yet. Add a weekly session to start taking attendance.
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions
                    .slice()
                    .sort((a, b) => a.lessonNumber - b.lessonNumber)
                    .map((session) => (
                      <TableRow key={session.id} className={session.dayOfWeek === todayName ? "bg-primary/5" : ""}>
                        <TableCell className="font-semibold">
                          Lesson {session.lessonNumber}
                          {session.dayOfWeek === todayName && (
                            <span className="ml-2 text-xs font-normal text-primary">Today</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${DAY_COLOR[session.dayOfWeek] || "bg-secondary text-secondary-foreground"}`}>
                            {session.dayOfWeek}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-mono text-sm">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {session.startTime}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm("Remove this session? Existing attendance records will be deleted.")) {
                                deleteSessionMutation.mutate({ id: session.id });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
