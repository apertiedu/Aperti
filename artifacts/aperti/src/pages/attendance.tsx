import { useState } from "react";
import {
  useListSessions,
  useMarkAttendance,
  useListAttendance,
  getListSessionsQueryKey,
  getListAttendanceQueryKey,
  Session
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, User, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Attendance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [studentCode, setStudentCode] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  const { data: sessions } = useListSessions({
    query: { queryKey: getListSessionsQueryKey() }
  });

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todaySessions = sessions?.filter((s) => s.date === todayStr) || [];
  
  // Auto-select first session if available
  if (!selectedSessionId && todaySessions.length > 0) {
    setSelectedSessionId(todaySessions[0].id.toString());
  }

  const currentSessionId = parseInt(selectedSessionId, 10);
  const { data: attendanceRecords } = useListAttendance(
    { sessionId: currentSessionId },
    { query: { enabled: !!currentSessionId, queryKey: getListAttendanceQueryKey({ sessionId: currentSessionId }) } }
  );

  const markAttendanceMutation = useMarkAttendance({
    mutation: {
      onSuccess: () => {
        setStudentCode("");
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey({ sessionId: currentSessionId }) });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activity"] });
        toast({
          title: "Attendance marked",
          description: `Student present.`,
        });
        // focus back on input
        document.getElementById("student-code")?.focus();
      },
      onError: (err: any) => {
        toast({
          title: "Error",
          description: err.message || "Failed to mark attendance.",
          variant: "destructive",
        });
      }
    }
  });

  const handleMark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentCode.trim() || !currentSessionId) return;
    markAttendanceMutation.mutate({ data: { studentCode, sessionId: currentSessionId } });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Mark Attendance</h1>
        <p className="text-muted-foreground">Scan or enter student code to mark present.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Session Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Session</Label>
                  <Select
                    value={selectedSessionId}
                    onValueChange={setSelectedSessionId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a session" />
                    </SelectTrigger>
                    <SelectContent>
                      {todaySessions.length === 0 ? (
                        <SelectItem value="none" disabled>No sessions today</SelectItem>
                      ) : (
                        todaySessions.map((session) => (
                          <SelectItem key={session.id} value={session.id.toString()}>
                            Lesson {session.lessonNumber} ({session.timeSlot})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 shadow-sm border-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Scan Input</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleMark} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="student-code" className="sr-only">Student Code</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="student-code"
                      autoFocus
                      placeholder="e.g. S1001"
                      className="h-12 pl-10 text-lg uppercase font-mono"
                      value={studentCode}
                      onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                      disabled={!currentSessionId || markAttendanceMutation.isPending}
                      autoComplete="off"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-12 text-lg font-medium"
                  disabled={!studentCode.trim() || !currentSessionId || markAttendanceMutation.isPending}
                >
                  {markAttendanceMutation.isPending ? "Marking..." : "Mark Present"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="md:col-span-2 border-border/50 shadow-sm flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Today's Records</CardTitle>
            <div className="text-sm text-muted-foreground font-medium bg-muted px-3 py-1 rounded-full">
              {attendanceRecords?.filter(r => r.status === 'Present').length || 0} Present
            </div>
          </CardHeader>
          <CardContent className="flex-1 pt-4">
            {!currentSessionId ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground border border-dashed rounded-md">
                <User className="h-10 w-10 mb-2 opacity-20" />
                <p>Select a session to view records</p>
              </div>
            ) : attendanceRecords && attendanceRecords.length > 0 ? (
              <div className="space-y-3">
                {attendanceRecords.filter(r => r.status === 'Present').map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-card shadow-sm transition-all hover:border-primary/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {record.studentCode.substring(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{record.studentName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{record.studentCode}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-muted-foreground">
                        {format(new Date(record.markedAt), "HH:mm")}
                      </span>
                    </div>
                  </div>
                ))}
                {attendanceRecords.filter(r => r.status === 'Present').length === 0 && (
                  <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                    <p>No students marked present yet</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground border border-dashed rounded-md">
                <p>No attendance records found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
