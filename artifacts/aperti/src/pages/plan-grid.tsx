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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Pencil, Trash2, Calendar as CalendarIcon, Clock, MapPin, Monitor, Users,
} from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("aperti_token");

async function fetchJSON(url: string) {
  const res = await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MODES = ["online", "centre", "hybrid"];

interface Lesson {
  id: number;
  lessonNumber: number;
  dayOfWeek: string;
  startTime: string;
  type: string;
  mode: string;
  subjectId: number | null;
  onlineLink: string | null;
  capacity: number | null;
}

export default function PlanGrid() {
  const queryClient = useQueryClient();
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const { data: lessons, isLoading } = useQuery<Lesson[]>({
    queryKey: ["lessons"],
    queryFn: () => fetchJSON("/lessons"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${API}/lessons/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token()}` } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lessons"] }),
  });

  const filtered = lessons?.filter((l) => {
    if (activeTab === "all") return true;
    return l.mode === activeTab;
  });

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-3xl font-bold">
            PlanGrid<span className="text-primary"></span>
          </h1>
          <p className="text-muted-foreground">Your intelligent timetable.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingLesson(null)}>
              <Plus className="h-4 w-4 mr-2" /> Add Lesson
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingLesson ? "Edit Lesson" : "New Lesson"}</DialogTitle>
            </DialogHeader>
            <LessonForm
              lesson={editingLesson}
              onClose={() => {
                setDialogOpen(false);
                setEditingLesson(null);
              }}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["lessons"] })}
            />
          </DialogContent>
        </Dialog>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="online">Online</TabsTrigger>
          <TabsTrigger value="centre">Centre</TabsTrigger>
          <TabsTrigger value="hybrid">Hybrid</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="card-hover">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lesson</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filtered?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No lessons yet. Click “Add Lesson” to build your timetable.
                  </TableCell>
                </TableRow>
              ) : (
                filtered?.map((lesson) => (
                  <TableRow key={lesson.id}>
                    <TableCell className="font-medium">Lesson {lesson.lessonNumber}</TableCell>
                    <TableCell>{lesson.dayOfWeek}</TableCell>
                    <TableCell>{lesson.startTime}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {lesson.mode === "online" ? <Monitor className="h-3 w-3 mr-1 inline" /> : lesson.mode === "centre" ? <MapPin className="h-3 w-3 mr-1 inline" /> : <Users className="h-3 w-3 mr-1 inline" />}
                        {lesson.mode}
                      </Badge>
                    </TableCell>
                    <TableCell>{lesson.capacity ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingLesson(lesson);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(lesson.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function LessonForm({
  lesson,
  onClose,
  onRefresh,
}: {
  lesson: Lesson | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [form, setForm] = useState({
    lessonNumber: lesson?.lessonNumber ?? 1,
    dayOfWeek: lesson?.dayOfWeek ?? "Monday",
    startTime: lesson?.startTime ?? "09:00",
    type: lesson?.type ?? "lesson",
    mode: lesson?.mode ?? "online",
    onlineLink: lesson?.onlineLink ?? "",
    capacity: lesson?.capacity ?? 20,
  });

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (data: any) =>
      fetch(`${API}/lessons${lesson ? `/${lesson.id}` : ""}`, {
        method: lesson ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("aperti_token")}` },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      onClose();
      onRefresh();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(form);
      }}
      className="space-y-4 mt-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Lesson #</Label>
          <Input type="number" value={form.lessonNumber} onChange={(e) => setForm({ ...form, lessonNumber: +e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Start Time</Label>
          <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Day</Label>
          <Select value={form.dayOfWeek} onValueChange={(v) => setForm({ ...form, dayOfWeek: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Mode</Label>
          <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      {form.mode === "online" && (
        <div className="space-y-2">
          <Label>Online Link</Label>
          <Input placeholder="https://meet.google.com/..." value={form.onlineLink} onChange={(e) => setForm({ ...form, onlineLink: e.target.value })} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Capacity</Label>
          <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: +e.target.value })} />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : lesson ? "Update Lesson" : "Create Lesson"}
      </Button>
    </form>
  );
}
