import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, Eye, Clock, CheckCircle2, ScanFace, Info, ShieldOff } from "lucide-react";

const tok = () => localStorage.getItem("aperti_token") || "";

const ACTIVE_MEASURES = [
  { label: "Tab-switch detection", description: "Students are flagged each time they leave the exam tab" },
  { label: "Copy/paste blocking", description: "All copy and paste events are blocked during active exams" },
  { label: "Timer auto-submit", description: "Exam is auto-submitted when time expires" },
  { label: "Violation logging", description: "All integrity events are logged and attached to the submission" },
];

export default function ShieldCore() {
  const { data: flagged, isLoading } = useQuery<any[]>({
    queryKey: ["shield-violations"],
    queryFn: async () => {
      const res = await fetch("/api/shield/violations", { headers: { Authorization: `Bearer ${tok()}` } });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return Array.isArray(json) ? json : (json.violations ?? []);
    },
    retry: false,
  });

  const violations: any[] = flagged ?? [];

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ShieldCore</h1>
            <p className="text-sm text-gray-500">Exam integrity &amp; anti-cheat monitoring</p>
          </div>
        </div>
      </motion.div>

      {/* Active measures */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {ACTIVE_MEASURES.map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{m.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
                </div>
                <Badge className="ml-auto shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">Active</Badge>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Coming Soon: AI proctoring */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-6">
        <Card className="border border-dashed border-gray-300 bg-white/60">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
              <ScanFace className="h-5 w-5 text-gray-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-gray-700">AI-Powered Proctoring</p>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-primary/30 text-primary bg-primary/5">
                  <Clock className="h-2.5 w-2.5" />Coming Soon
                </span>
              </div>
              <p className="text-xs text-gray-400">Face detection, eye-tracking, and real-time identity verification via webcam. In development.</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Violation log */}
      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Integrity Violation Log</CardTitle>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Info className="h-3.5 w-3.5" />
              Live data · updates during active exams
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-400">Loading violations…</p>
            </div>
          ) : violations.length === 0 ? (
            <div className="p-10 text-center">
              <ShieldOff className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">No violations recorded yet</p>
              <p className="text-xs text-gray-400 mt-1">Violations will appear here when students trigger integrity events during exams.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Exam</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {violations.map((f: any) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.student || f.student_name || "—"}</TableCell>
                    <TableCell className="text-sm text-gray-600">{f.exam || f.exam_title || "—"}</TableCell>
                    <TableCell className="text-xs text-gray-500">{f.type || f.violation_type || "Tab switch"}</TableCell>
                    <TableCell>
                      <Badge variant={f.violations >= 3 ? "destructive" : "secondary"} className="gap-1">
                        <AlertTriangle className="h-3 w-3" />{f.violations ?? f.count ?? 1}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-400">{f.time || (f.created_at ? new Date(f.created_at).toLocaleTimeString() : "—")}</TableCell>
                    <TableCell>
                      <Badge variant={f.status === "flagged" ? "destructive" : "outline"}
                        className={f.status === "reviewed" ? "text-gray-600" : ""}>
                        {f.status || "flagged"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                        <Eye className="h-3.5 w-3.5 mr-1" /> Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
