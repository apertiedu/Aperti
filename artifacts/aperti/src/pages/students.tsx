import { useState } from "react";
import {
  useListStudents,
  useListSessions,
  useCreateStudent,
  useDeleteStudent,
  useBulkCreateStudents,
  getListStudentsQueryKey,
  getListSessionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, UserPlus, Upload, Search, Clock, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

const NONE_VALUE = "__none__";

type Session = { id: number; lessonNumber: number; dayOfWeek: string; startTime: string };
type StudentRecord = {
  id: number;
  studentCode: string;
  studentName: string;
  lesson1SessionId?: number | null;
  lesson2SessionId?: number | null;
  lesson3SessionId?: number | null;
  lesson1Session?: Session | null;
  lesson2Session?: Session | null;
  lesson3Session?: Session | null;
};

function sessionLabel(s: Session) {
  return `${s.dayOfWeek} at ${s.startTime}`;
}

function SessionBadge({ session }: { session?: Session | null }) {
  if (!session)
    return <span className="text-muted-foreground text-xs italic">Not assigned</span>;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
      <Clock className="h-3 w-3" />
      {session.dayOfWeek} {session.startTime}
    </span>
  );
}

function StudentForm({
  initial,
  sessions,
  onSave,
  saving,
  submitLabel,
}: {
  initial: { studentCode: string; studentName: string; lesson1SessionId: number | null; lesson2SessionId: number | null; lesson3SessionId: number | null };
  sessions: Session[];
  onSave: (data: typeof initial) => void;
  saving: boolean;
  submitLabel: string;
}) {
  const [form, setForm] = useState(initial);

  const lesson1Sessions = sessions.filter((s) => s.lessonNumber === 1);
  const lesson2Sessions = sessions.filter((s) => s.lessonNumber === 2);
  const lesson3Sessions = sessions.filter((s) => s.lessonNumber === 3);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pt-2">
      <div className="space-y-2">
        <Label htmlFor="code">Student Code</Label>
        <Input
          id="code"
          placeholder="e.g. STU004"
          className="font-mono"
          value={form.studentCode}
          onChange={(e) => setForm({ ...form, studentCode: e.target.value.toUpperCase() })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Student Name</Label>
        <Input
          id="name"
          placeholder="e.g. Ahmed Hassan"
          value={form.studentName}
          onChange={(e) => setForm({ ...form, studentName: e.target.value })}
          required
        />
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
        <div>
          <p className="text-sm font-medium">Session Assignments</p>
          <p className="text-xs text-muted-foreground mt-0.5">Choose the session time slot for each lesson</p>
        </div>

        {([
          { label: "Lesson 1", field: "lesson1SessionId", list: lesson1Sessions },
          { label: "Lesson 2", field: "lesson2SessionId", list: lesson2Sessions },
          { label: "Lesson 3", field: "lesson3SessionId", list: lesson3Sessions },
        ] as const).map(({ label, field, list }) => (
          <div key={field} className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{label} Session</Label>
            {list.length === 0 ? (
              <p className="text-xs text-amber-600">No {label} sessions configured yet</p>
            ) : (
              <Select
                value={(form[field] ?? NONE_VALUE).toString()}
                onValueChange={(v) =>
                  setForm({ ...form, [field]: v === NONE_VALUE ? null : parseInt(v, 10) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select session..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Not assigned</SelectItem>
                  {list.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {sessionLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ))}
      </div>

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}

export default function Students() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [bulkData, setBulkData] = useState("");

  const blankStudent = { studentCode: "", studentName: "", lesson1SessionId: null as number | null, lesson2SessionId: null as number | null, lesson3SessionId: null as number | null };

  const { data: students, isLoading } = useListStudents({
    query: { queryKey: getListStudentsQueryKey() },
  });

  const { data: sessions = [] } = useListSessions({
    query: { queryKey: getListSessionsQueryKey() },
  });

  const createStudentMutation = useCreateStudent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        setIsAddOpen(false);
        toast({ title: "Student added" });
      },
      onError: (err: any) =>
        toast({ title: "Error", description: err?.response?.data?.message || err.message, variant: "destructive" }),
    },
  });

  const bulkCreateMutation = useBulkCreateStudents({
    mutation: {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        setIsBulkOpen(false);
        setBulkData("");
        toast({ title: "Import complete", description: `Added ${res.added}, skipped ${res.skipped}` });
      },
      onError: (err: any) =>
        toast({ title: "Error", description: err.message, variant: "destructive" }),
    },
  });

  const deleteStudentMutation = useDeleteStudent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        toast({ title: "Student removed" });
      },
    },
  });

  const handleEdit = async (data: { studentCode: string; studentName: string; lesson1SessionId: number | null; lesson2SessionId: number | null; lesson3SessionId: number | null }) => {
    if (!editingStudent) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/students/${editingStudent.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Update failed");
      }
      queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
      toast({ title: "Student updated" });
      setEditingStudent(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  };

  const handleBulkImport = () => {
    const lines = bulkData.split("\n").filter((l) => l.trim());
    const parsed = lines
      .map((line) => {
        const [code, name] = line.split(",").map((s) => s.trim());
        return { studentCode: code, studentName: name };
      })
      .filter((s) => s.studentCode && s.studentName);

    if (parsed.length === 0) {
      toast({ title: "No valid rows", description: "Format: StudentCode, StudentName", variant: "destructive" });
      return;
    }
    bulkCreateMutation.mutate({ data: { students: parsed } });
  };

  const filteredStudents = students?.filter(
    (s) =>
      s.studentName.toLowerCase().includes(search.toLowerCase()) ||
      s.studentCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Database</h1>
          <p className="text-muted-foreground mt-1">Manage enrolled students and their session assignments.</p>
        </div>
        <div className="flex gap-2">
          {/* Bulk Import */}
          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Bulk Import
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Import Students</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  One student per line: <span className="font-mono font-medium">StudentCode, StudentName</span>
                  <br />Session assignments can be set individually after import.
                </p>
                <Textarea
                  placeholder={"STU010, Ahmed Hassan\nSTU011, Sara Ali"}
                  className="min-h-[160px] font-mono text-sm"
                  value={bulkData}
                  onChange={(e) => setBulkData(e.target.value)}
                />
                <Button onClick={handleBulkImport} className="w-full" disabled={bulkCreateMutation.isPending || !bulkData.trim()}>
                  {bulkCreateMutation.isPending ? "Importing..." : "Import"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Student */}
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Student</DialogTitle>
              </DialogHeader>
              <StudentForm
                initial={blankStudent}
                sessions={sessions as Session[]}
                onSave={(data) => createStudentMutation.mutate({ data })}
                saving={createStudentMutation.isPending}
                submitLabel="Add Student"
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Student Dialog */}
      <Dialog open={!!editingStudent} onOpenChange={(v) => { if (!v) setEditingStudent(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student — {editingStudent?.studentCode}</DialogTitle>
          </DialogHeader>
          {editingStudent && (
            <StudentForm
              initial={{
                studentCode: editingStudent.studentCode,
                studentName: editingStudent.studentName,
                lesson1SessionId: editingStudent.lesson1SessionId ?? null,
                lesson2SessionId: editingStudent.lesson2SessionId ?? null,
                lesson3SessionId: editingStudent.lesson3SessionId ?? null,
              }}
              sessions={sessions as Session[]}
              onSave={handleEdit}
              saving={editSaving}
              submitLabel="Save Changes"
            />
          )}
        </DialogContent>
      </Dialog>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              className="pl-9 bg-muted/50 border-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[130px]">Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Lesson 1</TableHead>
                  <TableHead>Lesson 2</TableHead>
                  <TableHead>Lesson 3</TableHead>
                  <TableHead className="text-right w-[90px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!filteredStudents || filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {search ? "No students match your search." : "No students yet. Add one above."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-mono font-semibold text-sm">{student.studentCode}</TableCell>
                      <TableCell className="font-medium">{student.studentName}</TableCell>
                      <TableCell><SessionBadge session={student.lesson1Session} /></TableCell>
                      <TableCell><SessionBadge session={student.lesson2Session} /></TableCell>
                      <TableCell><SessionBadge session={student.lesson3Session} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => setEditingStudent(student as StudentRecord)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm("Delete this student? Their attendance records will also be removed.")) {
                                deleteStudentMutation.mutate({ id: student.id });
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
