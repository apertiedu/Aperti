import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import ParentSnapshot from "@/components/parent-snapshot";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, CheckCircle2, BookOpen, TrendingUp, Clock, AlertTriangle,
  MessageSquare, Calendar, FileText, ChevronRight, Trophy,
  BarChart3, Star, Flame, Bell, Zap, Sparkles
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TEAL = "#0D9488";
const authFetch = (url: string, opts?: RequestInit) =>
  fetch(url, { ...opts, credentials: "include", headers: { "Content-Type": "application/json", ...(opts?.headers || {}) } });

interface ChildData {
  linkId: number;
  studentId: number;
  name: string;
  email: string;
  studentCode: string;
  todayAttendance: string;
  attendanceRate: number;
  todayLessons: Array<{ subject_name: string; session_time: string }>;
  upcomingDeadlines: Array<{ id: number; title: string; due_date: string; subject_name: string }>;
  recentMessages: Array<{ id: number; message: string; created_at: string; from_name: string }>;
  avgGrade: number;
  revisionCompleted: number;
  revisionTotal: number;
  interventionAlerts: Array<{ id: number; type: string; risk_level: string; message: string }>;
  ascend: { level: number; xp: number; rank: string; streak: number } | null;
}

function getRiskColor(level: string) {
  switch (level) {
    case "critical": return "bg-red-100 text-red-700 border-red-200";
    case "high": return "bg-orange-100 text-orange-700 border-orange-200";
    case "moderate": return "bg-amber-100 text-amber-700 border-amber-200";
    default: return "bg-blue-100 text-blue-700 border-blue-200";
  }
}

function getGradeLabel(pct: number) {
  if (pct >= 90) return "A*";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "E";
}

function getAttendanceBadge(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "present") return <Badge className="bg-emerald-100 text-emerald-700 text-[10px] rounded-full">Present today</Badge>;
  if (s === "absent") return <Badge className="bg-red-100 text-red-700 text-[10px] rounded-full">Absent today</Badge>;
  if (s === "late") return <Badge className="bg-amber-100 text-amber-700 text-[10px] rounded-full">Late today</Badge>;
  return <Badge className="bg-gray-100 text-gray-500 text-[10px] rounded-full">Not recorded</Badge>;
}

function ChildCard({ child, selected, onSelect }: { child: ChildData; selected: boolean; onSelect: () => void }) {
  const initials = (child.name || "S").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <button
      onClick={onSelect}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${
        selected ? "border-teal-500 bg-teal-50 shadow-sm" : "border-border bg-card hover:border-teal-200"
      }`}
    >
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: TEAL }}>{initials}</div>
      <div className="text-left">
        <p className={`text-sm font-semibold ${selected ? "text-teal-700" : "text-gray-800"}`}>{child.name}</p>
        <p className="text-[10px] text-gray-400">{child.studentCode}</p>
      </div>
      {child.interventionAlerts.length > 0 && (
        <span className="ml-1 w-5 h-5 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">{child.interventionAlerts.length}</span>
      )}
    </button>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <Card className="border border-border/40 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
            <Icon className="h-4 w-4" style={{ color }} />
          </div>
        </div>
        <p className="text-2xl font-black text-foreground tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground font-medium mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function ParentDashboard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedIdx, setSelectedIdx] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["parent-dashboard"],
    queryFn: () => authFetch("/api/parent/dashboard").then(r => r.json()),
    refetchInterval: 60000,
  });

  const resolveAlert = useMutation({
    mutationFn: (id: number) => authFetch(`/api/parent/resolve-alert/${id}`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["parent-dashboard"] }); toast({ title: "Alert resolved" }); },
  });

  const children: ChildData[] = data?.children || [];
  const child = children[selectedIdx];

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0,1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!children.length) {
    return (
      <div className="p-6">
        <div className="bg-card rounded-2xl border border-dashed border-border p-16 text-center empty-bg">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 bg-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-extrabold text-foreground mb-2">No children linked yet</h3>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-6">
            Get your pairing code and share it with your child so they can link their account.
          </p>
          <Link href="/parent/link-student">
            <Button className="gap-2 rounded-xl">
              Get Pairing Code <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground">GuardianHub<span className="text-primary">.</span></h1>
          <p className="text-muted-foreground text-sm mt-0.5">Your children's learning, at a glance.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/parent/messages">
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs"><MessageSquare className="h-3.5 w-3.5" /> Messages</Button>
          </Link>
          <Link href="/parent/meetings">
            <Button size="sm" className="rounded-xl gap-1.5 text-xs text-white" style={{ background: TEAL }}><Calendar className="h-3.5 w-3.5" /> Schedule</Button>
          </Link>
        </div>
      </motion.div>

      {/* Child Switcher */}
      {children.length > 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-2">
          {children.map((c, i) => (
            <ChildCard key={c.studentId} child={c} selected={i === selectedIdx} onSelect={() => setSelectedIdx(i)} />
          ))}
        </motion.div>
      )}

      {child && (
        <>
          {/* Mobile compact snapshot (hidden on desktop) */}
          <div className="md:hidden">
            <ParentSnapshot child={child} />
          </div>

          {/* Top stat row (desktop) */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="hidden md:grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={CheckCircle2} label="Attendance" value={`${child.attendanceRate}%`} sub="This term" color="#0D9488" />
            <StatCard icon={BarChart3} label="Avg Grade" value={child.avgGrade ? `${child.avgGrade}%` : "—"} sub={child.avgGrade ? getGradeLabel(child.avgGrade) : "No data"} color="#6366f1" />
            <StatCard icon={BookOpen} label="Upcoming Tasks" value={child.upcomingDeadlines.length} sub="Due this week" color="#f59e0b" />
            <StatCard icon={Flame} label="Streak" value={child.ascend?.streak ?? 0} sub={`Level ${child.ascend?.level ?? 1} · ${child.ascend?.rank ?? "Bronze"}`} color="#ef4444" />
          </motion.div>

          {/* ── What's Important ── */}
          {(() => {
            const insights: Array<{ icon: any; bg: string; color: string; text: string; href: string }> = [];
            if (child.interventionAlerts.length > 0)
              insights.push({ icon: AlertTriangle, bg: "bg-red-50 border-red-100", color: "text-red-600", text: `${child.interventionAlerts.length} alert${child.interventionAlerts.length > 1 ? "s" : ""} need your attention`, href: "/parent/interventions" });
            if (child.attendanceRate < 80)
              insights.push({ icon: Clock, bg: "bg-amber-50 border-amber-100", color: "text-amber-600", text: `Attendance is ${child.attendanceRate}% — speak to the teacher`, href: "/parent/attendance" });
            if (child.avgGrade && child.avgGrade < 60)
              insights.push({ icon: TrendingUp, bg: "bg-purple-50 border-purple-100", color: "text-purple-600", text: `Average grade ${child.avgGrade}% — consider extra support`, href: "/parent/grades" });
            if (child.upcomingDeadlines.length > 0 && insights.length < 3)
              insights.push({ icon: BookOpen, bg: "bg-blue-50 border-blue-100", color: "text-blue-600", text: `${child.upcomingDeadlines.length} assignment${child.upcomingDeadlines.length > 1 ? "s" : ""} due this week`, href: "/parent/assignments" });
            if (insights.length === 0)
              insights.push({ icon: Sparkles, bg: "bg-emerald-50 border-emerald-100", color: "text-emerald-600", text: `${child.name?.split(" ")[0] || "Your child"} is on track — great job!`, href: "/parent/reports" });
            return (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap className="w-3.5 h-3.5 text-teal-600" />
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">What's Important</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {insights.map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <Link key={i} href={item.href}>
                        <div className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer hover:shadow-sm transition-all ${item.bg} group`}>
                          <Icon className={`w-4 h-4 shrink-0 ${item.color}`} />
                          <p className={`text-xs font-semibold leading-tight flex-1 ${item.color}`}>{item.text}</p>
                          <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${item.color} opacity-50 group-hover:opacity-100`} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            );
          })()}

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Daily Snapshot */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2 space-y-4">
              <Card className="border border-border/40 shadow-sm overflow-hidden">
                <div className="h-1 bg-primary" />
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                          {(child.name || "S").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h2 className="font-bold text-foreground">{child.name}</h2>
                          <div className="flex items-center gap-1.5 mt-0.5">{getAttendanceBadge(child.todayAttendance)}</div>
                        </div>
                      </div>
                    </div>
                    <Link href={`/parent/child/${child.studentId}`}>
                      <Button variant="ghost" size="sm" className="text-xs gap-1 text-teal-600">
                        Full Profile <ChevronRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>

                  {/* Today's lessons */}
                  {child.todayLessons.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Today's Classes</p>
                      <div className="flex flex-wrap gap-2">
                        {child.todayLessons.map((l, i) => (
                          <span key={i} className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20 font-medium">
                            {l.subject_name || "Class"} {l.session_time ? `· ${l.session_time}` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Revision progress */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-primary" />Revision Progress</span>
                      <span className="text-xs font-bold text-foreground">{child.revisionCompleted}/{child.revisionTotal} goals</span>
                    </div>
                    <Progress value={child.revisionTotal > 0 ? (child.revisionCompleted / child.revisionTotal) * 100 : 0} className="h-2" />
                  </div>

                  {/* Quick actions */}
                  <div className="flex flex-wrap gap-2">
                    <Link href="/parent/messages">
                      <Button variant="outline" size="sm" className="text-xs rounded-lg gap-1.5"><MessageSquare className="h-3 w-3" /> Message Teacher</Button>
                    </Link>
                    <Link href="/parent/meetings">
                      <Button variant="outline" size="sm" className="text-xs rounded-lg gap-1.5"><Calendar className="h-3 w-3" /> Schedule Meeting</Button>
                    </Link>
                    <Link href="/parent/reports">
                      <Button variant="outline" size="sm" className="text-xs rounded-lg gap-1.5"><FileText className="h-3 w-3" /> View Report</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Academic summary */}
              <div className="grid grid-cols-2 gap-4">
                <Link href={`/parent/grades?child=${child.studentId}`}>
                  <Card className="border border-border/40 shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <BarChart3 className="h-5 w-5 text-indigo-500" />
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                      <p className="text-xl font-black text-foreground tabular-nums">{child.avgGrade ? `${child.avgGrade}%` : "—"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Average Grade</p>
                    </CardContent>
                  </Card>
                </Link>
                <Link href={`/parent/attendance?child=${child.studentId}`}>
                  <Card className="border border-border/40 shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                      <p className="text-xl font-black text-foreground tabular-nums">{child.attendanceRate}%</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Attendance Rate</p>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </motion.div>

            {/* Right column */}
            <div className="space-y-4">
              {/* Upcoming deadlines */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                <Card className="border border-border/40 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5"><Clock className="h-4 w-4 text-amber-500" />Upcoming Deadlines</h3>
                      <Link href={`/parent/assignments?child=${child.studentId}`}><span className="text-[10px] text-primary font-medium cursor-pointer">See all</span></Link>
                    </div>
                    {child.upcomingDeadlines.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">No upcoming deadlines 🎉</p>
                    ) : (
                      <div className="space-y-2">
                        {child.upcomingDeadlines.slice(0, 3).map(hw => (
                          <div key={hw.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800/40">
                            <BookOpen className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{hw.title}</p>
                              <p className="text-[10px] text-muted-foreground">{hw.subject_name} · Due {new Date(hw.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Risk Alerts */}
              {child.interventionAlerts.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
                  <Card className="border border-red-100 shadow-sm">
                    <CardContent className="p-5">
                      <h3 className="text-sm font-bold text-red-700 flex items-center gap-1.5 mb-3">
                        <AlertTriangle className="h-4 w-4" /> Alerts ({child.interventionAlerts.length})
                      </h3>
                      <div className="space-y-2">
                        {child.interventionAlerts.slice(0, 3).map(alert => (
                          <div key={alert.id} className={`p-2.5 rounded-lg border text-xs ${getRiskColor(alert.risk_level)}`}>
                            <div className="flex items-center justify-between mb-0.5">
                              <Badge className={`text-[9px] rounded-full px-2 py-0 ${getRiskColor(alert.risk_level)}`}>{alert.risk_level}</Badge>
                              <button onClick={() => resolveAlert.mutate(alert.id)} className="text-[9px] underline opacity-60 hover:opacity-100">Resolve</button>
                            </div>
                            <p className="leading-snug mt-1">{alert.message}</p>
                          </div>
                        ))}
                      </div>
                      <Link href="/parent/interventions">
                        <Button variant="ghost" size="sm" className="w-full mt-2 text-xs text-red-600 hover:bg-red-50">View all alerts</Button>
                      </Link>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Achievement Feed */}
              {child.ascend && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
                  <Card className="border border-border/40 shadow-sm">
                    <CardContent className="p-5">
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-3"><Trophy className="h-4 w-4 text-amber-500" />Progress</h3>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800/40">
                        <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center text-white font-black text-sm">
                          {child.ascend.level}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">{child.ascend.rank}</p>
                          <p className="text-[10px] text-muted-foreground">{child.ascend.xp.toLocaleString()} XP · {child.ascend.streak} day streak</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Recent messages */}
              {child.recentMessages.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                  <Card className="border border-border/40 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5"><MessageSquare className="h-4 w-4 text-primary" />Recent Messages</h3>
                        <Link href="/parent/messages"><span className="text-[10px] text-primary font-medium cursor-pointer">Open</span></Link>
                      </div>
                      <div className="space-y-2">
                        {child.recentMessages.slice(0, 2).map(msg => (
                          <div key={msg.id} className="p-2.5 rounded-lg bg-muted/50 border border-border/40">
                            <p className="text-[10px] font-semibold text-primary">{msg.from_name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{msg.message}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
