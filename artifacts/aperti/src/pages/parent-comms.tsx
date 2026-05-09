import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Copy, CheckCheck, Phone, Search, AlertTriangle, Send, Bell, Users, Radio, Loader2, CheckCircle2, Info, XCircle } from "lucide-react";

type Student = { id: number; studentCode: string; studentName: string; phone: string | null; parentPhone: string | null; status: string };
type Session = { id: number; lessonNumber: number; dayOfWeek: string; startTime: string; subjectName: string };

const NOTIF_TYPES = [
  { value: "info", label: "Info", icon: Info, color: "text-blue-600 border-blue-200 bg-blue-50" },
  { value: "warning", label: "Warning", icon: AlertTriangle, color: "text-amber-600 border-amber-200 bg-amber-50" },
  { value: "success", label: "Success", icon: CheckCircle2, color: "text-emerald-600 border-emerald-200 bg-emerald-50" },
  { value: "error", label: "Urgent", icon: XCircle, color: "text-red-600 border-red-200 bg-red-50" },
];

function BroadcastPanel({ students }: { students: Student[] }) {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [target, setTarget] = useState<"all" | "session" | "specific">("all");
  const [sessionId, setSessionId] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [notifType, setNotifType] = useState("info");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/sessions", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((rows: any[]) => setSessions(rows.map(s => ({
        id: s.id, lessonNumber: s.lessonNumber, dayOfWeek: s.dayOfWeek,
        startTime: s.startTime, subjectName: s.subjectName ?? "No Subject",
      }))));
  }, []);

  const toggleStudent = (id: number) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const filteredStudents = students.filter(s =>
    s.studentName.toLowerCase().includes(search.toLowerCase()) || s.studentCode.toLowerCase().includes(search.toLowerCase())
  );

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Title and message are required", variant: "destructive" }); return;
    }
    if (target === "specific" && selectedIds.size === 0) {
      toast({ title: "Select at least one student", variant: "destructive" }); return;
    }
    setSending(true);
    try {
      const body: any = { title: title.trim(), message: message.trim(), type: notifType, link: link || undefined, target };
      if (target === "session" && sessionId !== "all") body.sessionId = sessionId;
      if (target === "specific") body.studentIds = Array.from(selectedIds);
      const res = await fetch("/api/notifications/broadcast", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const { sent } = await res.json();
      toast({ title: `Notification sent to ${sent} student${sent !== 1 ? "s" : ""}` });
      setTitle(""); setMessage(""); setLink(""); setSelectedIds(new Set());
    } catch {
      toast({ title: "Failed to send notification", variant: "destructive" });
    } finally { setSending(false); }
  };

  const currentType = NOTIF_TYPES.find(t => t.value === notifType)!;

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3 border-b border-border/50">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" /> Push Notification Broadcast
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">Send in-app notifications directly to students' notification bell</p>
      </CardHeader>
      <CardContent className="pt-5 space-y-4">
        {/* Target */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Recipients</Label>
          <div className="grid grid-cols-3 gap-2">
            {([["all", "All Students", Users], ["session", "By Session", Radio], ["specific", "Select Students", Users]] as const).map(([val, lbl, Icon]) => (
              <button key={val} onClick={() => setTarget(val as any)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${target === val ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40 hover:bg-muted/50 text-muted-foreground"}`}>
                <Icon className="w-3.5 h-3.5" /> {lbl}
              </button>
            ))}
          </div>
          {target === "session" && (
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select session…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sessions</SelectItem>
                {sessions.map(s => <SelectItem key={s.id} value={String(s.id)}>L{s.lessonNumber} · {s.dayOfWeek} {s.startTime?.slice(0, 5)} · {s.subjectName}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {target === "specific" && (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="p-2 border-b border-border bg-muted/30">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-8 h-8 text-xs" placeholder="Search students…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              </div>
              <div className="max-h-44 overflow-y-auto divide-y divide-border/60">
                {filteredStudents.map(s => (
                  <button key={s.id} onClick={() => toggleStudent(s.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/40 transition-colors ${selectedIds.has(s.id) ? "bg-primary/5" : ""}`}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${selectedIds.has(s.id) ? "border-primary bg-primary" : "border-border"}`}>
                      {selectedIds.has(s.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm font-medium truncate">{s.studentName}</span>
                    <span className="text-xs text-muted-foreground font-mono ml-auto shrink-0">{s.studentCode}</span>
                  </button>
                ))}
              </div>
              {selectedIds.size > 0 && (
                <div className="p-2 bg-primary/5 border-t border-border text-xs text-primary font-semibold">
                  {selectedIds.size} student{selectedIds.size !== 1 ? "s" : ""} selected
                </div>
              )}
            </div>
          )}
        </div>

        {/* Type */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Notification Type</Label>
          <div className="grid grid-cols-4 gap-2">
            {NOTIF_TYPES.map(t => (
              <button key={t.value} onClick={() => setNotifType(t.value)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-bold border-2 transition-all ${notifType === t.value ? t.color + " border-current" : "border-border hover:bg-muted/50 text-muted-foreground"}`}>
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Title <span className="text-red-500">*</span></Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Exam Tomorrow at 10am" className="h-9 text-sm" maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Link (optional)</Label>
            <Input value={link} onChange={e => setLink(e.target.value)} placeholder="/exams or /timetable" className="h-9 text-sm" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Message <span className="text-red-500">*</span></Label>
          <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Write your notification message here…" className="text-sm resize-none" maxLength={500} />
          <p className="text-xs text-muted-foreground text-right">{message.length}/500</p>
        </div>

        {/* Preview */}
        {(title || message) && (
          <div className={`rounded-xl border-2 p-3 flex items-start gap-3 ${currentType.color}`}>
            <currentType.icon className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">{title || "Notification title"}</p>
              <p className="text-xs mt-0.5 opacity-80">{message || "Notification message…"}</p>
            </div>
            <Badge variant="secondary" className="text-[10px] shrink-0">{currentType.label}</Badge>
          </div>
        )}

        <Button className="w-full gap-2 h-10" onClick={handleSend} disabled={sending}>
          {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> Send Notification</>}
        </Button>
      </CardContent>
    </Card>
  );
}

const MESSAGE_TYPES = [
  { value: "absence", label: "Today's Absence", icon: "📅" },
  { value: "low-attendance", label: "Low Attendance Alert", icon: "⚠️" },
  { value: "exam-reminder", label: "Exam Reminder", icon: "📝" },
  { value: "low-performance", label: "Low Performance Alert", icon: "📉" },
  { value: "weekly-summary", label: "Weekly Summary", icon: "📊" },
  { value: "custom", label: "Custom Message", icon: "✏️" },
];

export default function ParentComms() {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [messageType, setMessageType] = useState("absence");
  const [customNote, setCustomNote] = useState("");
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return d.toISOString().split("T")[0];
  });
  const [generatedMsg, setGeneratedMsg] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bulkMessages, setBulkMessages] = useState<{ student: Student; message: string }[]>([]);
  const [bulkGenerating, setBulkGenerating] = useState(false);

  useEffect(() => {
    fetch("/api/students", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(setStudents)
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter(s =>
    s.studentName.toLowerCase().includes(search.toLowerCase()) ||
    s.studentCode.toLowerCase().includes(search.toLowerCase())
  );

  const handleGenerate = async () => {
    if (!selectedStudent) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/students/${selectedStudent.id}/whatsapp-message`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: messageType, weekStart, customNote }),
      });
      if (!res.ok) throw new Error("Failed to generate message");
      const data = await res.json();
      setGeneratedMsg(data.message);
    } catch { toast({ title: "Error generating message", variant: "destructive" }); }
    finally { setGenerating(false); }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedMsg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Message copied to clipboard" });
  };

  const handleOpenWhatsApp = (phone: string) => {
    const clean = phone.replace(/\D/g, "");
    const msg = encodeURIComponent(generatedMsg);
    window.open(`https://wa.me/${clean}?text=${msg}`, "_blank");
  };

  const handleBulkAbsent = async () => {
    setBulkGenerating(true);
    const atRisk = students.filter(s => s.status === "active");
    const results: { student: Student; message: string }[] = [];
    for (const student of atRisk.slice(0, 20)) {
      try {
        const res = await fetch(`/api/students/${student.id}/whatsapp-message`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "absence" }),
        });
        if (res.ok) { const d = await res.json(); results.push({ student, message: d.message }); }
      } catch { }
    }
    setBulkMessages(results);
    setBulkGenerating(false);
    toast({ title: `Generated ${results.length} messages` });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-7 w-7 text-green-600" />Parent Communication
          </h1>
          <p className="text-muted-foreground mt-1">Generate WhatsApp messages for parents about attendance, exams, and performance.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student selector */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-9 h-9 text-sm" placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="text-center py-6 text-muted-foreground text-sm">Loading...</div>
            ) : filtered.map(s => (
              <button
                key={s.id}
                onClick={() => { setSelectedStudent(s); setGeneratedMsg(""); }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${selectedStudent?.id === s.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                <p className="font-medium truncate">{s.studentName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] ${selectedStudent?.id === s.id ? "text-primary-foreground/70" : "text-muted-foreground"} font-mono`}>{s.studentCode}</span>
                  {(s.phone || s.parentPhone) && <Phone className="h-2.5 w-2.5" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Message generator */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedStudent ? (
            <Card className="border-dashed h-64 flex items-center justify-center">
              <CardContent className="text-center text-muted-foreground">
                <MessageSquare className="h-10 w-10 opacity-20 mx-auto mb-3" />
                <p>Select a student to generate a message</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="text-base">
                    Message for: <span className="text-primary">{selectedStudent.studentName}</span>
                  </CardTitle>
                  {(selectedStudent.phone || selectedStudent.parentPhone) && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      {selectedStudent.phone && <span><Phone className="h-3 w-3 inline mr-1" />Student: {selectedStudent.phone}</span>}
                      {selectedStudent.parentPhone && <span><Phone className="h-3 w-3 inline mr-1" />Parent: {selectedStudent.parentPhone}</span>}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label>Message Type</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {MESSAGE_TYPES.map(t => (
                        <button
                          key={t.value}
                          onClick={() => { setMessageType(t.value); setGeneratedMsg(""); }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${messageType === t.value ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40 hover:bg-muted/50"}`}
                        >
                          <span>{t.icon}</span>{t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {messageType === "custom" && (
                    <div className="space-y-1.5">
                      <Label>Custom Message Content</Label>
                      <Textarea rows={3} placeholder="Enter your message..." value={customNote} onChange={e => setCustomNote(e.target.value)} />
                    </div>
                  )}

                  {(messageType === "exam-reminder" || messageType === "weekly-summary") && (
                    <div className="space-y-1.5">
                      <Label>Reference Date</Label>
                      <Input type="date" className="w-44" value={weekStart} onChange={e => setWeekStart(e.target.value)} />
                    </div>
                  )}

                  <Button className="w-full gap-2" onClick={handleGenerate} disabled={generating}>
                    <Send className="h-4 w-4" />
                    {generating ? "Generating..." : "Generate Message"}
                  </Button>
                </CardContent>
              </Card>

              {generatedMsg && (
                <Card className="border-green-200 bg-green-50/50 shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm text-green-800">Generated Message</CardTitle>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="gap-2 h-8" onClick={handleCopy}>
                          {copied ? <CheckCheck className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                          {copied ? "Copied!" : "Copy"}
                        </Button>
                        {selectedStudent.parentPhone && (
                          <Button size="sm" className="gap-2 h-8 bg-green-600 hover:bg-green-700" onClick={() => handleOpenWhatsApp(selectedStudent.parentPhone!)}>
                            <MessageSquare className="h-3.5 w-3.5" />WhatsApp
                          </Button>
                        )}
                        {selectedStudent.phone && (
                          <Button size="sm" variant="outline" className="gap-2 h-8" onClick={() => handleOpenWhatsApp(selectedStudent.phone!)}>
                            <MessageSquare className="h-3.5 w-3.5" />Student
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-white rounded-lg p-4 border border-green-200 whitespace-pre-wrap text-sm font-mono text-gray-800 leading-relaxed">
                      {generatedMsg}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bulk generation */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />Bulk Absence Messages
            </CardTitle>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleBulkAbsent} disabled={bulkGenerating}>
              <Send className="h-3.5 w-3.5" />
              {bulkGenerating ? "Generating..." : "Generate for All Students"}
            </Button>
          </div>
        </CardHeader>
        {bulkMessages.length > 0 && (
          <CardContent className="p-4">
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {bulkMessages.map(({ student, message }) => (
                <div key={student.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{student.studentName}</p>
                      <span className="text-xs font-mono text-muted-foreground">{student.studentCode}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{message.split("\n")[0]}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => { await navigator.clipboard.writeText(message); toast({ title: "Copied" }); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                    {student.parentPhone && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => { const c = student.parentPhone!.replace(/\D/g, ""); window.open(`https://wa.me/${c}?text=${encodeURIComponent(message)}`, "_blank"); }}>
                        <MessageSquare className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Push Notification Broadcast */}
      <BroadcastPanel students={students} />
    </div>
  );
}
