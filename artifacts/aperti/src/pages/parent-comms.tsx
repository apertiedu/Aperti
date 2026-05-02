import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { MessageSquare, Copy, CheckCheck, Phone, Search, Filter, AlertTriangle, Send } from "lucide-react";

type Student = { id: number; studentCode: string; studentName: string; phone: string | null; parentPhone: string | null; status: string };

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
    </div>
  );
}
