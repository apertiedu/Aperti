import { useState, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Download, Wand2, FileBarChart, ClipboardList, CheckSquare, XSquare,
  Sparkles, Copy, Check, Search, Eye, FileDown, RefreshCw, Users
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return format(d, "yyyy-MM-dd");
}

function getSundayOfWeek(monday: string): string {
  const d = new Date(monday + "T00:00:00");
  d.setDate(d.getDate() + 6);
  return format(d, "yyyy-MM-dd");
}

function formatWeekLabel(monday: string): string {
  const start = new Date(monday + "T00:00:00");
  const end = new Date(monday + "T00:00:00");
  end.setDate(end.getDate() + 6);
  return `${format(start, "dd/MM/yyyy")} → ${format(end, "dd/MM/yyyy")}`;
}

type StudentReport = { studentId: number; studentCode: string; studentName: string; report: string };
type AttendanceRecord = { id: number; date: string; studentCode: string; studentName: string; lessonNumber: number; dayOfWeek: string; status: string };
type StatusLevel = "elite" | "good" | "watch" | "risk";

function getStatusLevel(report: string): StatusLevel {
  if (report.includes("Elite Performer") || report.includes("Consistent Achiever")) return "elite";
  if (report.includes("Needs Urgent Support") || report.includes("Performance Declining") || report.includes("Attendance-Risk")) return "risk";
  if (report.includes("High Potential") || (report.includes("Homework") && report.includes("low"))) return "watch";
  return "good";
}

const STATUS_STYLE: Record<StatusLevel, { badge: string; dot: string }> = {
  elite: { badge: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-400" },
  good: { badge: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-400" },
  watch: { badge: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-400" },
  risk: { badge: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-400" },
};

function extractStatus(report: string): string {
  const match = report.match(/📊\s+Status\s+:\s+(.+)/);
  return match ? match[1]?.trim() ?? "" : "";
}

function ReportPreviewModal({ report, onClose }: { report: StudentReport; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const handleCopy = async () => {
    await navigator.clipboard.writeText(report.report);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileBarChart className="h-4 w-4 text-primary" />{report.studentName} — Weekly Report</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <pre className="text-xs font-mono bg-muted/30 rounded-xl p-4 whitespace-pre-wrap leading-relaxed border border-border/50">{report.report}</pre>
        </div>
        <div className="flex gap-2 pt-2 border-t border-border/50">
          <Button onClick={handleCopy} className="flex-1 gap-2" variant="outline">
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy to Clipboard"}
          </Button>
          <Button onClick={onClose} className="flex-1">Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Reports() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"ai" | "attendance">("ai");
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(new Date()));
  const [exporting, setExporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [previewReport, setPreviewReport] = useState<StudentReport | null>(null);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [autoMarking, setAutoMarking] = useState(false);

  const loadAttendance = useCallback(async (week: string) => {
    if (tab !== "attendance") return;
    setAttendanceLoading(true);
    try {
      const r = await fetch(`/api/attendance?weekStart=${week}`, { credentials: "include" });
      if (r.ok) setRecords(await r.json());
    } finally { setAttendanceLoading(false); }
  }, [tab]);

  useEffect(() => { loadAttendance(weekStart); }, [tab, weekStart]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const weekLabel = formatWeekLabel(weekStart);
      const res = await fetch("/api/reports/generate", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekLabel }),
      });
      if (!res.ok) { toast({ title: "Error generating reports", variant: "destructive" }); return; }
      const data: StudentReport[] = await res.json();
      setReports(data);
      toast({ title: `${data.length} reports generated`, description: "All reports are ready to preview and export." });
    } catch { toast({ title: "Failed to generate reports", variant: "destructive" }); }
    finally { setGenerating(false); }
  };

  const handleAutoMark = async () => {
    if (!confirm("Auto-mark all students with no record this week as Absent?")) return;
    setAutoMarking(true);
    try {
      const res = await fetch("/api/attendance/auto-absence", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed");
      toast({ title: "Auto-mark complete", description: data.message });
      loadAttendance(weekStart);
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setAutoMarking(false); }
  };

  const handleCopyOne = async (report: StudentReport) => {
    await navigator.clipboard.writeText(report.report);
    setCopiedId(report.studentId);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copied!" });
  };

  const handleExportCsv = useCallback(() => {
    if (reports.length === 0) return;
    setExportingCsv(true);
    try {
      const rows = ["report"];
      for (const r of reports) rows.push(`"${r.report.replace(/"/g, '""')}"`);
      const csv = rows.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `aperti-reports-${weekStart}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV exported", description: `${reports.length} reports in single-column format` });
    } finally { setExportingCsv(false); }
  }, [reports, weekStart, toast]);

  const handleExportAttendanceCsv = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/attendance/export?weekStart=${weekStart}`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `attendance-${weekStart}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { toast({ title: "Export failed", variant: "destructive" }); }
    finally { setExporting(false); }
  };

  const filteredReports = reports.filter(r =>
    r.studentName.toLowerCase().includes(search.toLowerCase()) ||
    r.studentCode.toLowerCase().includes(search.toLowerCase())
  );

  const countByLevel = {
    elite: reports.filter(r => getStatusLevel(r.report) === "elite").length,
    good: reports.filter(r => getStatusLevel(r.report) === "good").length,
    watch: reports.filter(r => getStatusLevel(r.report) === "watch").length,
    risk: reports.filter(r => getStatusLevel(r.report) === "risk").length,
  };

  return (
    <div className="space-y-6">
      {previewReport && <ReportPreviewModal report={previewReport} onClose={() => setPreviewReport(null)} />}

      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><FileBarChart className="h-7 w-7 text-primary" />Reports</h1>
        <p className="text-muted-foreground">Generate AI-powered weekly performance reports and view attendance records.</p>
      </div>

      <div className="flex gap-1 p-1 bg-muted/40 rounded-xl w-fit border border-border/50">
        {([["ai", "AI Weekly Reports", Sparkles], ["attendance", "Attendance Records", ClipboardList]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "ai" ? (
          <motion.div key="ai" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
            <Card className="border-border/50 shadow-sm">
              <CardContent className="pt-5 pb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                  <div className="space-y-1.5 flex-1">
                    <Label className="text-xs text-muted-foreground">Week Starting (Monday)</Label>
                    <Input type="date" className="w-48" value={weekStart} onChange={e => setWeekStart(e.target.value)} />
                    <p className="text-xs text-muted-foreground">{formatWeekLabel(weekStart)}</p>
                  </div>
                  <div className="flex gap-2">
                    {reports.length > 0 && (
                      <Button variant="outline" className="gap-2" onClick={handleExportCsv} disabled={exportingCsv}>
                        <FileDown className="h-4 w-4" />{exportingCsv ? "Exporting..." : `Export CSV (${reports.length})`}
                      </Button>
                    )}
                    <Button className="gap-2" onClick={handleGenerate} disabled={generating}>
                      {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {generating ? "Generating..." : reports.length > 0 ? "Regenerate" : "Generate All Reports"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {reports.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Elite / Achievers", count: countByLevel.elite, style: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
                  { label: "Good Progress", count: countByLevel.good, style: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
                  { label: "Needs Attention", count: countByLevel.watch, style: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
                  { label: "At Risk", count: countByLevel.risk, style: "text-red-600", bg: "bg-red-50 border-red-100" },
                ].map(s => (
                  <motion.div key={s.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`rounded-xl p-4 border ${s.bg}`}>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${s.style}`}>{s.count}</p>
                  </motion.div>
                ))}
              </div>
            )}

            {reports.length > 0 ? (
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/50">
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      {reports.length} Student Report{reports.length !== 1 ? "s" : ""} — {formatWeekLabel(weekStart)}
                    </CardTitle>
                    <div className="relative w-56">
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input placeholder="Search students..." className="pl-8 h-8 text-sm bg-muted/50 border-none" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/40">
                    {filteredReports.map((r, i) => {
                      const level = getStatusLevel(r.report);
                      const statusText = extractStatus(r.report);
                      const style = STATUS_STYLE[level];
                      return (
                        <motion.div key={r.studentId} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                          className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{r.studentName}</p>
                            <p className="text-xs text-muted-foreground font-mono">{r.studentCode}</p>
                          </div>
                          {statusText && (
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium border hidden sm:block max-w-[180px] truncate ${style.badge}`}>{statusText}</span>
                          )}
                          <div className="flex gap-1.5">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setPreviewReport(r)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleCopyOne(r)}>
                              {copiedId === r.studentId ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 gap-4 border border-dashed border-border rounded-2xl">
                <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-primary/40" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">No reports generated yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Select a week and click "Generate All Reports" to create AI-powered student reports.</p>
                </div>
                <Button className="gap-2" onClick={handleGenerate} disabled={generating}>
                  <Sparkles className="h-4 w-4" />{generating ? "Generating..." : "Generate Now"}
                </Button>
              </div>
            )}

            {reports.length > 0 && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-700">
                <p className="font-semibold mb-1">📋 CSV Export Format</p>
                <p>The exported file uses a <strong>single-column format</strong> with header <code>report</code>. Each row contains one complete student report as a single cell — optimised for WhatsApp bulk-sending tools, CRM import, and copy-paste workflows.</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="attendance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-end justify-between flex-wrap gap-4 pb-4 border-b border-border/50 bg-muted/10">
                <div className="space-y-1.5">
                  <Label>Week starting (Monday)</Label>
                  <Input type="date" className="w-44" value={weekStart} onChange={e => setWeekStart(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="gap-2" onClick={handleAutoMark} disabled={autoMarking}>
                    <Wand2 className="h-4 w-4 text-primary" />{autoMarking ? "Processing..." : "Auto-Mark Absences"}
                  </Button>
                  <Button className="gap-2" onClick={handleExportAttendanceCsv} disabled={exporting}>
                    <Download className="h-4 w-4" />{exporting ? "Downloading..." : "Export CSV"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {attendanceLoading ? (
                  <div className="p-8 flex justify-center text-muted-foreground">Loading records...</div>
                ) : (
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Date</TableHead><TableHead>Code</TableHead><TableHead>Name</TableHead>
                          <TableHead>Lesson</TableHead><TableHead>Day</TableHead><TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {records.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No records for this week.</TableCell></TableRow>
                        ) : records.map(record => (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium whitespace-nowrap">{format(new Date(record.date + "T00:00:00"), "EEE, MMM d")}</TableCell>
                            <TableCell className="font-mono text-sm">{record.studentCode}</TableCell>
                            <TableCell>{record.studentName}</TableCell>
                            <TableCell>Lesson {record.lessonNumber}</TableCell>
                            <TableCell className="text-muted-foreground">{record.dayOfWeek}</TableCell>
                            <TableCell>
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${record.status === "Present" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                                {record.status === "Present" ? <CheckSquare className="h-3 w-3" /> : <XSquare className="h-3 w-3" />}
                                {record.status}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
