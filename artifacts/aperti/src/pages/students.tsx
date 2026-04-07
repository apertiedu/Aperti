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
import { Trash2, UserPlus, Upload, Search, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

const NONE_VALUE = "__none__";

function SessionBadge({ session }: { session?: { dayOfWeek: string; startTime: string } | null }) {
  if (!session) return <span className="text-muted-foreground text-xs italic">Not assigned</span>;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
      <Clock className="h-3 w-3" />
      {session.dayOfWeek} {session.startTime}
    </span>
  );
}

export default function Students() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  const blankStudent = { studentCode: "", studentName: "", lesson1SessionId: null as number | null, lesson2SessionId: null as number | null, lesson3SessionId: null as number | null };
  const [newStudent, setNewStudent] = useState(blankStudent);
  const [bulkData, setBulkData] = useState("");

  const { data: students, isLoading } = useListStudents({
    query: { queryKey: getListStudentsQueryKey() },
  });

  const { data: sessions } = useListSessions({
    query: { queryKey: getListSessionsQueryKey() },
  });

  // Group sessions by lesson number for quick lookup
  const lesson1Sessions = sessions?.filter((s) => s.lessonNumber === 1) ?? [];
  const lesson2Sessions = sessions?.filter((s) => s.lessonNumber === 2) ?? [];
  const lesson3Sessions = sessions?.filter((s) => s.lessonNumber === 3) ?? [];

  const createStudentMutation = useCreateStudent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        setIsAddOpen(false);
        setNewStudent(blankStudent);
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

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    createStudentMutation.mutate({ data: newStudent });
  };

  const handleBulkImport = () => {
    const lines = bulkData.split("\n").filter((l) => l.trim() !== "");
    const parsed = lines.map((line) => {
      const [code, name] = line.split(",").map((s) => s.trim());
      return { studentCode: code, studentName: name };
    }).filter((s) => s.studentCode && s.studentName);

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

  function sessionLabel(s: { dayOfWeek: string; startTime: string }) {
    return `${s.dayOfWeek} at ${s.startTime}`;
  }

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
                  <br />
                  Session assignments can be set individually after import.
                </p>
                <Textarea
                  placeholder={"STU010, Ahmed Hassan\nSTU011, Sara Ali\nSTU012, Omar Mahmoud"}
                  className="min-h-[180px] font-mono text-sm"
                  value={bulkData}
                  onChange={(e) => setBulkData(e.target.value)}
                />
                <Button
                  onClick={handleBulkImport}
                  className="w-full"
                  disabled={bulkCreateMutation.isPending || !bulkData.trim()}
                >
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
              <form onSubmit={handleAdd} className="space-y-5 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="code">Student Code</Label>
                  <Input
                    id="code"
                    placeholder="e.g. STU004"
                    className="font-mono uppercase"
                    value={newStudent.studentCode}
                    onChange={(e) => setNewStudent({ ...newStudent, studentCode: e.target.value.toUpperCase() })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Student Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Ahmed Hassan"
                    value={newStudent.studentName}
                    onChange={(e) => setNewStudent({ ...newStudent, studentName: e.target.value })}
                    required
                  />
                </div>

                <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                  <p className="text-sm font-medium text-foreground">Session Assignments</p>
                  <p className="text-xs text-muted-foreground -mt-2">Choose which session this student attends for each lesson</p>

                  {/* Lesson 1 */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Lesson 1 Session</Label>
                    {lesson1Sessions.length === 0 ? (
                      <p className="text-xs text-amber-600">No Lesson 1 sessions configured yet</p>
                    ) : (
                      <Select
                        value={newStudent.lesson1SessionId?.toString() ?? NONE_VALUE}
                        onValueChange={(v) =>
                          setNewStudent({ ...newStudent, lesson1SessionId: v === NONE_VALUE ? null : parseInt(v, 10) })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select session..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>Not assigned</SelectItem>
                          {lesson1Sessions.map((s) => (
                            <SelectItem key={s.id} value={s.id.toString()}>
                              {sessionLabel(s)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Lesson 2 */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Lesson 2 Session</Label>
                    {lesson2Sessions.length === 0 ? (
                      <p className="text-xs text-amber-600">No Lesson 2 sessions configured yet</p>
                    ) : (
                      <Select
                        value={newStudent.lesson2SessionId?.toString() ?? NONE_VALUE}
                        onValueChange={(v) =>
                          setNewStudent({ ...newStudent, lesson2SessionId: v === NONE_VALUE ? null : parseInt(v, 10) })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select session..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>Not assigned</SelectItem>
                          {lesson2Sessions.map((s) => (
                            <SelectItem key={s.id} value={s.id.toString()}>
                              {sessionLabel(s)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Lesson 3 */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Lesson 3 Session</Label>
                    {lesson3Sessions.length === 0 ? (
                      <p className="text-xs text-amber-600">No Lesson 3 sessions configured yet</p>
                    ) : (
                      <Select
                        value={newStudent.lesson3SessionId?.toString() ?? NONE_VALUE}
                        onValueChange={(v) =>
                          setNewStudent({ ...newStudent, lesson3SessionId: v === NONE_VALUE ? null : parseInt(v, 10) })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select session..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>Not assigned</SelectItem>
                          {lesson3Sessions.map((s) => (
                            <SelectItem key={s.id} value={s.id.toString()}>
                              {sessionLabel(s)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={createStudentMutation.isPending}>
                  {createStudentMutation.isPending ? "Saving..." : "Add Student"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

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
                  <TableHead className="w-[140px]">Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Lesson 1</TableHead>
                  <TableHead>Lesson 2</TableHead>
                  <TableHead>Lesson 3</TableHead>
                  <TableHead className="text-right w-[60px]"></TableHead>
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
                      <TableCell>
                        <SessionBadge session={student.lesson1Session} />
                      </TableCell>
                      <TableCell>
                        <SessionBadge session={student.lesson2Session} />
                      </TableCell>
                      <TableCell>
                        <SessionBadge session={student.lesson3Session} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm("Delete this student? Their attendance records will also be removed.")) {
                              deleteStudentMutation.mutate({ id: student.id });
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
