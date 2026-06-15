import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, Users, ChevronRight, AlertTriangle } from "lucide-react";
import { Link } from "wouter";

interface StudentInsight {
  studentId: number;
  name: string;
  attendanceRate: number;
  avgGrade: number;
  trend: "up" | "down" | "stable";
  needsAttention: boolean;
}

function GradeBar({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? "bg-emerald-400" :
    pct >= 60 ? "bg-teal-400" :
    pct >= 50 ? "bg-amber-400" :
    "bg-red-400";
  return (
    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`h-full rounded-full ${color}`}
      />
    </div>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up") return <TrendingUp className="w-3 h-3 text-emerald-500" />;
  if (trend === "down") return <TrendingDown className="w-3 h-3 text-red-500" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

function igcseGrade(pct: number): string {
  if (pct >= 90) return "A*";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  if (pct >= 40) return "E";
  if (pct >= 30) return "F";
  return "U";
}

export default function StudentPerformanceInsights({ courseId }: { courseId?: number }) {
  const { data, isLoading } = useQuery<StudentInsight[]>({
    queryKey: ["course-health", courseId],
    queryFn: async () => {
      const url = courseId ? `/api/course-health?courseId=${courseId}` : "/api/course-health";
      const res = await apiFetch(url);
      const json = await res.json();
      return json.studentInsights ?? [];
    },
    enabled: true,
  });

  const students = data ?? [];
  const atRisk = students.filter(s => s.needsAttention);

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 text-center">
        <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
        <p className="text-sm font-semibold text-gray-700">No student data yet</p>
        <p className="text-xs text-gray-400 mt-1">Mark attendance or grade exams to see insights here</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-teal-600" />
          <p className="text-sm font-bold text-gray-900">Student Performance</p>
        </div>
        <div className="flex items-center gap-2">
          {atRisk.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
              <AlertTriangle className="w-2.5 h-2.5" />
              {atRisk.length} need{atRisk.length === 1 ? "s" : ""} attention
            </span>
          )}
          <span className="text-[10px] text-gray-400">{students.length} students</span>
        </div>
      </div>

      <div className="divide-y divide-gray-50">
        {students.slice(0, 8).map((s, i) => (
          <motion.div
            key={s.studentId}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/80 transition-colors ${s.needsAttention ? "bg-red-50/30" : ""}`}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
              {(s.name || "S").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-xs font-semibold text-gray-800 truncate">{s.name}</p>
                {s.needsAttention && <AlertTriangle className="w-2.5 h-2.5 text-red-500 shrink-0" />}
              </div>
              <GradeBar pct={s.avgGrade} />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <TrendIcon trend={s.trend} />
              <div className="text-right">
                <p className={`text-xs font-bold ${s.avgGrade >= 60 ? "text-teal-600" : "text-red-500"}`}>
                  {igcseGrade(s.avgGrade)}
                </p>
                <p className="text-[10px] text-gray-400">{s.attendanceRate}%</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {students.length > 8 && (
        <Link href="/gradebook">
          <div className="flex items-center justify-center gap-1 px-4 py-2.5 border-t border-gray-50 text-xs text-teal-600 font-medium hover:bg-teal-50/50 transition-colors cursor-pointer">
            View all {students.length} students <ChevronRight className="w-3 h-3" />
          </div>
        </Link>
      )}
    </div>
  );
}
