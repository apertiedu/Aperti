import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { BarChart3, TrendingUp, TrendingDown, BookOpen, MessageSquare } from "lucide-react";
import ParentChildSwitcher from "@/components/parent-child-switcher";

const TEAL = "#0D9488";
const authFetch = (url: string) => fetch(url, { credentials: "include" });

function getGradeLabel(pct: number) {
  if (pct >= 90) return "A*";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "E";
}
function getGradeColor(pct: number) {
  if (pct >= 80) return "#0D9488";
  if (pct >= 60) return "#f59e0b";
  return "#ef4444";
}

export default function ParentGrades() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const [studentId, setStudentId] = useState<number | null>(params.get("child") ? parseInt(params.get("child")!) : null);

  const { data, isLoading } = useQuery({
    queryKey: ["parent-grades", studentId],
    queryFn: () => authFetch(`/api/parent/child/${studentId}/grades`).then(r => r.json()),
    enabled: !!studentId,
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#6366f115" }}>
          <BarChart3 className="h-5 w-5 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900">Grades & Performance</h1>
          <p className="text-sm text-gray-500">Subject breakdown and grade trends</p>
        </div>
      </motion.div>

      <ParentChildSwitcher selected={studentId} onSelect={setStudentId} />

      {!studentId ? (
        <div className="text-center py-16 text-gray-400 text-sm">Select a child to view grades</div>
      ) : isLoading ? (
        <div className="space-y-4">{[0,1,2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : !data ? (
        <div className="text-center py-16 text-gray-400 text-sm">No grade data available</div>
      ) : (
        <>
          {/* Grade trend chart */}
          {data.trend?.length > 1 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border border-gray-100 shadow-sm">
                <CardContent className="p-5">
                  <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-teal-500" />Grade Trend (Last 12 Assessments)</h2>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={data.trend}>
                      <XAxis dataKey="title" tick={{ fontSize: 9 }} tickFormatter={(v) => v.length > 12 ? v.slice(0, 12) + "…" : v} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(v: any) => [`${v}%`, "Score"]} labelFormatter={(l) => l} />
                      <Line type="monotone" dataKey="pct" stroke={TEAL} strokeWidth={2.5} dot={{ fill: TEAL, r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Subject breakdown */}
          {data.subjectGrades?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card className="border border-gray-100 shadow-sm">
                <CardContent className="p-5">
                  <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><BookOpen className="h-4 w-4 text-indigo-500" />By Subject</h2>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={data.subjectGrades} layout="vertical">
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="subject_name" tick={{ fontSize: 9 }} width={80} />
                      <Tooltip formatter={(v: any) => [`${parseFloat(v).toFixed(1)}%`, "Avg Score"]} />
                      <Bar dataKey="avg_pct" radius={4}>
                        {data.subjectGrades.map((entry: any, i: number) => (
                          <Cell key={i} fill={getGradeColor(parseFloat(entry.avg_pct || "0"))} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {data.subjectGrades.map((s: any, i: number) => {
                      const pct = parseFloat(s.avg_pct || "0");
                      return (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{s.subject_name || "General"}</p>
                            <p className="text-[10px] text-gray-400">{s.total_questions} questions assessed</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black" style={{ color: getGradeColor(pct) }}>{pct.toFixed(0)}%</p>
                            <Badge className="text-[9px] rounded-full px-2" style={{ background: `${getGradeColor(pct)}15`, color: getGradeColor(pct) }}>{getGradeLabel(pct)}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Recent feedback */}
          {data.hwFeedback?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="border border-gray-100 shadow-sm">
                <CardContent className="p-5">
                  <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><MessageSquare className="h-4 w-4 text-teal-500" />Recent Teacher Feedback</h2>
                  <div className="space-y-3">
                    {data.hwFeedback.map((f: any, i: number) => (
                      <div key={i} className="p-3 rounded-xl border border-gray-100 bg-white">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-gray-800">{f.title}</p>
                          <span className="text-xs font-bold" style={{ color: getGradeColor((f.marks_awarded / f.total_marks) * 100) }}>
                            {f.marks_awarded}/{f.total_marks}
                          </span>
                        </div>
                        {f.teacher_feedback && <p className="text-xs text-gray-500 italic">"{f.teacher_feedback}"</p>}
                        <p className="text-[10px] text-gray-400 mt-1">{f.subject_name} · {f.graded_at ? new Date(f.graded_at).toLocaleDateString("en-GB") : ""}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {!data.subjectGrades?.length && !data.trend?.length && (
            <div className="text-center py-16 text-gray-400 text-sm">No assessment data available yet</div>
          )}
        </>
      )}
    </div>
  );
}
