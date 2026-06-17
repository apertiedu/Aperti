import { apiFetch } from "@/lib/api";
import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "qrcode";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, UserPlus, Upload, Search, Clock, Pencil, QrCode, Download, Printer, BarChart2, KeyRound, UserCheck, AlertTriangle, CreditCard } from "lucide-react";
import { AppEmptyState } from "@/components/app-empty-state";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import UpgradeModal from "@/components/upgrade-modal";
import PlanUsageBar from "@/components/plan-usage-bar";

const NONE_VALUE = "__none__";

type Session = { id: number; lessonNumber: number; dayOfWeek: string; startTime: string };
type StudentRecord = {
  id: number;
  studentCode: string;
  studentName: string;
  accountId?: number | null;
  lesson1SessionId?: number | null;
  lesson2SessionId?: number | null;
  lesson3SessionId?: number | null;
  lesson1Session?: Session | null;
  lesson2Session?: Session | null;
  lesson3Session?: Session | null;
};

function sessionLabel(s: Session) { return `${s.dayOfWeek} at ${s.startTime}`; }

function SessionBadge({ session }: { session?: Session | null }) {
  if (!session) return <span className="text-muted-foreground text-xs italic">Not assigned</span>;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
      <Clock className="h-3 w-3" />{session.dayOfWeek} {session.startTime}
    </span>
  );
}

async function generateQRDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 500,
    margin: 2,
    color: { dark: "hsl(var(--primary))", light: "#ffffff" },
    errorCorrectionLevel: "H",
  });
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function getSessionLines(student: StudentRecord): string {
  const slots = [
    { label: "L1", session: student.lesson1Session },
    { label: "L2", session: student.lesson2Session },
    { label: "L3", session: student.lesson3Session },
  ].filter(s => s.session);
  if (!slots.length) return "";
  return slots.map(s => `${s.label}: ${s.session!.dayOfWeek} ${s.session!.startTime}`).join(" &nbsp;·&nbsp; ");
}

function buildIDCardHTML(student: StudentRecord, qrDataUrl: string, cardIndex = 0): string {
  const initials = getInitials(student.studentName);
  const sessionsHtml = getSessionLines(student);

  return `
    <div class="card" style="animation-delay:${cardIndex * 0.05}s">
      <div class="card-header">
        <div class="header-left">
          <div class="brand-logo">Aperti.</div>
          <div class="brand-sub">Educational OS</div>
        </div>
        <div class="avatar">${initials}</div>
      </div>
      <div class="card-body">
        <div class="qr-wrap">
          <img src="${qrDataUrl}" alt="QR" class="qr-img" />
          <div class="qr-label">SCAN FOR ATTENDANCE</div>
        </div>
        <div class="student-info">
          <div class="student-name">${student.studentName}</div>
          <div class="student-code">${student.studentCode}</div>
          ${sessionsHtml ? `<div class="sessions-line">${sessionsHtml}</div>` : ""}
          <div class="issued-label">Aperti Student ID</div>
        </div>
      </div>
      <div class="card-footer">
        <div class="footer-bar"></div>
        <div class="footer-text">
          <span>Attendance QR Card</span>
          <span>${new Date().getFullYear()}</span>
        </div>
      </div>
    </div>`;
}

const ID_CARD_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
  @page { margin: 10mm; size: A4; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',system-ui,sans-serif; background:#f1f5f9; }
  .page-title { text-align:center; padding:16px 0 20px; font-size:11pt; font-weight:700; color:#334155; text-transform:uppercase; letter-spacing:2px; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; padding:0 4px; }
  .card { background:white; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.12); break-inside:avoid; page-break-inside:avoid; }
  .card-header { background:linear-gradient(135deg,hsl(var(--primary)) 0%,#0f766e 55%,#134e4a 100%); padding:11px 13px 9px; display:flex; align-items:flex-start; justify-content:space-between; position:relative; overflow:hidden; }
  .card-header::before { content:''; position:absolute; top:-20px; right:-15px; width:70px; height:70px; border-radius:50%; background:rgba(255,255,255,0.07); }
  .card-header::after { content:''; position:absolute; bottom:-25px; left:-10px; width:55px; height:55px; border-radius:50%; background:rgba(255,255,255,0.05); }
  .brand-logo { font-size:14pt; font-weight:900; color:white; letter-spacing:-0.5px; line-height:1; }
  .brand-sub { font-size:6pt; color:rgba(255,255,255,0.65); text-transform:uppercase; letter-spacing:1.5px; margin-top:2px; }
  .avatar { width:36px; height:36px; border-radius:50%; background:rgba(255,255,255,0.22); border:1.5px solid rgba(255,255,255,0.45); display:flex; align-items:center; justify-content:center; color:white; font-weight:800; font-size:12pt; flex-shrink:0; }
  .card-body { display:flex; padding:10px 12px; gap:10px; align-items:center; min-height:80px; }
  .qr-wrap { display:flex; flex-direction:column; align-items:center; gap:3px; flex-shrink:0; }
  .qr-img { width:68px; height:68px; border-radius:6px; border:1.5px solid #e2e8f0; padding:2px; }
  .qr-label { font-size:4.5pt; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; font-weight:600; }
  .student-info { flex:1; min-width:0; }
  .student-name { font-size:9.5pt; font-weight:800; color:#0f172a; line-height:1.2; word-break:break-word; }
  .student-code { font-family:monospace; font-size:8pt; color:hsl(var(--primary)); font-weight:700; margin-top:2px; }
  .sessions-line { font-size:6pt; color:#64748b; margin-top:5px; line-height:1.4; }
  .issued-label { font-size:5.5pt; color:#cbd5e1; margin-top:6px; text-transform:uppercase; letter-spacing:0.5px; }
  .card-footer { border-top:1px solid #f1f5f9; padding:5px 12px; }
  .footer-bar { height:3px; border-radius:2px; background:linear-gradient(90deg,hsl(var(--primary)),#06b6d4,#8b5cf6); margin-bottom:4px; }
  .footer-text { display:flex; justify-content:space-between; font-size:5.5pt; color:#94a3b8; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
  @media print { body{background:white;} .card{box-shadow:none; border:1px solid #e2e8f0;} .no-print{display:none;} }
`;

function openPrintWindow(title: string, bodyContent: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${ID_CARD_STYLES}</style></head><body>${bodyContent}</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 800);
}

function QRModal({ student }: { student: StudentRecord }) {
  const [qrUrl, setQrUrl] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const { toast } = useToast();

  const handleOpen = async (v: boolean) => {
    setOpen(v);
    if (v && !qrUrl) setQrUrl(await generateQRDataUrl(student.studentCode));
  };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const url = qrUrl || await generateQRDataUrl(student.studentCode);
      if (!qrUrl) setQrUrl(url);
      const html = buildIDCardHTML(student, url);
      openPrintWindow(
        `ID Card — ${student.studentName}`,
        `<div class="page-title">Student ID Card</div><div class="grid" style="grid-template-columns:1fr 1fr;max-width:500px;margin:0 auto;">${html}${html}</div><p style="text-align:center;color:#94a3b8;font-size:8pt;margin-top:16px;" class="no-print">Two copies shown — print and cut as needed.</p>`
      );
      toast({ title: "Print window opened" });
    } finally {
      setPrinting(false);
    }
  };

  const handleDownloadQR = () => {
    if (!qrUrl) return;
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `${student.studentCode}_qr.png`;
    a.click();
    toast({ title: "QR code downloaded" });
  };

  const initials = getInitials(student.studentName);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" title="View ID card">
          <CreditCard className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm p-0 overflow-hidden border-0 shadow-2xl rounded-2xl">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, #0f766e 55%, #134e4a 100%)" }}>
                <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-white/5" />
                <div className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-white/5" />
                <div className="relative px-6 pt-5 pb-6">
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <p className="text-white font-black text-xl leading-none">Aperti.</p>
                      <p className="text-white/60 text-[9px] uppercase tracking-[0.2em] mt-1">Educational OS</p>
                    </div>
                    <motion.div
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      className="h-11 w-11 rounded-full bg-white/20 border border-white/40 flex items-center justify-center"
                    >
                      <span className="text-white font-extrabold text-base">{initials}</span>
                    </motion.div>
                  </div>
                  <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 }}>
                    <p className="text-white font-bold text-lg leading-tight">{student.studentName}</p>
                    <p className="text-white/65 font-mono text-sm mt-0.5 tracking-wider">{student.studentCode}</p>
                    {(student.lesson1Session || student.lesson2Session || student.lesson3Session) && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {[student.lesson1Session, student.lesson2Session, student.lesson3Session].filter(Boolean).map((s, i) => (
                          <span key={i} className="text-[9px] bg-white/15 text-white/80 rounded-full px-2 py-0.5 font-medium">
                            L{i + 1}: {s!.dayOfWeek} {s!.startTime}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </div>
              </div>

              <div className="bg-card">
                <div className="h-1" style={{ background: "linear-gradient(90deg, hsl(var(--primary)), #06b6d4, #8b5cf6)" }} />
                <div className="px-6 py-5 flex flex-col items-center gap-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.15, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="bg-card rounded-2xl p-3 shadow-md border border-border"
                  >
                    {qrUrl ? (
                      <img src={qrUrl} alt="QR code" className="w-44 h-44 rounded-xl" />
                    ) : (
                      <div className="w-44 h-44 bg-gray-100 rounded-xl animate-pulse" />
                    )}
                  </motion.div>
                  <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest">Scan to mark attendance</p>
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="w-full flex gap-2"
                  >
                    <Button
                      variant="outline"
                      className="flex-1 gap-1.5 text-xs"
                      disabled={!qrUrl}
                      onClick={handleDownloadQR}
                    >
                      <Download className="h-3.5 w-3.5" />
                      QR PNG
                    </Button>
                    <Button
                      className="flex-1 gap-1.5 text-xs"
                      style={{ background: "linear-gradient(135deg, hsl(var(--primary)), #0f766e)" }}
                      disabled={printing}
                      onClick={handlePrint}
                    >
                      <Printer className="h-3.5 w-3.5" />
                      {printing ? "Opening…" : "Print Card"}
                    </Button>
                  </motion.div>
                </div>
                <div className="px-6 pb-4 text-center">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Aperti Student ID Card · {new Date().getFullYear()}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function StudentForm({
  initial, sessions, onSave, saving, submitLabel,
}: {
  initial: { studentCode: string; studentName: string; lesson1SessionId: number | null; lesson2SessionId: number | null; lesson3SessionId: number | null };
  sessions: Session[];
  onSave: (data: typeof initial) => void;
  saving: boolean;
  submitLabel: string;
}) {
  const [form, setForm] = useState(initial);
  const lesson1Sessions = sessions.filter(s => s.lessonNumber === 1);
  const lesson2Sessions = sessions.filter(s => s.lessonNumber === 2);
  const lesson3Sessions = sessions.filter(s => s.lessonNumber === 3);

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-5 pt-2">
      <div className="space-y-2">
        <Label>Student Code</Label>
        <Input placeholder="e.g. STU004" className="font-mono" value={form.studentCode} onChange={e => setForm({ ...form, studentCode: e.target.value.toUpperCase() })} required />
      </div>
      <div className="space-y-2">
        <Label>Student Name</Label>
        <Input placeholder="e.g. Ahmed Hassan" value={form.studentName} onChange={e => setForm({ ...form, studentName: e.target.value })} required />
      </div>
      <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
        <div>
          <p className="text-sm font-medium">Session Assignments</p>
          <p className="text-xs text-muted-foreground mt-0.5">Choose the session time slot for each lesson</p>
        </div>
        {([
          { label: "Lesson 1", field: "lesson1SessionId" as const, list: lesson1Sessions },
          { label: "Lesson 2", field: "lesson2SessionId" as const, list: lesson2Sessions },
          { label: "Lesson 3", field: "lesson3SessionId" as const, list: lesson3Sessions },
        ]).map(({ label, field, list }) => (
          <div key={field} className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{label} Session</Label>
            {list.length === 0 ? (
              <p className="text-xs text-amber-600">No {label} sessions configured yet</p>
            ) : (
              <Select value={(form[field] ?? NONE_VALUE).toString()} onValueChange={v => setForm({ ...form, [field]: v === NONE_VALUE ? null : parseInt(v, 10) })}>
                <SelectTrigger><SelectValue placeholder="Select session..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Not assigned</SelectItem>
                  {list.map(s => <SelectItem key={s.id} value={s.id.toString()}>{sessionLabel(s)}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        ))}
      </div>
      <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving..." : submitLabel}</Button>
    </form>
  );
}

export default function Students() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [bulkData, setBulkData] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [createAccountStudent, setCreateAccountStudent] = useState<StudentRecord | null>(null);
  const [createAccountPassword, setCreateAccountPassword] = useState("");
  const [createAccountSaving, setCreateAccountSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState<string | undefined>(undefined);

  const blankStudent = { studentCode: "", studentName: "", lesson1SessionId: null as number | null, lesson2SessionId: null as number | null, lesson3SessionId: null as number | null };

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await apiFetch("/api/students", { credentials: "include" }); if (r.ok) setStudents(await r.json()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    apiFetch("/api/sessions", { credentials: "include" }).then(r => r.ok ? r.json() : []).then(setSessions);
  }, []);

  const handleAdd = async (data: typeof blankStudent) => {
    setAddSaving(true);
    try {
      const res = await apiFetch("/api/students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const json = await res.json().catch(() => ({}));
      if (res.status === 403 && json.code === "LIMIT_EXCEEDED") {
        setUpgradeMsg(json.error); setUpgradeOpen(true); return;
      }
      if (!res.ok) throw new Error(json.error || json.message || "Failed");
      await load(); setIsAddOpen(false); toast({ title: "Student added" });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setAddSaving(false); }
  };

  const handleEdit = async (data: typeof blankStudent) => {
    if (!editingStudent) return;
    setEditSaving(true);
    try {
      const res = await apiFetch(`/api/students/${editingStudent.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Update failed"); }
      await load(); toast({ title: "Student updated" }); setEditingStudent(null);
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setEditSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this student?")) return;
    setDeletingId(id);
    try {
      await apiFetch(`/api/students/${id}`, { method: "DELETE" });
      await load(); toast({ title: "Student removed" });
    } catch { toast({ title: "Error deleting student", variant: "destructive" }); }
    finally { setDeletingId(null); }
  };

  const handleBulkImport = async () => {
    const lines = bulkData.split("\n").filter(l => l.trim());
    const parsed = lines.map(line => { const [code, name] = line.split(",").map(s => s.trim()); return { studentCode: code, studentName: name }; }).filter(s => s.studentCode && s.studentName);
    if (parsed.length === 0) { toast({ title: "No valid rows", variant: "destructive" }); return; }
    setBulkSaving(true);
    try {
      const res = await apiFetch("/api/students/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ students: parsed }) });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data.code === "LIMIT_EXCEEDED") {
        setUpgradeMsg(data.error); setUpgradeOpen(true); return;
      }
      if (!res.ok) throw new Error(data.error || data.message || "Failed");
      await load(); setIsBulkOpen(false); setBulkData("");
      toast({ title: "Import complete", description: `Added ${data.length} student(s)` });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setBulkSaving(false); }
  };

  const handleCreateAccount = async () => {
    if (!createAccountStudent || !createAccountPassword) return;
    setCreateAccountSaving(true);
    try {
      const res = await apiFetch(`/api/students/${createAccountStudent.id}/create-account`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: createAccountPassword }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast({ title: "Error", description: data.message || "Failed", variant: "destructive" }); return; }
      toast({ title: "Login created!", description: `Username: ${data.username}` });
      await load(); setCreateAccountStudent(null); setCreateAccountPassword("");
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setCreateAccountSaving(false); }
  };

  const handlePrintAllIDCards = useCallback(async () => {
    const list = filteredStudents.length > 0 ? filteredStudents : students;
    if (!list.length) return;
    setBulkExporting(true);
    toast({ title: "Generating ID cards…", description: `Processing ${list.length} student${list.length !== 1 ? "s" : ""}` });
    try {
      const withQR = await Promise.all(
        list.map(async (s, i) => ({ student: s, qr: await generateQRDataUrl(s.studentCode), index: i }))
      );
      const cardsHTML = withQR.map(({ student, qr, index }) => buildIDCardHTML(student, qr, index)).join("\n");
      openPrintWindow(
        `Aperti ID Cards — ${list.length} Students`,
        `<div class="page-title">Aperti Student ID Cards &nbsp;·&nbsp; ${list.length} Students &nbsp;·&nbsp; ${new Date().toLocaleDateString("en-GB")}</div><div class="grid">${cardsHTML}</div>`
      );
      toast({ title: "Print window ready", description: "Use your browser's Print to PDF to save." });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setBulkExporting(false);
    }
  }, [students, toast]);

  const filteredStudents = students.filter(s =>
    s.studentName.toLowerCase().includes(search.toLowerCase()) || s.studentCode.toLowerCase().includes(search.toLowerCase())
  );

  const nameCounts = students.reduce((acc, s) => {
    const normalized = s.studentName.trim().toLowerCase();
    acc[normalized] = (acc[normalized] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const isDuplicate = (name: string) => nameCounts[name.trim().toLowerCase()] > 1;
  const duplicateCount = Object.values(nameCounts).filter(c => c > 1).length;

  return (
    <div className="space-y-6">
      <PlanUsageBar resource="students" label="Student Slots" />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Database</h1>
          <p className="text-muted-foreground mt-1">Manage enrolled students and their session assignments.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handlePrintAllIDCards}
            disabled={bulkExporting || !students.length}
          >
            <Printer className="h-4 w-4" />
            {bulkExporting ? "Generating…" : `Print All ID Cards${search ? ` (${filteredStudents.length})` : ""}`}
          </Button>

          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild><Button variant="outline" className="gap-2"><Upload className="h-4 w-4" />Bulk Import</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Bulk Import Students</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">One per line: <span className="font-mono font-medium">StudentCode, StudentName</span></p>
                <Textarea placeholder={"STU010, Ahmed Hassan\nSTU011, Sara Ali"} className="min-h-[160px] font-mono text-sm" value={bulkData} onChange={e => setBulkData(e.target.value)} />
                <Button onClick={handleBulkImport} className="w-full" disabled={bulkSaving || !bulkData.trim()}>{bulkSaving ? "Importing..." : "Import"}</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild><Button className="gap-2"><UserPlus className="h-4 w-4" />Add Student</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Student</DialogTitle></DialogHeader>
              <StudentForm initial={blankStudent} sessions={sessions} onSave={handleAdd} saving={addSaving} submitLabel="Add Student" />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={!!editingStudent} onOpenChange={v => { if (!v) setEditingStudent(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Student — {editingStudent?.studentCode}</DialogTitle></DialogHeader>
          {editingStudent && (
            <StudentForm
              initial={{ studentCode: editingStudent.studentCode, studentName: editingStudent.studentName, lesson1SessionId: editingStudent.lesson1SessionId ?? null, lesson2SessionId: editingStudent.lesson2SessionId ?? null, lesson3SessionId: editingStudent.lesson3SessionId ?? null }}
              sessions={sessions} onSave={handleEdit} saving={editSaving} submitLabel="Save Changes"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!createAccountStudent} onOpenChange={v => { if (!v) { setCreateAccountStudent(null); setCreateAccountPassword(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" />Create Login Account</DialogTitle>
          </DialogHeader>
          {createAccountStudent && (
            <div className="space-y-4 pt-2">
              <div className="bg-muted/40 rounded-lg p-3 text-sm">
                <p className="font-semibold">{createAccountStudent.studentName}</p>
                <p className="text-muted-foreground text-xs mt-0.5">Username will be: <span className="font-mono font-semibold">{createAccountStudent.studentCode.toLowerCase()}</span></p>
              </div>
              <div className="space-y-1.5">
                <Label>Initial Password</Label>
                <Input type="password" placeholder="Min 8 characters" value={createAccountPassword} onChange={e => setCreateAccountPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreateAccount()} maxLength={500} />
              </div>
              <Button className="w-full gap-2" disabled={createAccountSaving || createAccountPassword.length < 8} onClick={handleCreateAccount}>
                <UserCheck className="h-4 w-4" />{createAccountSaving ? "Creating..." : "Create Account"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {duplicateCount > 0 && (
        <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <span><strong>{duplicateCount}</strong> student name{duplicateCount > 1 ? "s appear" : " appears"} more than once — review for duplicates.</span>
        </div>
      )}

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search students..." className="pl-9 bg-muted/50 border-none" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-3 px-4 py-2 animate-pulse">
                  <div className="h-4 bg-muted rounded w-8" />
                  <div className="h-4 bg-muted rounded w-32" />
                  <div className="h-4 bg-muted rounded w-24" />
                  <div className="h-4 bg-muted rounded flex-1" />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[120px]">Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Lesson 1</TableHead>
                  <TableHead>Lesson 2</TableHead>
                  <TableHead>Lesson 3</TableHead>
                  <TableHead className="text-right w-[140px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <AppEmptyState
                        type={search ? "search-no-results" : "students"}
                        searchQuery={search || undefined}
                        title={search ? undefined : "No students yet"}
                        description={search ? undefined : "Add your first student using the form above or import from a spreadsheet."}
                        size="sm"
                        actions={search ? [] : [{ label: "Add Student", primary: true, icon: UserPlus, onClick: undefined }]}
                      />
                    </TableCell>
                  </TableRow>
                ) : filteredStudents.map(student => (
                  <TableRow key={student.id}>
                    <TableCell className="font-mono font-semibold text-sm">{student.studentCode}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        {student.studentName}
                        {isDuplicate(student.studentName) && (
                          <span title="Possible duplicate name" className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold border border-amber-200">
                            <AlertTriangle className="h-2.5 w-2.5" />dup
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><SessionBadge session={student.lesson1Session} /></TableCell>
                    <TableCell><SessionBadge session={student.lesson2Session} /></TableCell>
                    <TableCell><SessionBadge session={student.lesson3Session} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <QRModal student={student} />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" title="View Profile" onClick={() => navigate(`/students/${student.id}`)}>
                          <BarChart2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
                          title={student.accountId ? "Has login account" : "Create login account"}
                          onClick={() => { if (!student.accountId) setCreateAccountStudent(student); }}>
                          {student.accountId ? <UserCheck className="h-3.5 w-3.5 text-emerald-500" /> : <KeyRound className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setEditingStudent(student)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          disabled={deletingId === student.id}
                          onClick={() => handleDelete(student.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        resource="students"
        message={upgradeMsg}
      />
    </div>
  );
}
