import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Html5Qrcode } from "html5-qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  QrCode, Camera, CameraOff, CheckCircle2, XCircle, Clock,
  Users, UserCheck, UserX, RotateCcw, KeyboardIcon,
  MessageCircle, Phone, ExternalLink, Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API = "/api";

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    ...opts,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(opts?.headers as object | undefined),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

interface Lesson {
  id: number;
  lessonNumber: number;
  dayOfWeek: string;
  startTime: string;
  type: string;
}

interface Student {
  id: number;
  studentName: string;
  studentCode: string;
  lesson1SessionId?: number | null;
  lesson2SessionId?: number | null;
  lesson3SessionId?: number | null;
}

interface AttendanceRecord {
  id: number;
  studentId: number;
  studentName: string;
  studentCode: string;
  sessionId: number;
  status: string;
  markedAt: string;
}

type MarkStatus = "Present" | "Late" | "Absent";

interface ScannedEntry {
  studentId: number;
  studentName: string;
  studentCode: string;
  status: MarkStatus;
  at: Date;
}

const STATUS_STYLE: Record<MarkStatus, { bg: string; text: string; icon: React.FC<{ className?: string }> }> = {
  Present: { bg: "bg-primary/10", text: "text-primary", icon: CheckCircle2 },
  Late: { bg: "bg-amber-100", text: "text-amber-700", icon: Clock },
  Absent: { bg: "bg-red-100", text: "text-red-600", icon: XCircle },
};

interface ScanFlash {
  name: string;
  code: string;
  status: MarkStatus;
}

export default function CheckIn() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastCode = useRef("");
  const lastTime = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scanFlash, setScanFlash] = useState<ScanFlash | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [lessonId, setLessonId] = useState("");
  const [scanning, setScanning] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [markStatus, setMarkStatus] = useState<MarkStatus>("Present");
  const [recent, setRecent] = useState<ScannedEntry[]>([]);
  const [notified, setNotified] = useState<Set<number>>(new Set());
  const [notifying, setNotifying] = useState<Set<number>>(new Set());
  const [notifyingAll, setNotifyingAll] = useState(false);

  const { data: lessons = [] } = useQuery<Lesson[]>({
    queryKey: ["lessons"],
    queryFn: () => apiFetch("/lessons"),
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["students"],
    queryFn: () => apiFetch("/students"),
  });

  const { data: records = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ["attendance", lessonId, date],
    queryFn: () => apiFetch(`/attendance?date=${date}&lessonId=${lessonId}`),
    enabled: !!lessonId,
    refetchInterval: 5000,
  });

  const mark = useMutation({
    mutationFn: ({ code, status }: { code: string; status: MarkStatus }) =>
      apiFetch("/attendance/mark-by-code", {
        method: "POST",
        body: JSON.stringify({ studentCode: code.toUpperCase(), lessonId: Number(lessonId), date, status }),
      }),
    onSuccess: (data, vars) => {
      const entry: ScannedEntry = {
        studentId: data.student.id,
        studentName: data.student.name,
        studentCode: data.student.code,
        status: vars.status,
        at: new Date(),
      };
      setRecent(prev => [entry, ...prev.filter(e => e.studentId !== data.student.id)].slice(0, 20));
      setScanFlash({ name: data.student.name, code: data.student.code, status: vars.status });
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setScanFlash(null), 2400);
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (err: Error) => {
      toast({ title: "Not found", description: err.message, variant: "destructive", duration: 2000 });
    },
  });

  const handleCode = useCallback((code: string, status?: MarkStatus) => {
    if (!lessonId) {
      toast({ title: "Select a lesson first", variant: "destructive", duration: 1500 });
      return;
    }
    const now = Date.now();
    if (code === lastCode.current && now - lastTime.current < 3000) return;
    lastCode.current = code;
    lastTime.current = now;
    mark.mutate({ code, status: status ?? markStatus });
  }, [lessonId, mark, markStatus, toast]);

  const startScanner = useCallback(async () => {
    if (scannerRef.current) return;
    const scanner = new Html5Qrcode("qr-scanner-el");
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text: string) => handleCode(text),
        () => {},
      );
      setScanning(true);
    } catch {
      scannerRef.current = null;
      toast({ title: "Camera unavailable", description: "Use manual entry instead", variant: "destructive" });
      setManualMode(true);
    }
  }, [handleCode, toast]);

  const stopScanner = useCallback(async () => {
    if (!scannerRef.current) return;
    try { await scannerRef.current.stop(); } catch {}
    scannerRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => () => {
    scannerRef.current?.stop().catch(() => {});
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  // students in selected lesson
  const lessonStudents = lessonId
    ? students.filter(s =>
        s.lesson1SessionId === Number(lessonId) ||
        s.lesson2SessionId === Number(lessonId) ||
        s.lesson3SessionId === Number(lessonId)
      )
    : [];

  const markedIds = new Set(records.map(r => r.studentId));
  const unMarked = lessonStudents.filter(s => !markedIds.has(s.id));
  const presentCount = records.filter(r => r.status === "Present" || r.status === "Late").length;
  const rate = lessonStudents.length ? Math.round((presentCount / lessonStudents.length) * 100) : 0;
  const absentRecords = records.filter(r => r.status === "Absent");

  const sendWhatsApp = async (record: AttendanceRecord) => {
    const lessonObj = lessons.find(l => l.id === record.sessionId);
    const lessonLabel = lessonObj ? `Lesson #${lessonObj.lessonNumber} (${lessonObj.dayOfWeek})` : "Today's Lesson";
    setNotifying(prev => new Set(prev).add(record.studentId));
    try {
      const res = await apiFetch("/absence-notify/send", {
        method: "POST",
        body: JSON.stringify({
          studentId: record.studentId,
          studentName: record.studentName,
          status: record.status,
          lessonName: lessonLabel,
          date,
        }),
      });
      if (res.ok && res.waUrl) {
        window.open(res.waUrl, "_blank");
        setNotified(prev => new Set(prev).add(record.studentId));
        toast({ title: `WhatsApp opened for ${record.studentName}`, duration: 2500 });
      } else {
        toast({
          title: "No parent phone on record",
          description: `Add ${record.studentName}'s parent number in SubPilot → Notifications.`,
          variant: "destructive",
          duration: 5000,
        });
      }
    } catch {
      toast({ title: "Failed to send notification", variant: "destructive", duration: 2000 });
    } finally {
      setNotifying(prev => { const s = new Set(prev); s.delete(record.studentId); return s; });
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-4 md:p-6">
      {/* Scan success flash overlay */}
      <AnimatePresence>
        {scanFlash && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.div
              className="bg-card rounded-2xl shadow-2xl border border-border px-8 py-7 flex flex-col items-center gap-3 mx-4"
              style={{ maxWidth: 300 }}
              initial={{ scale: 0.82, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
            >
              <motion.div
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 22, delay: 0.04 }}
                className={cn(
                  "h-16 w-16 rounded-full flex items-center justify-center",
                  STATUS_STYLE[scanFlash.status].bg
                )}
              >
                {(() => {
                  const I = STATUS_STYLE[scanFlash.status].icon;
                  return <I className={cn("h-8 w-8", STATUS_STYLE[scanFlash.status].text)} />;
                })()}
              </motion.div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">{scanFlash.name}</p>
                <p className="text-xs font-mono text-gray-400 mt-0.5">{scanFlash.code}</p>
              </div>
              <span className={cn(
                "px-3 py-1 rounded-full text-sm font-semibold border-0",
                STATUS_STYLE[scanFlash.status].bg,
                STATUS_STYLE[scanFlash.status].text
              )}>
                {scanFlash.status}
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <QrCode className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CheckIn</h1>
            <p className="text-sm text-gray-500">Scan student QR codes to take attendance instantly</p>
          </div>
        </div>
      </motion.div>

      {/* Controls row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <Select value={lessonId} onValueChange={v => { setLessonId(v); setRecent([]); }}>
          <SelectTrigger className="bg-background border-input h-10">
            <SelectValue placeholder="Select lesson…" />
          </SelectTrigger>
          <SelectContent>
            {lessons.length === 0 && (
              <SelectItem value="_" disabled>No lessons found</SelectItem>
            )}
            {lessons.map(l => (
              <SelectItem key={l.id} value={String(l.id)}>
                Lesson #{l.lessonNumber} · {l.dayOfWeek} {l.startTime}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="bg-background border-input h-10"
        />

        <Select value={markStatus} onValueChange={(v: MarkStatus) => setMarkStatus(v)}>
          <SelectTrigger className="bg-background border-input h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Present">Mark as Present</SelectItem>
            <SelectItem value="Late">Mark as Late</SelectItem>
            <SelectItem value="Absent">Mark as Absent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      {lessonId && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-3 gap-3 mb-5">
          {[
            { icon: Users, label: "Total", value: lessonStudents.length, cls: "text-gray-500 bg-gray-100" },
            { icon: UserCheck, label: "Marked Present", value: presentCount, cls: "text-primary bg-primary/10" },
            { icon: UserX, label: "Not Marked", value: unMarked.length, cls: "text-red-500 bg-red-50" },
          ].map(s => (
            <Card key={s.label} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0", s.cls.split(" ").slice(1).join(" "))}>
                  <s.icon className={cn("h-4 w-4", s.cls.split(" ")[0])} />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none mb-0.5">{s.value}</p>
                  <p className="text-xs text-gray-400">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Left: Scanner */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b bg-card">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Camera className="h-4 w-4 text-primary" />
                  QR Scanner
                </CardTitle>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => { setManualMode(m => !m); if (scanning) stopScanner(); }}
                  className="text-xs text-gray-500 gap-1.5 h-7"
                >
                  <KeyboardIcon className="h-3.5 w-3.5" />
                  {manualMode ? "Camera" : "Manual"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {!lessonId && (
                <div className="rounded-xl border-2 border-dashed border-gray-200 p-10 text-center">
                  <QrCode className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Select a lesson to start scanning</p>
                </div>
              )}

              {lessonId && !manualMode && (
                <>
                  <div
                    id="qr-scanner-el"
                    className={cn("rounded-xl overflow-hidden bg-gray-900", !scanning && "hidden")}
                    style={{ minHeight: scanning ? 260 : 0 }}
                  />
                  {!scanning && (
                    <div className="rounded-xl border-2 border-dashed border-gray-200 p-10 text-center space-y-3">
                      <Camera className="h-10 w-10 text-gray-300 mx-auto" />
                      <p className="text-sm text-gray-400">Camera is off</p>
                      <Button
                        onClick={startScanner}
                        className="bg-primary hover:opacity-90 text-white gap-2"
                      >
                        <Camera className="h-4 w-4" /> Start Camera
                      </Button>
                    </div>
                  )}
                  {scanning && (
                    <>
                      <motion.p
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="flex items-center gap-2 text-xs text-primary justify-center"
                      >
                        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        Live — point QR at the green box
                      </motion.p>
                      <Button
                        onClick={stopScanner} variant="outline" size="sm"
                        className="w-full gap-2 text-gray-500 h-8"
                      >
                        <CameraOff className="h-3.5 w-3.5" /> Stop Camera
                      </Button>
                    </>
                  )}
                </>
              )}

              {lessonId && manualMode && (
                <form
                  onSubmit={e => { e.preventDefault(); if (manualCode.trim()) { handleCode(manualCode.trim()); setManualCode(""); } }}
                  className="space-y-3"
                >
                  <div className="rounded-xl border-2 border-dashed border-primary/25 bg-primary/5 p-6 text-center space-y-3">
                    <KeyboardIcon className="h-8 w-8 text-primary/30 mx-auto" />
                    <p className="text-xs text-gray-500">Enter the student code printed on their QR card</p>
                    <div className="flex gap-2">
                      <Input
                        value={manualCode}
                        onChange={e => setManualCode(e.target.value.toUpperCase())}
                        placeholder="e.g. STU001"
                        className="text-center font-mono bg-background"
                        autoFocus
                      />
                      <Button type="submit" className="bg-primary hover:opacity-90 text-white">
                        Mark
                      </Button>
                    </div>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Recent scans */}
          <AnimatePresence>
            {recent.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2 border-b">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-gray-600">Just Scanned</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setRecent([])} className="h-6 px-2 text-xs text-gray-400">
                        <RotateCcw className="h-3 w-3 mr-1" /> Clear
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 max-h-52 overflow-y-auto divide-y">
                    {recent.slice(0, 10).map(entry => {
                      const S = STATUS_STYLE[entry.status];
                      return (
                        <motion.div
                          key={`${entry.studentId}-${entry.at.getTime()}`}
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-3 px-4 py-2.5"
                        >
                          <div className={cn("h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0", S.bg)}>
                            <S.icon className={cn("h-3.5 w-3.5", S.text)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{entry.studentName}</p>
                            <p className="text-xs text-gray-400 font-mono">{entry.studentCode}</p>
                          </div>
                          <Badge variant="outline" className={cn("text-xs border-0", S.bg, S.text)}>
                            {entry.status}
                          </Badge>
                        </motion.div>
                      );
                    })}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: Student lists */}
        <div className="lg:col-span-3 space-y-4">
          {!lessonId ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-12 text-center">
                <Users className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Select a lesson to see the student register</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Marked */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-semibold">
                      Marked ({records.length})
                    </CardTitle>
                    {rate > 0 && (
                      <Badge className="ml-auto bg-primary/10 text-primary border-0 text-xs font-medium">
                        {rate}% present
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0 max-h-64 overflow-y-auto divide-y">
                  {records.length === 0 ? (
                    <EmptyState icon="calendar" title="No attendance marked yet" description="Scan a QR code to start recording attendance." compact />
                  ) : (
                    records.map(r => {
                      const S = STATUS_STYLE[r.status as MarkStatus] ?? STATUS_STYLE.Present;
                      return (
                        <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/60">
                          <div className={cn("h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0", S.bg)}>
                            <S.icon className={cn("h-3.5 w-3.5", S.text)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{r.studentName}</p>
                            <p className="text-xs text-gray-400 font-mono">{r.studentCode}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn("text-xs border-0", S.bg, S.text)}>
                              {r.status}
                            </Badge>
                            <span className="text-xs text-gray-300">
                              {new Date(r.markedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              {/* Not yet marked */}
              {unMarked.length > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3 border-b">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <CardTitle className="text-sm font-semibold text-gray-500">
                        Not Yet Marked ({unMarked.length})
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 max-h-64 overflow-y-auto divide-y">
                    {unMarked.map(s => (
                      <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/60 group">
                        <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-xs text-gray-400 font-semibold">
                          {s.studentName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-600">{s.studentName}</p>
                          <p className="text-xs text-gray-400 font-mono">{s.studentCode}</p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                          {(["Present", "Late", "Absent"] as MarkStatus[]).map(st => {
                            const S2 = STATUS_STYLE[st];
                            return (
                              <Button
                                key={st}
                                size="sm" variant="ghost"
                                className={cn("h-6 px-2 text-xs", S2.text, "hover:" + S2.bg)}
                                onClick={() => handleCode(s.studentCode, st)}
                              >
                                {st}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Absent — notify parents via WhatsApp */}
              {absentRecords.length > 0 && (
                <Card className="border-0 shadow-sm border-l-4 border-l-red-400">
                  <CardHeader className="pb-3 border-b">
                    <div className="flex items-center gap-2 flex-wrap gap-y-2">
                      <Bell className="h-4 w-4 text-red-500 shrink-0" />
                      <CardTitle className="text-sm font-semibold text-red-600">
                        Notify Absent Parents — WhatsApp
                      </CardTitle>
                      <Badge className="bg-red-50 text-red-600 border-0 text-xs">
                        {absentRecords.length} absent
                      </Badge>
                      <Button
                        size="sm"
                        onClick={async () => {
                          setNotifyingAll(true);
                          const unnotified = absentRecords.filter(r => !notified.has(r.studentId));
                          for (const r of unnotified) {
                            await sendWhatsApp(r);
                            // Small delay so browser doesn't block multiple window.open calls
                            await new Promise(res => setTimeout(res, 600));
                          }
                          setNotifyingAll(false);
                        }}
                        disabled={notifyingAll || absentRecords.every(r => notified.has(r.studentId))}
                        className="ml-auto h-7 text-xs bg-[#25D366] hover:bg-[#1EBE5A] text-white gap-1.5"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        {notifyingAll
                          ? "Opening…"
                          : absentRecords.every(r => notified.has(r.studentId))
                            ? "All Notified"
                            : `Notify All (${absentRecords.filter(r => !notified.has(r.studentId)).length})`}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 divide-y">
                    {absentRecords.map(r => {
                      const done = notified.has(r.studentId);
                      const busy = notifying.has(r.studentId);
                      return (
                        <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60">
                          <div className="h-7 w-7 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                            <XCircle className="h-4 w-4 text-red-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{r.studentName}</p>
                            <p className="text-xs text-gray-400 font-mono">{r.studentCode}</p>
                          </div>
                          {done ? (
                            <Badge className="bg-primary/10 text-primary border-0 text-xs gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Sent
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => sendWhatsApp(r)}
                              disabled={busy}
                              className="h-7 text-xs bg-[#25D366] hover:bg-[#1EBE5A] text-white gap-1.5"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              {busy ? "Opening…" : "WhatsApp"}
                              <ExternalLink className="h-3 w-3 opacity-60" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                    <div className="px-4 py-2.5 bg-amber-50/60">
                      <p className="text-xs text-amber-700 flex items-center gap-1.5">
                        <Phone className="h-3 w-3 shrink-0" />
                        Set parent phone numbers in <strong>SubPilot → Notifications</strong> for instant message generation.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
