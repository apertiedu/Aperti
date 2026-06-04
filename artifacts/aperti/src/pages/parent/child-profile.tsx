import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { BarChart3, ClipboardList, BookOpen, GraduationCap, Brain, ArrowLeft, User, Flame } from "lucide-react";

const TEAL = "#0D9488";
const authFetch = (url: string) => fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem("aperti_token") || ""}` } });

const TABS = ["Overview", "Performance", "Revision"];

export default function ChildProfile() {
  const params = useParams<{ studentId: string }>();
  const studentId = parseInt(params.studentId || "0");
  const [tab, setTab] = useState("Overview");

  const { data, isLoading } = useQuery({
    queryKey: ["parent-child-profile", studentId],
    queryFn: () => authFetch(`/api/parent/child/${studentId}`).then(r => r.json()),
    enabled: !!studentId,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!data?.student) {
    return (
      <div className="p-6 text-center text-gray-400">
        <p>Student not found or not linked to your account.</p>
        <Link href="/"><span className="text-teal-600 text-sm mt-2 block cursor-pointer">← Back to Dashboard</span></Link>
      </div>
    );
  }

  const { student, assessments, attendanceTrend, revisionHeatmap, assignmentOverview, ascend } = data;

  const attTotal = attendanceTrend?.reduce((a: number, r: any) => a + parseInt(r.total || "0"), 0) || 0;
  const attPresent = attendanceTrend?.reduce((a: number, r: any) => a + parseInt(r.present || "0"), 0) || 0;
  const attRate = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 0;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Back + header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <Link href="/">
          <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ background: TEAL }}>
          {(student.name || "S").slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900">{student.name}</h1>
          <p className="text-xs text-gray-400">{student.studentCode} · {student.email}</p>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === t ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="space-y-4">
          {/* Stat row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: ClipboardList, label: "Attendance", value: `${attRate}%`, color: "#0D9488", href: `/parent/attendance?child=${studentId}` },
              { icon: BarChart3, label: "Avg Grade", value: assessments?.length > 0 ? `${Math.round(assessments.reduce((a: number, e: any) => a + (parseFloat(e.scored || "0") / Math.max(parseFloat(e.possible || "1"), 1)) * 100, 0) / assessments.length)}%` : "—", color: "#6366f1", href: `/parent/grades?child=${studentId}` },
              { icon: BookOpen, label: "Submitted HW", value: assignmentOverview?.submitted || 0, color: "#f59e0b", href: `/parent/assignments?child=${studentId}` },
              { icon: Flame, label: "Streak", value: ascend?.streak || 0, color: "#ef4444", href: "/" },
            ].map((s, i) => (
              <Link key={i} href={s.href}>
                <Card className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <s.icon className="h-5 w-5 mb-2" style={{ color: s.color }} />
                    <p className="text-xl font-black text-gray-900">{s.value}</p>
                    <p className="text-xs text-gray-500">{s.label}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Subjects */}
          {student.subjects?.length > 0 && (
            <Card className="border border-gray-100 shadow-sm">
              <CardContent className="p-5">
                <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><GraduationCap className="h-4 w-4 text-teal-500" />Enrolled Subjects</h2>
                <div className="flex flex-wrap gap-2">
                  {student.subjects.map((s: any) => (
                    <Badge key={s.id} className="bg-teal-50 text-teal-700 border border-teal-100 rounded-full text-xs">{s.subject_name}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ascend level */}
          {ascend && (
            <Card className="border border-gray-100 shadow-sm">
              <CardContent className="p-5">
                <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><Flame className="h-4 w-4 text-amber-500" />Ascend Profile</h2>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center font-black text-amber-700 text-lg">{ascend.level}</div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{ascend.rank} · Level {ascend.level}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={(ascend.xp % 500) / 5} className="h-1.5 flex-1" />
                      <span className="text-[10px] text-gray-400">{ascend.xp.toLocaleString()} XP</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-amber-500">{ascend.streak}</p>
                    <p className="text-[10px] text-gray-400">day streak</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick links */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { href: `/parent/grades?child=${studentId}`, icon: BarChart3, label: "Grades", color: "bg-indigo-50 text-indigo-600" },
              { href: `/parent/attendance?child=${studentId}`, icon: ClipboardList, label: "Attendance", color: "bg-teal-50 text-teal-600" },
              { href: `/parent/assignments?child=${studentId}`, icon: BookOpen, label: "Assignments", color: "bg-amber-50 text-amber-600" },
              { href: `/parent/revision?child=${studentId}`, icon: Brain, label: "Revision", color: "bg-purple-50 text-purple-600" },
              { href: `/parent/exams?child=${studentId}`, icon: GraduationCap, label: "Exam Readiness", color: "bg-teal-50 text-teal-600" },
              { href: "/parent/messages", icon: User, label: "Message Teacher", color: "bg-gray-50 text-gray-600" },
            ].map((l, i) => (
              <Link key={i} href={l.href}>
                <div className={`flex items-center gap-2 p-3 rounded-xl border border-gray-100 cursor-pointer hover:shadow-sm transition-shadow ${l.color}`}>
                  <l.icon className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-medium">{l.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {tab === "Performance" && (
        <div className="space-y-4">
          {assessments?.length > 0 ? (
            <Card className="border border-gray-100 shadow-sm">
              <CardContent className="p-5">
                <h2 className="text-sm font-bold text-gray-800 mb-4">Assessment Timeline</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {assessments.map((a: any, i: number) => {
                    const pct = a.possible > 0 ? Math.round((a.scored / a.possible) * 100) : 0;
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                        <div>
                          <p className="text-xs font-semibold text-gray-800">{a.title}</p>
                          <p className="text-[10px] text-gray-400">{a.date ? new Date(a.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "No date"}</p>
                        </div>
                        <div className="ml-auto text-right">
                          <p className="text-sm font-black" style={{ color: pct >= 70 ? "#0D9488" : pct >= 50 ? "#f59e0b" : "#ef4444" }}>{pct}%</p>
                          <p className="text-[10px] text-gray-400">{a.scored}/{a.possible}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-16 text-gray-400 text-sm">No assessment data yet</div>
          )}
        </div>
      )}

      {tab === "Revision" && (
        <div className="space-y-4">
          {revisionHeatmap?.length > 0 ? (
            <Card className="border border-gray-100 shadow-sm">
              <CardContent className="p-5">
                <h2 className="text-sm font-bold text-gray-800 mb-4">Study Activity (Last 90 Days)</h2>
                <div className="flex flex-wrap gap-1">
                  {(() => {
                    const map = new Map((revisionHeatmap || []).map((d: any) => [d.day?.split("T")[0], d.minutes]));
                    return Array.from({ length: 90 }, (_, i) => {
                      const d = new Date(); d.setDate(d.getDate() - (89 - i));
                      const key = d.toISOString().split("T")[0];
                      const mins = (map.get(key) as number) || 0;
                      const opacity = mins === 0 ? 0 : Math.min(1, 0.2 + (mins / 120) * 0.8);
                      return <div key={i} className="w-3.5 h-3.5 rounded-sm" style={{ background: mins > 0 ? `rgba(13,148,136,${opacity})` : "#f0f0f0" }} title={`${Math.round(mins)}min`} />;
                    });
                  })()}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-16 text-gray-400 text-sm">No revision data yet</div>
          )}
        </div>
      )}
    </div>
  );
}
