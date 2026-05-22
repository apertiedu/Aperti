import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QrCode, Users, CheckCircle, XCircle, Clock } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";
const token = () => localStorage.getItem("aperti_token");

async function fetchJSON(url: string) {
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

interface Lesson {
  id: number;
  lessonNumber: number;
  dayOfWeek: string;
  startTime: string;
  mode: string;
  subjectId: number | null;
}

interface Student {
  id: number;
  studentName: string;
  studentCode: string;
}

export default function CheckIn() {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const { data: lessons, isLoading: lessonsLoading } = useQuery<Lesson[]>({
    queryKey: ["lessons"],
    queryFn: () => fetchJSON("/lessons"),
  });
  const { data: students, isLoading: studentsLoading } = useQuery<Student[]>({
    queryKey: ["students"],
    queryFn: () => fetchJSON("/students"),
  });

  const todayLessons = lessons?.filter((l) => l.dayOfWeek === today) ?? [];

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold">
          CheckIn<span className="text-primary">™</span>
        </h1>
        <p className="text-muted-foreground">
          Take attendance in seconds. No paper, no roll call.
        </p>
      </motion.div>

      {lessonsLoading ? (
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : todayLessons.length === 0 ? (
        <Card className="card-hover">
          <CardContent className="p-8 text-center">
            <Clock className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No lessons scheduled for today.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {todayLessons.map((lesson) => (
            <LessonAttendanceCard
              key={lesson.id}
              lesson={lesson}
              students={students ?? []}
              isLoadingStudents={studentsLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LessonAttendanceCard({
  lesson,
  students,
  isLoadingStudents,
}: {
  lesson: Lesson;
  students: Student[];
  isLoadingStudents: boolean;
}) {
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const passcode = `${lesson.id}-${Date.now()}`; // unique per session
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(passcode)}`;

  const queryClient = useQueryClient();
  const markMutation = useMutation({
    mutationFn: (body: { studentId: number; sessionId: number; date: string; status: string }) =>
      fetch(`${API}/attendance/mark`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify(body),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance"] }),
  });

  const todayDate = new Date().toISOString().split("T")[0];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="card-hover">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Lesson {lesson.lessonNumber} — {lesson.startTime}
              </CardTitle>
              <CardDescription>{lesson.mode} session</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setQrDialogOpen(true)}>
              <QrCode className="h-4 w-4 mr-1" /> QR Code
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-muted-foreground">Session code:</span>
            <Badge variant="secondary" className="font-mono text-sm">
              {passcode}
            </Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingStudents ? (
                <TableRow>
                  <TableCell colSpan={3}><Skeleton className="h-4 w-full" /></TableCell>
                </TableRow>
              ) : students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No students yet.
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>{student.studentName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">—</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="mr-1"
                        onClick={() =>
                          markMutation.mutate({
                            studentId: student.id,
                            sessionId: lesson.id,
                            date: todayDate,
                            status: "Present",
                          })
                        }
                      >
                        <CheckCircle className="h-4 w-4 text-primary" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          markMutation.mutate({
                            studentId: student.id,
                            sessionId: lesson.id,
                            date: todayDate,
                            status: "Absent",
                          })
                        }
                      >
                        <XCircle className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* QR Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>Scan to Check In</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            <img src={qrUrl} alt="QR Code" className="rounded-lg border" />
          </div>
          <p className="text-sm text-muted-foreground">
            Passcode: <strong>{passcode}</strong>
          </p>
          <Button variant="outline" onClick={() => setQrDialogOpen(false)}>
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
