import { apiFetch } from "@/lib/api";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckSquare, TrendingDown, TrendingUp, Minus } from "lucide-react";
import AttendanceHeatmap from "@/components/heatmap";

type AttRow = { date: string; status: string; lessonNumber: number; dayOfWeek: string; startTime: string };
type HeatmapDay = { date: string; value: number; present: number; absent: number };

export default function MyAttendance() {
  const [data, setData] = useState<{ records: AttRow[]; heatmap: HeatmapDay[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/portal/attendance", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const records = data?.records || [];
  const heatmap = data?.heatmap || [];
  const present = records.filter(r => r.status === "Present").length;
  const absent = records.filter(r => r.status === "Absent").length;
  const total = present + absent;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  // Compare last 4 weeks vs prior 4 weeks
  const now = new Date(); const fw = new Date(now); fw.setDate(now.getDate() - 28);
  const ew = new Date(now); ew.setDate(now.getDate() - 56);
  const fwStr = fw.toISOString().split("T")[0]; const ewStr = ew.toISOString().split("T")[0];
  const recent = records.filter(r => r.date >= fwStr);
  const older = records.filter(r => r.date >= ewStr && r.date < fwStr);
  const recentRate = recent.length > 0 ? Math.round((recent.filter(r => r.status === "Present").length / recent.length) * 100) : rate;
  const olderRate = older.length > 0 ? Math.round((older.filter(r => r.status === "Present").length / older.length) * 100) : rate;
  const trend = recentRate - olderRate;

  const stats = [
    { label: "Overall Rate", value: `${rate}%`, color: rate >= 80 ? "text-emerald-600" : rate >= 70 ? "text-amber-600" : "text-red-600" },
    { label: "Sessions Present", value: present, color: "text-emerald-600" },
    { label: "Sessions Absent", value: absent, color: "text-red-500" },
    { label: "Last 4 Weeks", value: `${recentRate}%`, color: recentRate >= 80 ? "text-emerald-600" : recentRate >= 70 ? "text-amber-600" : "text-red-500" },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted animate-pulse rounded-xl w-48" />
        <div className="grid grid-cols-2 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}</div>
        <div className="h-40 bg-muted animate-pulse rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <CheckSquare className="h-6 w-6 text-indigo-500" />My Attendance
          </h1>
          <p className="text-gray-500 text-sm mt-1">Your attendance record over the past year.</p>
        </div>
        {trend !== 0 && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold ${trend > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
            {trend > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {trend > 0 ? "+" : ""}{trend}% trend
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.07 }}
            className="bg-card rounded-2xl p-4 shadow-sm border border-border">
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className={`text-2xl font-black mt-1 ${s.color}`}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-card rounded-2xl shadow-sm border border-border p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-4">Attendance Heatmap (Last 26 Weeks)</h2>
        <AttendanceHeatmap data={heatmap} weeks={26} />
      </motion.div>

      {records.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <h2 className="text-sm font-bold text-gray-900 px-5 py-4 border-b border-gray-50">Recent Sessions</h2>
          <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
            {records.slice(0, 30).map(r => (
              <div key={`${r.date}-${r.lessonNumber}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.status === "Present" ? "bg-emerald-400" : "bg-red-400"}`} />
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-700">Lesson {r.lessonNumber} — {r.dayOfWeek} {r.startTime}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{new Date(r.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                  <p className={`text-[10px] font-semibold mt-0.5 ${r.status === "Present" ? "text-emerald-600" : "text-red-500"}`}>{r.status}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
