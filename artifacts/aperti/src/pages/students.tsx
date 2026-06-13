import { apiFetch } from "@/lib/api";
import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "qrcode";
import JSZip from "jszip";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, UserPlus, Upload, Search, Clock, Pencil, QrCode, Download, Package, BarChart2, KeyRound, UserCheck, AlertTriangle } from "lucide-react";
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
  return QRCode.toDataURL(text, { width: 400, margin: 2, color: { dark: "#000000", light: "#ffffff" } });
}

function QRModal({ student }: { student: StudentRecord }) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const initials = student.studentName
    .split(" ")
    .map(n => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleOpen = async (v: boolean) => {
    setOpen(v);
    if (v && !dataUrl) {
      const url = await generateQRDataUrl(student.studentCode);
      setDataUrl(url);
    }
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${student.studentCode}_${student.studentName.replace(/\s+/g, "_")}.png`;
    a.click();
    toast({ title: "QR code downloaded" });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" title="View student ID card">
          <QrCode className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs p-0 overflow-hidden border-0 shadow-2xl">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="relative bg-gradient-to-br from-[#0D9488] to-[#0F766E] px-6 pt-6 pb-8 text-white overflow-hidden">
                <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/5" />
                <div className="absolute -bottom-8 -left-4 h-20 w-20 rounded-full bg-white/5" />
                <div className="relative">
                  <p className="text-xs font-semibold tracking-[0.2em] uppercase text-white/60 mb-4">Aperti · Student ID</p>
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.08, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3 border border-white/30"
                  >
                    <span className="text-xl font-bold text-white">{initials}</span>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.14 }}
                  >
                    <p className="text-lg font-bold leading-tight">{student.studentName}</p>
                    <p className="text-xs font-mono text-white/70 mt-0.5 tracking-wider">{student.studentCode}</p>
                  </motion.div>
                </div>
              </div>

              <div className="bg-white p-6 flex flex-col items-center gap-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.18, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-white rounded-2xl p-3 shadow-lg border border-gray-100"
                >
                  {dataUrl ? (
                    <img src={dataUrl} alt={`QR for ${student.studentCode}`} className="w-44 h-44" />
                  ) : (
                    <div className="w-44 h-44 bg-gray-100 animate-pulse rounded-xl" />
                  )}
                </motion.div>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.28 }}
                  className="text-xs text-center text-muted-foreground"
                >
                  Scan to mark attendance
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.32 }}
                  className="w-full"
                >
                  <Button
                    onClick={handleDownload}
                    className="w-full gap-2 bg-[#0D9488] hover:bg-[#0B7B70] text-white"
                    disabled={!dataUrl}
                  >
                    <Download className="h-4 w-4" />
                    Download ID Card
                  </Button>
                </motion.div>
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

  const handleBulkExportQR = useCallback(async () => {
    if (!students.length) return;
    setBulkExporting(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("aperti-qr-codes")!;
      for (const student of students) {
        const dataUrl = await generateQRDataUrl(student.studentCode);
        const base64 = dataUrl.split(",")[1];
        folder.file(`${student.studentCode}_${student.studentName.replace(/\s+/g, "_")}.png`, base64, { base64: true });
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "aperti-qr-codes.zip"; a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Downloaded", description: `${students.length} QR codes exported as ZIP` });
    } catch { toast({ title: "Export failed", variant: "destructive" }); }
    finally { setBulkExporting(false); }
  }, [students, toast]);

  const filteredStudents = students.filter(s =>
    s.studentName.toLowerCase().includes(search.toLowerCase()) || s.studentCode.toLowerCase().includes(search.toLowerCase())
  );

  // Duplicate name detection — flag students with similar names (potential duplicates)
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
          <Button variant="outline" className="gap-2" onClick={handleBulkExportQR} disabled={bulkExporting || !students.length}>
            <Package className="h-4 w-4" />{bulkExporting ? "Exporting..." : "Export All QR Codes"}
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

      {/* Edit Student Dialog */}
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

      {/* Create Login Account Dialog */}
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
                <Input type="password" placeholder="Min 6 characters" value={createAccountPassword} onChange={e => setCreateAccountPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreateAccount()} maxLength={500} />
              </div>
              <Button className="w-full gap-2" disabled={createAccountSaving || createAccountPassword.length < 6} onClick={handleCreateAccount}>
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
            <div className="p-8 flex justify-center text-muted-foreground">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[120px]">Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Lesson 1</TableHead>
                  <TableHead>Lesson 2</TableHead>
                  <TableHead>Lesson 3</TableHead>
                  <TableHead className="text-right w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">{search ? "No students match your search." : "No students yet. Add one above."}</TableCell></TableRow>
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
