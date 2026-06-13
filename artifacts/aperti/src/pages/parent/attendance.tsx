import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ClipboardList, CheckCircle2, XCircle, Clock } from "lucide-react";
import ParentChildSwitcher from "@/components/parent-child-switcher";

const authFetch = (url: string) => fetch(url, { credentials: "include" });

function statusColor(s: string) {
  const lower = s?.toLowerCase() || "";
  if (lower === "present") return "bg-emerald-100 text-emerald-700";
  if (lower === "absent") return "bg-red-100 text-red-700";
  if (lower === "late") return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-500";
}

export default function ParentAttendance() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const [studentId, setStudentId] = useState<number | null>(params.get("child") ? parseInt(params.get("child")!) : null);
  const [view, setView] = useState<"weekly" | "monthly">("weekly");

  const { data, isLoading } = useQuery({
    queryKey: ["parent-attendance", studentId],
    queryFn: () => authFetch(`/api/parent/child/${studentId}/attendance`).then(r => r.json()),
    enabled: !!studentId,
  });

  const summary = data?.summary || {};
  const total = parseInt(summary.total || "0");
  const present = parseInt(summary.present || "0");
  const absent = parseInt(summary.absent || "0");
  const late = parseInt(summary.late || "0");
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  const chartData = (view === "weekly" ? data?.weekly : data?.monthly)?.map((r: any) => ({
    label: new Date(r.week || r.month).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    rate: r.total > 0 ? Math.round((parseInt(r.present) / parseInt(r.total)) * 100) : 0,
    present: parseInt(r.present),
    total: parseInt(r.total),
  })) || [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-teal-50">
          <ClipboardList className="h-5 w-5 text-teal-600" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-500">Session-by-session record</p>
        </div>
      </motion.div>

      <ParentChildSwitcher selected={studentId} onSelect={setStudentId} />

      {!studentId ? (
        <div className="text-center py-16 text-gray-400 text-sm">Select a child to view attendance</div>
      ) : isLoading ? (
        <div className="space-y-4">{[0,1,2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : (
        <>
          {/* Summary cards */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: ClipboardList, label: "Overall Rate", value: `${rate}%`, color: rate >= 90 ? "#0D9488" : rate >= 75 ? "#f59e0b" : "#ef4444" },
              { icon: CheckCircle2, label: "Present", value: present, color: "#0D9488" },
              { icon: XCircle, label: "Absent", value: absent, color: "#ef4444" },
              { icon: Clock, label: "Late", value: late, color: "#f59e0b" },
            ].map((s, i) => (
              <Card key={i} className="border border-gray-100 shadow-sm">
                <CardContent className="p-4">
                  <s.icon className="h-5 w-5 mb-2" style={{ color: s.color }} />
                  <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </motion.div>

          {/* Trend chart */}
          {chartData.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card className="border border-gray-100 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-gray-800">Attendance Rate</h2>
                    <div className="flex bg-gray-100 rounded-lg p-0.5">
                      {(["weekly","monthly"] as const).map(v => (
                        <button key={v} onClick={() => setView(v)} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${view === v ? "bg-white shadow text-teal-600" : "text-gray-500"}`}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={chartData}>
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                      <YAxis domain={[0,100]} tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(v: any) => [`${v}%`, "Rate"]} />
                      <Bar dataKey="rate" radius={4}>
                        {chartData.map((entry: any, i: number) => (
                          <Cell key={i} fill={entry.rate >= 90 ? "#0D9488" : entry.rate >= 75 ? "#f59e0b" : "#ef4444"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Records */}
          {data?.records?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="border border-gray-100 shadow-sm">
                <CardContent className="p-5">
                  <h2 className="text-sm font-bold text-gray-800 mb-4">Recent Records</h2>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {data.records.map((r: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                        <div>
                          <p className="text-xs font-medium text-gray-800">{r.subject_name || r.session_name || "Session"}</p>
                          <p className="text-[10px] text-gray-400">{new Date(r.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</p>
                        </div>
                        <Badge className={`text-[10px] rounded-full ${statusColor(r.status)}`}>{r.status}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
