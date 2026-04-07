import { useState, useEffect, useRef } from "react";
import {
  useListSessions,
  useMarkAttendance,
  useListAttendance,
  getListSessionsQueryKey,
  getListAttendanceQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, User, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Attendance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [studentCode, setStudentCode] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  const todayName = DAY_NAMES[new Date().getDay()];
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const { data: sessions } = useListSessions({
    query: { queryKey: getListSessionsQueryKey() },
  });

  // Sessions that occur today (matching day of week)
  const todaySessions = sessions?.filter((s) => s.dayOfWeek === todayName) || [];
  // All sessions available (for flexibility — student can attend any session)
  const allSessions = sessions || [];

  // Auto-select first today's session, fallback to first session overall
  useEffect(() => {
    if (!selectedSessionId && sessions && sessions.length > 0) {
      const preferred = todaySessions[0] || sessions[0];
      if (preferred) setSelectedSessionId(preferred.id.toString());
    }
  }, [sessions]);

  const currentSessionId = selectedSessionId ? parseInt(selectedSessionId, 10) : undefined;

  const { data: attendanceRecords } = useListAttendance(
    { sessionId: currentSessionId, date: todayStr },
    {
      query: {
        enabled: !!currentSessionId,
        queryKey: getListAttendanceQueryKey({ sessionId: currentSessionId, date: todayStr }),
      },
    }
  );

  const markAttendanceMutation = useMarkAttendance({
    mutation: {
      onSuccess: (data) => {
        setStudentCode("");
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey({ sessionId: currentSessionId, date: todayStr }) });
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
        const alreadyPresent = data.status === "Present" && attendanceRecords?.some(r => r.id === data.id);
        toast({
          title: alreadyPresent ? "Already marked" : "Attendance marked",
          description: `${data.studentName} (${data.studentCode}) — ${data.status}`,
        });
        setTimeout(() => inputRef.current?.focus(), 100);
      },
      onError: (err: any) => {
        toast({
          title: "Not found",
          description: err?.response?.data?.message || err.message || "Student code not recognised.",
          variant: "destructive",
        });
        setTimeout(() => inputRef.current?.focus(), 100);
      },
    },
  });

  const handleMark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentCode.trim() || !currentSessionId) return;
    markAttendanceMutation.mutate({ data: { studentCode: studentCode.trim(), sessionId: currentSessionId } });
  };

  const presentRecords = attendanceRecords?.filter((r) => r.status === "Present") || [];

  const selectedSession = allSessions.find((s) => s.id === currentSessionId);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mark Attendance</h1>
        <p className="text-muted-foreground mt-1">
          {todayName} — {format(new Date(), "dd MMMM yyyy")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="md:col-span-1 space-y-5">
          {/* Session picker */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a session" />
                </SelectTrigger>
                <SelectContent>
                  {allSessions.length === 0 ? (
                    <SelectItem value="none" disabled>No sessions configured</SelectItem>
                  ) : (
                    allSessions
                      .slice()
                      .sort((a, b) => a.lessonNumber - b.lessonNumber)
                      .map((session) => (
                        <SelectItem key={session.id} value={session.id.toString()}>
                          <span className="flex items-center gap-2">
                            Lesson {session.lessonNumber}
                            <span className="text-muted-foreground text-xs">
                              {session.dayOfWeek} {session.startTime}
                            </span>
                            {session.dayOfWeek === todayName && (
                              <span className="text-primary text-xs font-medium">Today</span>
                            )}
                          </span>
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>

              {selectedSession && (
                <div className="rounded-md bg-muted/50 px-3 py-2 text-sm space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{selectedSession.startTime} — {selectedSession.dayOfWeek}</span>
                  </div>
                  {selectedSession.dayOfWeek !== todayName && (
                    <p className="text-xs text-amber-600">Not scheduled today, but attendance is still recorded.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Input card */}
          <Card className="border-2 border-primary/30 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Student Code</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleMark} className="space-y-3">
                <Input
                  ref={inputRef}
                  autoFocus
                  placeholder="e.g. STU001"
                  className="h-14 text-xl font-mono uppercase tracking-widest text-center"
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                  disabled={!currentSessionId || markAttendanceMutation.isPending}
                  autoComplete="off"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-12 text-base font-semibold"
                  disabled={!studentCode.trim() || !currentSessionId || markAttendanceMutation.isPending}
                >
                  {markAttendanceMutation.isPending ? "Marking..." : "Mark Attendance"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right column — today's records */}
        <Card className="md:col-span-2 border-border/50 shadow-sm flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>Today's Records</CardTitle>
            <div className="text-sm font-medium bg-primary/10 text-primary px-3 py-1 rounded-full">
              {presentRecords.length} Present
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            {!currentSessionId ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border border-dashed rounded-md">
                <User className="h-10 w-10 mb-2 opacity-20" />
                <p>Select a session to view records</p>
              </div>
            ) : presentRecords.length > 0 ? (
              <div className="space-y-2">
                {presentRecords.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {record.studentCode.replace(/\D/g, "").slice(-2) || record.studentCode.slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{record.studentName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{record.studentCode}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="font-mono text-xs">{format(new Date(record.markedAt), "HH:mm")}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border border-dashed rounded-md">
                <CheckCircle2 className="h-10 w-10 mb-2 opacity-20" />
                <p>No students marked yet for this session</p>
                <p className="text-xs mt-1">Enter a student code above to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
