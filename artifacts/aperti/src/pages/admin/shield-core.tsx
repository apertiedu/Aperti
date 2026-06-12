import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Shield, AlertTriangle, Eye, Clock, CheckCircle2, ScanFace, Info, ShieldOff, ClipboardX, Copy, EyeOff, Activity } from "lucide-react";

const tok = () => localStorage.getItem("aperti_token") || "";

const ACTIVE_MEASURES = [
  { label: "Tab-switch detection", description: "Students are flagged each time they leave the exam tab" },
  { label: "Copy/paste blocking", description: "All copy and paste events are blocked and counted during active exams" },
  { label: "Risk score engine", description: "Weighted 0–100 risk score: paste×12, tab×8, focus×4, copy×3 per event" },
  { label: "Answer timing", description: "Per-question time-on-answer recorded and submitted with integrity payload" },
];

function RiskBadge({ score }: { score: number | null | undefined }) {
  const s = score ?? 0;
  if (s >= 60) return <Badge variant="destructive" className="text-[10px] font-bold">{s} High Risk</Badge>;
  if (s >= 25) return <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold">{s} Medium</Badge>;
  return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">{s} Low</Badge>;
}

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
    refetchInterval: 30_000,
  });

  const violations: any[] = flagged ?? [];
  const highRisk = violations.filter(v => (v.risk_score ?? 0) >= 60).length;
  const medRisk = violations.filter(v => { const s = v.risk_score ?? 0; return s >= 25 && s < 60; }).length;

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ShieldCore V2</h1>
            <p className="text-sm text-gray-500">Exam integrity, anti-cheat monitoring &amp; risk scoring</p>
          </div>
          {violations.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              {highRisk > 0 && <Badge variant="destructive">{highRisk} high risk</Badge>}
              {medRisk > 0 && <Badge className="bg-amber-100 text-amber-800">{medRisk} medium</Badge>}
            </div>
          )}
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

      {/* Risk score legend */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }} className="mb-6">
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-gray-700">Risk Score Engine</span>
            </div>
            {[
              { label: "Paste attempt", pts: 12, icon: <ClipboardX className="h-3 w-3" />, color: "text-red-600" },
              { label: "Tab switch", pts: 8, icon: <EyeOff className="h-3 w-3" />, color: "text-amber-600" },
              { label: "Focus loss", pts: 4, icon: <Eye className="h-3 w-3" />, color: "text-amber-500" },
              { label: "Copy attempt", pts: 3, icon: <Copy className="h-3 w-3" />, color: "text-orange-500" },
            ].map(({ label, pts, icon, color }) => (
              <div key={label} className={`flex items-center gap-1 text-xs ${color}`}>
                {icon}
                <span className="font-medium">{label}</span>
                <span className="text-gray-400">+{pts} pts</span>
              </div>
            ))}
            <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> 0–24 Low</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 25–59 Medium</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> 60+ High</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

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
              Live · refreshes every 30s
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
                  <TableHead>Tab Switches</TableHead>
                  <TableHead>Pastes</TableHead>
                  <TableHead>Copies</TableHead>
                  <TableHead>Risk Score</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {violations.map((f: any) => {
                  const riskScore = f.risk_score ?? 0;
                  const tabCount = f.tab_switch_count ?? f.violations ?? f.count ?? 0;
                  const pasteCount = f.paste_attempts ?? 0;
                  const copyCount = f.copy_attempts ?? 0;
                  return (
                    <TableRow key={f.id} className={riskScore >= 60 ? "bg-red-50/40" : riskScore >= 25 ? "bg-amber-50/30" : ""}>
                      <TableCell className="font-medium">{f.student || f.student_name || "—"}</TableCell>
                      <TableCell className="text-sm text-gray-600 max-w-[140px] truncate">{f.exam || f.exam_title || "—"}</TableCell>
                      <TableCell>
                        {tabCount > 0 ? (
                          <span className="flex items-center gap-1 text-amber-700 text-xs font-medium">
                            <EyeOff className="h-3 w-3" />{tabCount}
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        {pasteCount > 0 ? (
                          <span className="flex items-center gap-1 text-red-600 text-xs font-bold">
                            <ClipboardX className="h-3 w-3" />{pasteCount}
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        {copyCount > 0 ? (
                          <span className="flex items-center gap-1 text-orange-500 text-xs font-medium">
                            <Copy className="h-3 w-3" />{copyCount}
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 min-w-[80px]">
                          <RiskBadge score={riskScore} />
                          <Progress value={Math.min(riskScore, 100)} className={`h-1 ${riskScore >= 60 ? "[&>div]:bg-red-500" : riskScore >= 25 ? "[&>div]:bg-amber-400" : "[&>div]:bg-emerald-400"}`} />
                        </div>
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
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
