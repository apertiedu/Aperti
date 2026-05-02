import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, User, Clock, Camera, Keyboard, Scan } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import QRScanner from "@/components/qr-scanner";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type AttendanceMode = "manual" | "scanner";
type Session = { id: number; lessonNumber: number; dayOfWeek: string; startTime: string; type: string; capacity: number | null };
type AttendanceRecord = { id: number; studentName: string; studentCode: string; status: string; markedAt: string };

interface ScanResult {
  studentCode: string; studentName: string; status: "success" | "error"; message: string;
}

export default function Attendance() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [studentCode, setStudentCode] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [mode, setMode] = useState<AttendanceMode>("manual");
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [marking, setMarking] = useState(false);
  const scanFlashRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const todayName = DAY_NAMES[new Date().getDay()];
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const currentSessionId = selectedSessionId ? parseInt(selectedSessionId, 10) : undefined;

  // Load sessions once
  useEffect(() => {
    fetch("/api/sessions", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((data: Session[]) => {
        setSessions(data);
        if (!selectedSessionId && data.length > 0) {
          const preferred = data.find(s => s.dayOfWeek === todayName) || data[0];
          if (preferred) setSelectedSessionId(preferred.id.toString());
        }
      });
  }, []);

  // Reload attendance when session changes
  const loadAttendance = useCallback(() => {
    if (!currentSessionId) return;
    fetch(`/api/attendance?sessionId=${currentSessionId}&date=${todayStr}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : []).then(setAttendanceRecords);
  }, [currentSessionId, todayStr]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  const markAttendance = async (code: string) => {
    if (!code.trim() || !currentSessionId || marking) return;
    setMarking(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentCode: code.trim(), sessionId: currentSessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Student not found");
      loadAttendance();
      if (mode === "manual") {
        setStudentCode("");
        toast({ title: "Attendance marked", description: `${data.studentName} (${data.studentCode}) — Present` });
        setTimeout(() => inputRef.current?.focus(), 100);
      } else {
        setLastScan({ studentCode: data.studentCode, studentName: data.studentName, status: "success", message: "Attendance recorded!" });
        clearTimeout(scanFlashRef.current);
        scanFlashRef.current = setTimeout(() => setLastScan(null), 3000);
      }
    } catch (err: any) {
      const msg = err.message || "Student not found";
      if (mode === "manual") {
        toast({ title: "Error", description: msg, variant: "destructive" });
        setTimeout(() => inputRef.current?.focus(), 100);
      } else {
        setLastScan({ studentCode: "", studentName: "", status: "error", message: msg });
        clearTimeout(scanFlashRef.current);
        scanFlashRef.current = setTimeout(() => setLastScan(null), 2500);
      }
    } finally { setMarking(false); }
  };

  const handleManualMark = (e: React.FormEvent) => { e.preventDefault(); markAttendance(studentCode); };
  const handleQRDetected = useCallback((code: string) => { markAttendance(code); }, [currentSessionId, marking]);

  const presentRecords = attendanceRecords.filter(r => r.status === "Present");
  const selectedSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mark Attendance</h1>
          <p className="text-muted-foreground mt-1">{todayName} — {format(new Date(), "dd MMMM yyyy")}</p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {([["manual", "Manual", Keyboard], ["scanner", "QR Scanner", Scan]] as const).map(([m, label, Icon]) => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Session selector */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 space-y-1 min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Session</p>
              <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                <SelectTrigger className="bg-muted/30"><SelectValue placeholder="Select a session" /></SelectTrigger>
                <SelectContent>
                  {sessions.length === 0
                    ? <SelectItem value="none" disabled>No sessions configured</SelectItem>
                    : sessions.slice().sort((a, b) => a.lessonNumber - b.lessonNumber).map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        <span className="flex items-center gap-2">
                          Lesson {s.lessonNumber}
                          <span className="text-muted-foreground text-xs">{s.dayOfWeek} {s.startTime}</span>
                          {s.dayOfWeek === todayName && <span className="text-primary text-xs font-medium">Today</span>}
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {selectedSession && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap">
                <Clock className="h-4 w-4" />
                Lesson {selectedSession.lessonNumber} · {selectedSession.startTime} · {selectedSession.dayOfWeek}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Input column */}
        <div className="md:col-span-2 space-y-4">
          {mode === "manual" ? (
            <Card className="border-2 border-primary/30 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Keyboard className="h-4 w-4" />Enter Student Code</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleManualMark} className="space-y-3">
                  <Input ref={inputRef} autoFocus placeholder="e.g. STU001"
                    className="h-14 text-xl font-mono uppercase tracking-widest text-center"
                    value={studentCode} onChange={e => setStudentCode(e.target.value.toUpperCase())}
                    disabled={!currentSessionId || marking} autoComplete="off" />
                  <Button type="submit" size="lg" className="w-full h-12 text-base font-semibold"
                    disabled={!studentCode.trim() || !currentSessionId || marking}>
                    {marking ? "Marking..." : "Mark Attendance"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <Card className="border-2 border-primary/30 shadow-sm overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><Camera className="h-4 w-4" />QR Code Scanner</CardTitle>
                  <p className="text-xs text-muted-foreground">Point the camera at a student's QR code.</p>
                </CardHeader>
                <CardContent className="pb-4">
                  {!currentSessionId
                    ? <div className="w-full aspect-video bg-muted rounded-xl flex items-center justify-center text-muted-foreground text-sm">Select a session first</div>
                    : <QRScanner onDetected={handleQRDetected} cooldownMs={2500} active={mode === "scanner" && !!currentSessionId} />
                  }
                </CardContent>
              </Card>
              {lastScan && (
                <div className={`rounded-xl p-4 flex items-center gap-3 transition-all ${lastScan.status === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
                  <div className={`rounded-full p-2 ${lastScan.status === "success" ? "bg-emerald-100" : "bg-red-100"}`}>
                    {lastScan.status === "success" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <User className="h-5 w-5 text-red-600" />}
                  </div>
                  <div>
                    {lastScan.status === "success"
                      ? <><p className="font-semibold text-sm">{lastScan.studentName}</p><p className="text-xs opacity-70">{lastScan.studentCode} · Attendance recorded</p></>
                      : <p className="text-sm font-medium">{lastScan.message}</p>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Records column */}
        <Card className="md:col-span-3 border-border/50 shadow-sm flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Today's Present</CardTitle>
            <div className="text-sm font-medium bg-primary/10 text-primary px-3 py-1 rounded-full">
              {presentRecords.length} student{presentRecords.length !== 1 ? "s" : ""}
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto max-h-[480px]">
            {!currentSessionId ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border border-dashed rounded-md">
                <User className="h-10 w-10 mb-2 opacity-20" /><p className="text-sm">Select a session to view records</p>
              </div>
            ) : presentRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border border-dashed rounded-md">
                <CheckCircle2 className="h-10 w-10 mb-2 opacity-20" /><p className="text-sm">No students marked yet</p>
                <p className="text-xs mt-1 opacity-70">{mode === "scanner" ? "Scan a QR code to mark attendance" : "Enter a student code above"}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {presentRecords.map(record => (
                  <div key={record.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                        {record.studentName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{record.studentName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{record.studentCode}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="font-mono text-xs">{format(new Date(record.markedAt), "HH:mm")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
