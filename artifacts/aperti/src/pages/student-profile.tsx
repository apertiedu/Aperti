import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AttendanceHeatmap from "@/components/heatmap";
import { motion } from "framer-motion";
import {
  ChevronLeft, AlertTriangle, CheckCircle2, Info, TrendingUp, TrendingDown,
  Users, Target, BookOpen, Award, Activity, Phone, MessageSquare, Star,
  Zap, ClipboardList
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { useAuth } from "@/context/auth";

type Insight = { type: "success" | "warning" | "info"; text: string };
type ExamResult = { examId: number; examName: string; examDate: string | null; totalScored: number; totalMax: number; percentage: number };
type TopicStat = { topic: string; percentage: number; scored: number; max: number };

const INSIGHT_STYLES: Record<string, { icon: typeof Info; bg: string; text: string; border: string }> = {
  success: { icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  warning: { icon: AlertTriangle, bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  info: { icon: Info, bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
};

const GRADE_BG: Record<string, string> = {
  "A*": "bg-purple-100 text-purple-700", A: "bg-emerald-100 text-emerald-700",
  B: "bg-blue-100 text-blue-700", C: "bg-amber-100 text-amber-700",
  D: "bg-orange-100 text-orange-700", E: "bg-red-100 text-red-700",
  U: "bg-red-200 text-red-800", "N/A": "bg-muted text-muted-foreground",
};

const RISK_STYLE: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};

export default function StudentProfile() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const studentId = parseInt(params.id, 10);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/students/${studentId}/profile`, { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject("Not found"))
      .then(setData)
      .catch(() => setError("Student not found or access denied"))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded w-48" />
        <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />)}</div>
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">{error || "Failed to load student profile"}</p>
        <Button variant="outline" onClick={() => navigate("/students")}>Back to Students</Button>
      </div>
    );
  }

  const { student, attendance, exams, prediction, insights, archetype, actionPlan } = data;
  const trendDir = exams.examTrend !== null ? (exams.examTrend > 0 ? "up" : exams.examTrend < 0 ? "down" : "flat") : "flat";

  const kpiCards = [
    { label: "Attendance Rate", value: `${attendance.overallRate}%`, sub: `${attendance.totalPresent}P / ${attendance.totalAbsent}A`, icon: Target, color: attendance.overallRate >= 80 ? "text-emerald-600" : attendance.overallRate >= 60 ? "text-amber-600" : "text-red-600", bg: "bg-emerald-50" },
    { label: "Exam Average", value: exams.avgExamPercent !== null ? `${exams.avgExamPercent}%` : "—", sub: `${exams.results.length} exam${exams.results.length !== 1 ? "s" : ""}`, icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Predicted Grade", value: prediction.predictedGrade, sub: "IGCSE estimate", icon: Award, color: "text-primary", bg: "bg-primary/10" },
    { label: "Risk Level", value: prediction.riskLevel.charAt(0).toUpperCase() + prediction.riskLevel.slice(1), sub: `Score: ${prediction.riskScore}/100`, icon: Activity, color: prediction.riskLevel === "low" ? "text-emerald-600" : prediction.riskLevel === "medium" ? "text-amber-600" : "text-red-600", bg: prediction.riskLevel === "low" ? "bg-emerald-50" : prediction.riskLevel === "medium" ? "bg-amber-50" : "bg-red-50" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/students")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{student.studentName}</h1>
            <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{student.studentCode}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${GRADE_BG[prediction.predictedGrade]}`}>{prediction.predictedGrade}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${RISK_STYLE[prediction.riskLevel]}`}>
              {prediction.riskLevel} risk
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {student.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{student.phone}</span>}
            {student.parentPhone && <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{student.parentPhone}</span>}
            {student.notes && <span className="italic">{student.notes}</span>}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(card => (
          <Card key={card.label} className="border-border/50 shadow-sm">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
                </div>
                <div className={`${card.bg} p-2 rounded-lg`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Archetype Banner */}
      {archetype && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className={`rounded-2xl p-5 flex items-center gap-4 border ${
            archetype.priority === "critical" ? "bg-red-50 border-red-200" :
            archetype.priority === "excellent" ? "bg-emerald-50 border-emerald-200" :
            archetype.priority === "watch" ? "bg-amber-50 border-amber-200" :
            "bg-blue-50 border-blue-200"
          }`}>
          <div className="text-3xl">{archetype.emoji}</div>
          <div className="flex-1">
            <p className="font-bold text-base text-gray-900">{archetype.name}</p>
            <p className="text-sm text-gray-600 mt-0.5">{archetype.description}</p>
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide flex-shrink-0 ${
            archetype.priority === "critical" ? "bg-red-100 text-red-700" :
            archetype.priority === "excellent" ? "bg-emerald-100 text-emerald-700" :
            archetype.priority === "watch" ? "bg-amber-100 text-amber-700" :
            "bg-blue-100 text-blue-700"
          }`}>
            {archetype.priority}
          </span>
        </motion.div>
      )}

      {/* AI Insights */}
      {insights.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">AI Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((insight: Insight, i: number) => {
              const style = INSIGHT_STYLES[insight.type];
              const Icon = style.icon;
              return (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${style.bg} ${style.border}`}>
                  <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${style.text}`} />
                  <p className={`text-sm ${style.text}`}>{insight.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Attendance Heatmap */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />Attendance History (Last 26 Weeks)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceHeatmap data={attendance.heatmap} weeks={26} />
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/50">
            <div className="text-center">
              <p className="text-xl font-bold text-emerald-600">{attendance.recentRate}%</p>
              <p className="text-xs text-muted-foreground">Last 4 weeks</p>
            </div>
            <div className="text-center">
              <p className={`text-xl font-bold flex items-center justify-center gap-1 ${attendance.recentRate > attendance.olderRate ? "text-emerald-600" : attendance.recentRate < attendance.olderRate ? "text-red-600" : "text-muted-foreground"}`}>
                {attendance.recentRate > attendance.olderRate ? <TrendingUp className="h-4 w-4" /> : attendance.recentRate < attendance.olderRate ? <TrendingDown className="h-4 w-4" /> : null}
                {Math.abs(attendance.recentRate - attendance.olderRate)}%
              </p>
              <p className="text-xs text-muted-foreground">vs prior 4 weeks</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold">{attendance.olderRate}%</p>
              <p className="text-xs text-muted-foreground">Prior 4 weeks</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Exam trend */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />Exam Performance
              {exams.examTrend !== null && (
                <span className={`ml-auto text-sm font-semibold ${trendDir === "up" ? "text-emerald-600" : trendDir === "down" ? "text-red-600" : "text-muted-foreground"}`}>
                  {trendDir === "up" ? "+" : ""}{Math.round(exams.examTrend)}%
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {exams.results.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-lg">No exam results yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={exams.results} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="examName" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 10 }} unit="%" />
                  <Tooltip formatter={(v: number) => [`${v}%`, "Score"]} contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0/0.1)" }} />
                  <Line type="monotone" dataKey="percentage" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Topic mastery */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />Topic Mastery
            </CardTitle>
          </CardHeader>
          <CardContent>
            {exams.topicStats.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-lg">No topic data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={exams.topicStats} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                  <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 10 }} unit="%" />
                  <YAxis type="category" dataKey="topic" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 10 }} width={80} />
                  <Tooltip formatter={(v: number) => [`${v}%`, "Score"]} contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0/0.1)" }} />
                  <Bar dataKey="percentage" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {exams.topicStats.map((entry: TopicStat, i: number) => (
                      <rect key={i} fill={entry.percentage >= 80 ? "#10b981" : entry.percentage >= 60 ? "hsl(var(--primary))" : entry.percentage >= 40 ? "#f59e0b" : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Plan */}
      {actionPlan && actionPlan.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />Personalised Action Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {actionPlan.map((item: { category: string; priority: "high" | "medium" | "low"; action: string; icon: string }, i: number) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${
                  item.priority === "high" ? "bg-red-50 border-red-100" :
                  item.priority === "medium" ? "bg-amber-50 border-amber-100" :
                  "bg-gray-50 border-gray-100"
                }`}>
                  <div className="text-xl flex-shrink-0 mt-0.5">{item.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-gray-700">{item.category}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                        item.priority === "high" ? "bg-red-100 text-red-600" :
                        item.priority === "medium" ? "bg-amber-100 text-amber-600" :
                        "bg-gray-200 text-gray-500"
                      }`}>{item.priority}</span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{item.action}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Exam results table */}
      {exams.results.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base">Exam Results</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Exam</th>
                  <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Date</th>
                  <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Score</th>
                  <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {(exams.results as ExamResult[]).map(r => (
                  <tr key={r.examId} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{r.examName}</td>
                    <td className="px-3 py-2.5 text-center text-muted-foreground text-xs">
                      {r.examDate ? new Date(r.examDate + "T00:00:00").toLocaleDateString("en-GB") : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`font-semibold ${r.percentage >= 70 ? "text-emerald-600" : r.percentage >= 50 ? "text-amber-600" : "text-red-600"}`}>
                        {r.totalScored} / {r.totalMax} ({r.percentage}%)
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${r.percentage >= 80 ? "bg-emerald-100 text-emerald-700" : r.percentage >= 60 ? "bg-blue-100 text-blue-700" : r.percentage >= 40 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                        {r.percentage >= 90 ? "A*" : r.percentage >= 80 ? "A" : r.percentage >= 70 ? "B" : r.percentage >= 60 ? "C" : r.percentage >= 50 ? "D" : r.percentage >= 40 ? "E" : "U"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
