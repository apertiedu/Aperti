import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Brain, Target, Clock, CheckCircle2, Flame, Layers } from "lucide-react";
import ParentChildSwitcher from "@/components/parent-child-switcher";

const TEAL = "#0D9488";
const authFetch = (url: string) => fetch(url, { credentials: "include" });

function HeatmapCell({ minutes }: { minutes: number }) {
  const opacity = minutes === 0 ? 0 : Math.min(1, 0.15 + (minutes / 120) * 0.85);
  return (
    <div
      className="w-3.5 h-3.5 rounded-sm"
      style={{ background: minutes > 0 ? `rgba(13, 148, 136, ${opacity})` : "#f0f0f0" }}
      title={`${Math.round(minutes)} min`}
    />
  );
}

export default function ParentRevision() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const [studentId, setStudentId] = useState<number | null>(params.get("child") ? parseInt(params.get("child")!) : null);

  const { data, isLoading } = useQuery({
    queryKey: ["parent-revision", studentId],
    queryFn: () => authFetch(`/api/parent/child/${studentId}/revision`).then(r => r.json()),
    enabled: !!studentId,
  });

  const heatmapData: { day: string; minutes: number }[] = data?.heatmap || [];
  const monthlyData = (data?.monthly || []).map((r: any) => ({
    label: new Date(r.month).toLocaleDateString("en-GB", { month: "short" }),
    hours: parseFloat(r.hours || "0").toFixed(1),
  }));

  const totalHours = Math.round((parseInt(data?.totals?.total_minutes || "0")) / 60);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-purple-50">
          <Brain className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900">Revision & Study</h1>
          <p className="text-sm text-gray-500">Focus sessions, goals and consistency</p>
        </div>
      </motion.div>

      <ParentChildSwitcher selected={studentId} onSelect={setStudentId} />

      {!studentId ? (
        <div className="text-center py-16 text-gray-400 text-sm">Select a child to view revision data</div>
      ) : isLoading ? (
        <div className="space-y-4">{[0,1,2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : (
        <>
          {/* Stat row */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Clock, label: "Total Hours", value: `${totalHours}h`, color: TEAL },
              { icon: Target, label: "Sessions", value: data?.totals?.total_sessions || 0, color: "#6366f1" },
              { icon: CheckCircle2, label: "Goals Done", value: data?.totals?.completed || 0, color: "#0D9488" },
              { icon: Flame, label: "Consistency", value: `${data?.consistencyScore || 0}%`, color: "#f59e0b" },
            ].map((s, i) => (
              <Card key={i} className="border border-gray-100 shadow-sm">
                <CardContent className="p-4">
                  <s.icon className="h-5 w-5 mb-2" style={{ color: s.color }} />
                  <p className="text-2xl font-black text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </motion.div>

          {/* Heatmap */}
          {heatmapData.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card className="border border-gray-100 shadow-sm">
                <CardContent className="p-5">
                  <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><Flame className="h-4 w-4 text-amber-500" />Study Heatmap (Last 90 Days)</h2>
                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      const map = new Map(heatmapData.map(d => [d.day?.split("T")[0], d.minutes]));
                      const days = [];
                      for (let i = 89; i >= 0; i--) {
                        const d = new Date();
                        d.setDate(d.getDate() - i);
                        const key = d.toISOString().split("T")[0];
                        days.push({ day: key, minutes: map.get(key) || 0 });
                      }
                      return days.map((d, i) => <HeatmapCell key={i} minutes={d.minutes} />);
                    })()}
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                    <div className="flex gap-1 items-center"><div className="w-3 h-3 rounded-sm bg-gray-100" />Less</div>
                    <div className="flex gap-1 items-center"><div className="w-3 h-3 rounded-sm" style={{ background: "rgba(13,148,136,0.6)" }} />More</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Monthly hours chart */}
          {monthlyData.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
              <Card className="border border-gray-100 shadow-sm">
                <CardContent className="p-5">
                  <h2 className="text-sm font-bold text-gray-800 mb-4">Monthly Study Hours</h2>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={monthlyData}>
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}h`} />
                      <Tooltip formatter={(v: any) => [`${v}h`, "Hours"]} />
                      <Bar dataKey="hours" fill={TEAL} radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Goals list */}
          {data?.goals?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="border border-gray-100 shadow-sm">
                <CardContent className="p-5">
                  <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><Target className="h-4 w-4 text-teal-500" />Recent Goals</h2>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {data.goals.map((g: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${g.completed_at ? "bg-emerald-100" : "bg-gray-200"}`}>
                          {g.completed_at ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <div className="w-2 h-2 rounded-full bg-gray-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{g.title}</p>
                          <p className="text-[10px] text-gray-400">{g.type} · {g.xp_reward} XP</p>
                        </div>
                        {g.completed_at && <Badge className="text-[9px] bg-emerald-100 text-emerald-700 rounded-full">Done</Badge>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Flashcard count */}
          {data?.flashcardsReviewed > 0 && (
            <Card className="border border-gray-100 shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center"><Layers className="h-5 w-5 text-indigo-500" /></div>
                <div>
                  <p className="text-xl font-black text-gray-900">{data.flashcardsReviewed}</p>
                  <p className="text-xs text-gray-500">Flashcards reviewed (lifetime)</p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
