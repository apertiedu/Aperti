import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, Eye, Clock, CheckCircle2, Info, ScanFace, Cpu } from "lucide-react";

const tok = () => localStorage.getItem("aperti_token") || "";

const MOCK_FLAGGED = [
  { id: 1, student: "Ahmed S.", exam: "Physics Mock", violations: 3, type: "Tab switch", status: "flagged", time: "09:14 AM" },
  { id: 2, student: "Mona K.", exam: "Math Final", violations: 1, type: "Tab switch", status: "reviewed", time: "10:42 AM" },
  { id: 3, student: "Omar T.", exam: "Chemistry Mid", violations: 2, type: "Paste attempt", status: "flagged", time: "11:05 AM" },
];

const ACTIVE_MEASURES = [
  { label: "Tab-switch detection", description: "Students are flagged each time they leave the exam tab", active: true },
  { label: "Copy/paste blocking", description: "All copy and paste events are blocked during active exams", active: true },
  { label: "Timer auto-submit", description: "Exam is auto-submitted when time expires", active: true },
  { label: "Violation logging", description: "All integrity events are logged and attached to the submission", active: true },
];

export default function ShieldCore() {
  const { data: flagged } = useQuery({
    queryKey: ["shield-violations"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/shield/violations", { headers: { Authorization: `Bearer ${tok()}` } });
        if (!res.ok) return MOCK_FLAGGED;
        return res.json();
      } catch { return MOCK_FLAGGED; }
    },
    placeholderData: MOCK_FLAGGED,
  });

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ShieldCore</h1>
            <p className="text-sm text-gray-500">Exam integrity & anti-cheat monitoring</p>
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
              Sample data — live reporting active during exams
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
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
              {(flagged || MOCK_FLAGGED).map((f: typeof MOCK_FLAGGED[0]) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.student}</TableCell>
                  <TableCell className="text-sm text-gray-600">{f.exam}</TableCell>
                  <TableCell className="text-xs text-gray-500">{f.type || "Tab switch"}</TableCell>
                  <TableCell>
                    <Badge variant={f.violations >= 3 ? "destructive" : "secondary"} className="gap-1">
                      <AlertTriangle className="h-3 w-3" />{f.violations}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-gray-400">{f.time || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={f.status === "flagged" ? "destructive" : "outline"}
                      className={f.status === "reviewed" ? "text-gray-600" : ""}>
                      {f.status}
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
        </CardContent>
      </Card>
    </div>
  );
}
