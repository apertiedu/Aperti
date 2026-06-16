import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { GraduationCap, Target, Calendar, TrendingUp } from "lucide-react";
import ParentChildSwitcher from "@/components/parent-child-switcher";

const authFetch = (url: string) => fetch(url, { credentials: "include" });

function getReadinessColor(pct: number) {
  if (pct >= 75) return "hsl(var(--primary))";
  if (pct >= 50) return "#f59e0b";
  return "#ef4444";
}

function GaugeArc({ value }: { value: number }) {
  const angle = (value / 100) * 180 - 90;
  const color = getReadinessColor(value);
  return (
    <div className="relative flex items-center justify-center" style={{ width: 160, height: 90 }}>
      <svg viewBox="0 0 160 90" width={160} height={90}>
        <path d="M 10 80 A 70 70 0 0 1 150 80" fill="none" stroke="#e5e7eb" strokeWidth={12} strokeLinecap="round" />
        <path
          d="M 10 80 A 70 70 0 0 1 150 80"
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * 220} 220`}
        />
        <text x="80" y="78" textAnchor="middle" fontSize="22" fontWeight="900" fill={color}>{value}%</text>
        <text x="80" y="88" textAnchor="middle" fontSize="9" fill="#9ca3af">readiness</text>
      </svg>
    </div>
  );
}

export default function ParentExamReadiness() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const [studentId, setStudentId] = useState<number | null>(params.get("child") ? parseInt(params.get("child")!) : null);

  const { data, isLoading } = useQuery({
    queryKey: ["parent-exam-readiness", studentId],
    queryFn: () => authFetch(`/api/parent/child/${studentId}/exam-readiness`).then(r => r.json()),
    enabled: !!studentId,
  });

  const mockHistory = (data?.mockHistory || []).map((m: any) => ({
    label: new Date(m.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    score: parseFloat(m.score_pct || "0"),
    subject: m.subject_name,
    title: m.title,
  }));

  const daysToExam = data?.nextExam?.date
    ? Math.max(0, Math.ceil((new Date(data.nextExam.date).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/8">
          <GraduationCap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900">Exam Readiness</h1>
          <p className="text-sm text-gray-500">Predicted performance and preparation</p>
        </div>
      </motion.div>

      <ParentChildSwitcher selected={studentId} onSelect={setStudentId} />

      {!studentId ? (
        <div className="text-center py-16 text-gray-400 text-sm">Select a child to view exam readiness</div>
      ) : isLoading ? (
        <div className="space-y-4">{[0,1,2].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      ) : (
        <>
          {/* Overall gauge + next exam */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border border-gray-100 shadow-sm">
                <CardContent className="p-6 flex flex-col items-center">
                  <h2 className="text-sm font-bold text-gray-800 mb-4">Overall Readiness</h2>
                  <GaugeArc value={data?.overallReadiness || 0} />
                  <p className="text-xs text-gray-400 mt-3 text-center">Based on recent assessment performance</p>
                </CardContent>
              </Card>
            </motion.div>

            {daysToExam !== null && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <Card className="border border-gray-100 shadow-sm">
                  <CardContent className="p-6 flex flex-col items-center justify-center h-full">
                    <Calendar className="h-8 w-8 text-primary mb-3" />
                    <p className="text-4xl font-black text-gray-900">{daysToExam}</p>
                    <p className="text-sm text-gray-500 mt-1">days to next exam</p>
                    {data.nextExam && (
                      <div className="mt-3 text-center">
                        <p className="text-xs font-semibold text-gray-700">{data.nextExam.title}</p>
                        <p className="text-[10px] text-gray-400">{data.nextExam.subject_name} · {new Date(data.nextExam.date).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Per-subject readiness */}
          {data?.subjectReadiness?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
              <Card className="border border-gray-100 shadow-sm">
                <CardContent className="p-5">
                  <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><Target className="h-4 w-4 text-primary" />Subject Readiness</h2>
                  <div className="space-y-3">
                    {data.subjectReadiness.map((s: any, i: number) => {
                      const pct = parseFloat(s.readiness_pct || "0");
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700">{s.subject_name || "General"}</span>
                            <span className="text-xs font-bold" style={{ color: getReadinessColor(pct) }}>{pct.toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: getReadinessColor(pct) }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Mock score history */}
          {mockHistory.length > 1 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="border border-gray-100 shadow-sm">
                <CardContent className="p-5">
                  <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Assessment History</h2>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={mockHistory}>
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(v: any, _: any, props: any) => [`${v}%`, props?.payload?.subject || "Score"]} />
                      <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: "hsl(var(--primary))", r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
