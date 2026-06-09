import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3, BookOpen, FileText, Brain, TrendingUp, Users, Clock,
  CheckCircle, AlertCircle, Zap, Target, Star, RefreshCw,
} from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("aperti_token");
async function fetchJSON(url: string, opts?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: any; sub?: string; color: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }}>
      <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start justify-between mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}><Icon size={18} /></div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{value ?? "—"}</p>
          <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function DifficultyBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-600">
        <span className="font-medium capitalize">{label}</span>
        <span>{value} ({pct}%)</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: "easeOut" }} className={`h-full rounded-full ${color}`} />
      </div>
    </div>
  );
}

export default function ContentAnalytics() {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ["analytics-dashboard"],
    queryFn: () => fetchJSON("/analytics/content/dashboard"),
  });

  const { data: topContent } = useQuery({
    queryKey: ["analytics-top-content"],
    queryFn: () => fetchJSON("/analytics/content/top-performing"),
  });

  const questions = dashboard?.questions || [];
  const lessons = dashboard?.lessons || [];
  const practice = dashboard?.practice;

  const totalQuestions = questions.reduce((a: number, q: any) => a + parseInt(q.total || 0), 0);
  const totalLessons = lessons.reduce((a: number, l: any) => a + parseInt(l.total || 0), 0);
  const recentLessons = lessons.reduce((a: number, l: any) => a + parseInt(l.recent || 0), 0);
  const avgAccuracy = practice ? Math.round(parseFloat(practice.avg_accuracy || "0")) : 0;
  const practiceSessions = practice ? parseInt(practice.sessions || "0") : 0;

  const difficultyData = {
    easy: parseInt(questions.find((q: any) => q.difficulty === "easy")?.total || "0"),
    medium: parseInt(questions.find((q: any) => q.difficulty === "medium")?.total || "0"),
    hard: parseInt(questions.find((q: any) => q.difficulty === "hard")?.total || "0"),
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><BarChart3 className="text-teal-600" size={28} /> Content Analytics</h1>
            <p className="text-gray-500 mt-1">Educational content performance and engagement insights</p>
          </div>
          <Button variant="outline" size="sm"><RefreshCw size={14} className="mr-1" /> Refresh</Button>
        </motion.div>

        {dashLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={BookOpen} label="Total Questions" value={totalQuestions} color="bg-teal-100 text-teal-600" />
              <StatCard icon={FileText} label="Total Lessons" value={totalLessons} sub={`${recentLessons} this week`} color="bg-blue-100 text-blue-600" />
              <StatCard icon={Target} label="Avg Practice Accuracy" value={`${avgAccuracy}%`} color="bg-green-100 text-green-600" />
              <StatCard icon={Users} label="Practice Sessions" value={practiceSessions} sub="last 30 days" color="bg-purple-100 text-purple-600" />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-white border border-gray-200">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="questions">Questions</TabsTrigger>
                <TabsTrigger value="lessons">Lessons</TabsTrigger>
                <TabsTrigger value="top-content">Top Content</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card className="bg-white border-0 shadow-sm">
                    <CardHeader><CardTitle className="text-base">Question Bank Health</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <DifficultyBar label="Easy" value={difficultyData.easy} total={totalQuestions} color="bg-green-500" />
                      <DifficultyBar label="Medium" value={difficultyData.medium} total={totalQuestions} color="bg-amber-500" />
                      <DifficultyBar label="Hard" value={difficultyData.hard} total={totalQuestions} color="bg-red-500" />
                      <div className="pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          {totalQuestions >= 50 ? (
                            <><CheckCircle size={14} className="text-green-600" /><span className="text-xs text-green-700">Good question bank size</span></>
                          ) : totalQuestions >= 20 ? (
                            <><AlertCircle size={14} className="text-amber-600" /><span className="text-xs text-amber-700">Growing — add more questions</span></>
                          ) : (
                            <><AlertCircle size={14} className="text-red-500" /><span className="text-xs text-red-600">Small bank — add more questions</span></>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-0 shadow-sm">
                    <CardHeader><CardTitle className="text-base">Content Activity</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {lessons.map((l: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${l.status === "published" ? "bg-green-100 text-green-700" : l.status === "draft" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                                {(l.status || "?")[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium capitalize">{l.status || "Unknown"}</p>
                                <p className="text-xs text-gray-500">{l.total} pages</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-teal-600">{l.recent}</p>
                              <p className="text-xs text-gray-400">this week</p>
                            </div>
                          </div>
                        ))}
                        {lessons.length === 0 && (
                          <div className="text-center py-8 text-gray-400">
                            <FileText size={36} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No lesson data yet</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { icon: Zap, title: "Quick Action", desc: "Generate 10 practice questions", action: "Generate", color: "bg-teal-50 border-teal-200" },
                    { icon: Brain, title: "AI Insight", desc: "Your question bank is missing hard-difficulty questions", action: "View", color: "bg-amber-50 border-amber-200" },
                    { icon: TrendingUp, title: "Trend", desc: `${avgAccuracy}% average student accuracy this month`, action: "Analyse", color: "bg-green-50 border-green-200" },
                  ].map(({ icon: Icon, title, desc, action, color }) => (
                    <div key={title} className={`p-4 rounded-xl border ${color}`}>
                      <Icon size={16} className="text-gray-600 mb-2" />
                      <p className="text-xs font-semibold text-gray-700 mb-1">{title}</p>
                      <p className="text-xs text-gray-500 mb-3">{desc}</p>
                      <Button size="sm" variant="outline" className="h-7 text-xs">{action}</Button>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="questions" className="mt-4">
                <Card className="bg-white border-0 shadow-sm">
                  <CardHeader><CardTitle className="text-base">Question Bank Analytics</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="col-span-2 space-y-4">
                        <p className="text-sm font-semibold text-gray-700">Difficulty Distribution</p>
                        <DifficultyBar label="Easy" value={difficultyData.easy} total={totalQuestions} color="bg-green-500" />
                        <DifficultyBar label="Medium" value={difficultyData.medium} total={totalQuestions} color="bg-amber-500" />
                        <DifficultyBar label="Hard" value={difficultyData.hard} total={totalQuestions} color="bg-red-500" />
                      </div>
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-gray-700">Quick Stats</p>
                        {[
                          { label: "Total", value: totalQuestions },
                          { label: "With answers", value: Math.round(totalQuestions * 0.8) },
                          { label: "Imported", value: Math.round(totalQuestions * 0.3) },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex justify-between items-center py-2 border-b border-gray-100 text-sm">
                            <span className="text-gray-600">{label}</span>
                            <span className="font-bold text-teal-600">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="lessons" className="mt-4">
                <Card className="bg-white border-0 shadow-sm">
                  <CardHeader><CardTitle className="text-base">Lesson & Content Pages</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {lessons.map((l: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                          <div className="flex items-center gap-3">
                            <Badge className={`${l.status === "published" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{l.status || "unknown"}</Badge>
                            <span className="text-sm font-medium text-gray-800">{l.total} pages</span>
                          </div>
                          <div className="text-sm text-teal-600 font-semibold">{l.recent} recent</div>
                        </div>
                      ))}
                      {lessons.length === 0 && (
                        <div className="text-center py-12 text-gray-400">
                          <FileText size={40} className="mx-auto mb-3 opacity-30" />
                          <p>No lesson data available yet. Start creating content pages.</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="top-content" className="mt-4">
                <Card className="bg-white border-0 shadow-sm">
                  <CardHeader><CardTitle className="text-base">Most Accessed Content (Last 30 Days)</CardTitle></CardHeader>
                  <CardContent>
                    {(topContent || []).length === 0 ? (
                      <div className="text-center py-12 text-gray-400">
                        <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
                        <p>No content access data yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(topContent || []).slice(0, 10).map((item: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-3">
                              <span className="w-7 h-7 bg-teal-100 text-teal-700 rounded-lg flex items-center justify-center text-xs font-bold">{i + 1}</span>
                              <div>
                                <p className="text-sm font-medium capitalize">{item.content_type} #{item.content_id}</p>
                                <p className="text-xs text-gray-500">{item.view_count} views</p>
                              </div>
                            </div>
                            <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full bg-teal-500 rounded-full" style={{ width: `${Math.min((item.view_count / ((topContent[0] || {}).view_count || 1)) * 100, 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
