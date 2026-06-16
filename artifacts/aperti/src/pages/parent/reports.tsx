import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FileText, RefreshCw, Download, CheckCircle2, BarChart3, ClipboardList, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const authFetch = (url: string, opts?: RequestInit) =>
  fetch(url, { ...opts, credentials: "include", headers: { "Content-Type": "application/json", ...(opts?.headers || {}) } });

export default function ParentReports() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [frequency, setFrequency] = useState<string>("weekly");
  const [lastReport, setLastReport] = useState<any>(null);

  const { data: dashData } = useQuery({
    queryKey: ["parent-dashboard"],
    queryFn: () => authFetch("/api/parent/dashboard").then(r => r.json()),
  });

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["parent-notifications"],
    queryFn: () => authFetch("/api/parent/notifications").then(r => r.json()),
  });

  const children = dashData?.children || [];
  const reportNotifications = notifications.filter(n => n.type === "report");

  const generateMutation = useMutation({
    mutationFn: () => authFetch("/api/parent/generate-report", {
      method: "POST",
      body: JSON.stringify({ studentId: parseInt(selectedChild), frequency }),
    }),
    onSuccess: (r) => {
      r.json().then((data: any) => {
        setLastReport(data.report);
        toast({ title: "Report generated ✅" });
        qc.invalidateQueries({ queryKey: ["parent-notifications"] });
      });
    },
    onError: () => toast({ title: "Failed to generate report", variant: "destructive" }),
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#f3f4f6" }}>
          <FileText className="h-5 w-5 text-gray-600" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900">Snapshot Reports</h1>
          <p className="text-sm text-gray-500">Generate and view progress summaries</p>
        </div>
      </motion.div>

      {/* Generate report card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="p-5">
            <h2 className="text-sm font-bold text-gray-800 mb-4">Generate New Report</h2>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-40">
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Child</label>
                <Select value={selectedChild} onValueChange={setSelectedChild}>
                  <SelectTrigger className="rounded-xl text-sm"><SelectValue placeholder="Select child" /></SelectTrigger>
                  <SelectContent>{children.map((c: any) => <SelectItem key={c.studentId} value={String(c.studentId)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-36">
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Frequency</label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger className="rounded-xl text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={!selectedChild || generateMutation.isPending}
                className="gap-2 rounded-xl text-white"
                className="bg-primary text-primary-foreground"
              >
                {generateMutation.isPending ? <><RefreshCw className="h-4 w-4 animate-spin" />Generating…</> : <><RefreshCw className="h-4 w-4" />Generate</>}
              </Button>
              <Button
                variant="outline"
                className="gap-2 rounded-xl"
                disabled={!selectedChild}
                onClick={async () => {
                  if (!selectedChild) return;
                  const res = await fetch(`/api/parent/child/${selectedChild}/report-pdf`, {
                    credentials: "include",
                  });
                  if (res.ok) {
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `aperti-report-${selectedChild}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast({ title: "PDF downloaded ✅" });
                  } else {
                    toast({ title: "Failed to download PDF", variant: "destructive" });
                  }
                }}
              >
                <Download className="h-4 w-4" />
                PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Last generated report preview */}
      {lastReport && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-2 shadow-md" className="border-primary">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">📄 {lastReport.frequency.charAt(0).toUpperCase() + lastReport.frequency.slice(1)} Report — {lastReport.studentName}</h2>
                  <p className="text-[10px] text-gray-400 mt-0.5">Generated {new Date(lastReport.generatedAt).toLocaleString("en-GB")}</p>
                </div>
                <Badge className="bg-primary/15 text-primary text-[10px] rounded-full"><CheckCircle2 className="h-3 w-3 mr-1" />Ready</Badge>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-primary/8 rounded-xl">
                  <ClipboardList className="h-5 w-5 text-primary mx-auto mb-1" />
                  <p className="text-lg font-black text-primary">{lastReport.attendanceRate}%</p>
                  <p className="text-[10px] text-gray-500">Attendance</p>
                </div>
                <div className="text-center p-3 bg-indigo-50 rounded-xl">
                  <BarChart3 className="h-5 w-5 text-indigo-500 mx-auto mb-1" />
                  <p className="text-lg font-black text-indigo-700">{lastReport.avgGrade?.toFixed(0) || "—"}%</p>
                  <p className="text-[10px] text-gray-500">Avg Grade</p>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-xl">
                  <BookOpen className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                  <p className="text-lg font-black text-amber-700">{lastReport.hwSubmitted}</p>
                  <p className="text-[10px] text-gray-500">HW Submitted</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Past reports from notifications */}
      {reportNotifications.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Previous Reports</h2>
          <div className="space-y-2">
            {reportNotifications.map((n: any) => (
              <div key={n.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card">
                <FileText className="h-4.5 w-4.5 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800">{n.title}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{n.message}</p>
                </div>
                <p className="text-[10px] text-gray-400 shrink-0">{new Date(n.created_at).toLocaleDateString("en-GB")}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
