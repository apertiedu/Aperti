import { apiFetch } from "@/lib/api";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, CheckSquare, Flame, Award, ChevronRight, Target, Star, Shield, Lock, Layers, Video, Sparkles, Clock, Wifi, Building2, CalendarDays, ExternalLink, Zap, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/auth";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import MomentumScore from "@/components/momentum-score";
import WhatNextCard from "@/components/what-next-card";

type PortalData = {
  student: any;
  stats: { attendanceRate: number; present: number; absent: number; total: number; streak: number };
  latestExam: { examName: string; percentage: number } | null;
  upcomingHomework: { id: number; title: string; dueDate: string | null; subjectName: string | null; submissionStatus: string | null }[];
};

type MySession = {
  id: number; lessonNumber: number; dayOfWeek: string; startTime: string;
  type: string; onlineLink: string | null; subjectName: string | null;
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function CircleProgress({ rate }: { rate: number }) {
  const r = 54; const circ = 2 * Math.PI * r;
  const dash = (rate / 100) * circ;
  const color = rate >= 85 ? "#10b981" : rate >= 70 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={130} height={130} className="-rotate-90 drop-shadow-sm">
        <circle cx={65} cy={65} r={r} fill="none" stroke="currentColor" className="text-muted" strokeWidth={10} />
        <motion.circle
          cx={65} cy={65} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
        />
      </svg>
      <div className="absolute text-center flex flex-col items-center justify-center">
        <motion.p
          className="text-3xl font-black text-foreground"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >{rate}%</motion.p>
      </div>
    </div>
  );
}

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4, ease: "easeOut" } }),
} as any;

export default function StudentDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [todaySessions, setTodaySessions] = useState<MySession[]>([]);

  const todayName = DAY_NAMES[new Date().getDay()];

  useEffect(() => {
    apiFetch("/api/portal/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => { })
      .finally(() => setLoading(false));
    apiFetch("/api/portal/timetable", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((sessions: MySession[]) => setTodaySessions(sessions.filter(s => s.dayOfWeek === todayName)));
  }, [todayName]);

  const firstName = data?.student?.studentName?.split(" ")[0] || user?.displayName?.split(" ")[0] || "there";
  const rate = data?.stats.attendanceRate ?? 0;
  const streak = data?.stats.streak ?? 0;
  const examScore = data?.latestExam?.percentage ?? 0;

  const badges = [
    { id: "perfect-week", name: "Perfect Week", desc: "100% attendance this week", icon: Star, earned: rate > 0 /* simplifed logic */, color: "text-amber-500 bg-amber-100 dark:bg-amber-900/30" },
    { id: "top-performer", name: "Top Performer", desc: "90%+ in latest exam", icon: Trophy, earned: examScore >= 90, color: "text-purple-500 bg-purple-100 dark:bg-purple-900/30" },
    { id: "consistent", name: "Consistent", desc: "7+ day streak", icon: Flame, earned: streak >= 7, color: "text-orange-500 bg-orange-100 dark:bg-orange-900/30" },
    { id: "rising-star", name: "Rising Star", desc: "85%+ attendance & 75%+ exam", icon: Sparkles, earned: rate >= 85 && examScore >= 75, color: "text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30" },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 skeleton rounded-2xl w-72" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-48 skeleton rounded-2xl" />)}</div>
      </div>
    );
  }

  // Get days for streak calendar
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const currentDayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

  const overdueCount = data?.upcomingHomework?.filter((hw: any) => hw.dueDate && hw.dueDate < new Date().toISOString().split("T")[0]).length ?? 0;
  const focusItems: Array<{ icon: any; color: string; bg: string; text: string; href: string }> = [];
  if (overdueCount > 0)
    focusItems.push({ icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50 border-red-100", text: `${overdueCount} overdue task${overdueCount > 1 ? "s" : ""} — submit now`, href: "/my-homework" });
  if (todaySessions.length > 0)
    focusItems.push({ icon: Clock, color: "text-teal-600", bg: "bg-teal-50 border-teal-100", text: `${todaySessions.length} session${todaySessions.length > 1 ? "s" : ""} today — stay on track`, href: "/my-timetable" });
  if (rate < 80)
    focusItems.push({ icon: CheckSquare, color: "text-amber-600", bg: "bg-amber-50 border-amber-100", text: `Attendance at ${rate}% — aim for 90% this term`, href: "/my-attendance" });
  if (focusItems.length === 0)
    focusItems.push({ icon: Sparkles, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100", text: "You're all caught up — great work today!", href: "/success" });

  return (
    <div className="space-y-6 pb-6">
      {/* ── Intelligence Row: Momentum + What's Next ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MomentumScore />
        <WhatNextCard />
      </div>

      {/* ── Your Focus Today ── */}
      {focusItems.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Your Focus Today</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {focusItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                  <a href={item.href} className={`flex items-center gap-3 p-3 rounded-xl border ${item.bg} hover:shadow-sm transition-all cursor-pointer group`}>
                    <Icon className={`w-4 h-4 shrink-0 ${item.color}`} />
                    <p className={`text-xs font-semibold leading-tight ${item.color}`}>{item.text}</p>
                    <ChevronRight className={`w-3.5 h-3.5 ml-auto shrink-0 ${item.color} opacity-60 group-hover:opacity-100`} />
                  </a>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Streak Banner if active */}
      <AnimatePresence>
        {streak > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: "auto" }}
            className="bg-gradient-to-r from-orange-500 to-rose-500 rounded-2xl p-4 text-white shadow-lg shadow-orange-500/20 flex items-center justify-between overflow-hidden relative"
          >
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/10 blur-2xl transform skew-x-12" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="bg-white/20 p-2 rounded-xl">
                <Flame className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">{streak} Session Streak!</h3>
                <p className="text-orange-100 text-xs font-medium">Keep the momentum going.</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 relative z-10">
              {days.map((d, i) => {
                const isPast = i < currentDayIndex;
                const isToday = i === currentDayIndex;
                return (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isToday ? "bg-white text-orange-500 shadow-sm scale-110 ring-2 ring-white/50 ring-offset-2 ring-offset-orange-500" :
                      isPast && streak > (currentDayIndex - i) ? "bg-white/30 text-white" :
                      "bg-black/10 text-white/50"
                    }`}>
                      {d}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Greeting & Motivation Card */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-3xl sm:text-4xl font-black text-foreground">{getGreeting()}, {firstName}! 👋</h1>
        
        <div className="mt-4 bg-card border border-border p-4 rounded-2xl shadow-sm flex items-start gap-4">
          <div className="text-4xl shrink-0">💡</div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Today's Tip</span>
            <p className="text-foreground font-medium text-sm mt-0.5">
              {rate >= 90 ? "You're doing fantastic! Consistent attendance is the #1 predictor of top grades." :
               rate >= 80 ? "Good work so far. Try to hit that 90% attendance goal this term!" :
               "Every session counts. Let's make an effort to attend all classes this week."}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Attendance Ring & Goal */}
        <motion.div custom={0} variants={CARD_VARIANTS} initial="hidden" animate="show"
          className="bg-card rounded-2xl p-5 shadow-sm border border-border flex flex-col items-center justify-between card-hover">
          <h3 className="font-bold text-sm w-full text-left mb-2 flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-primary" /> Attendance Status
          </h3>
          <CircleProgress rate={rate} />
          <div className="w-full mt-4 space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Term Goal: 90%</span>
              <span className={rate >= 90 ? "text-emerald-500" : "text-amber-500"}>{rate}/90</span>
            </div>
            <Progress value={(rate/90)*100} className="h-2" />
          </div>
        </motion.div>

        {/* Latest Exam / Top Performer */}
        <motion.div custom={1} variants={CARD_VARIANTS} initial="hidden" animate="show"
          className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 shadow-md text-primary-foreground flex flex-col justify-between card-hover relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <Target className="w-32 h-32" />
          </div>
          <div className="flex items-center gap-2 relative z-10">
            <Award className="h-5 w-5" />
            <span className="text-sm font-bold opacity-90">Latest Exam Result</span>
          </div>
          {data?.latestExam ? (
            <div className="relative z-10 mt-4">
              <p className="text-5xl font-black drop-shadow-sm">{data.latestExam.percentage}%</p>
              <p className="text-sm font-medium opacity-90 mt-1 truncate">{data.latestExam.examName}</p>
              <div className="mt-4 bg-black/10 rounded-xl p-3 backdrop-blur-sm">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  {examScore >= 80 ? "🌟 Top tier performance!" : examScore >= 60 ? "👍 Solid understanding" : "📚 Needs more practice"}
                </p>
              </div>
            </div>
          ) : (
            <div className="relative z-10 mt-4">
              <p className="text-2xl font-bold opacity-70">No exams yet</p>
              <p className="text-sm opacity-60 mt-1">Complete an exam to see stats</p>
            </div>
          )}
        </motion.div>

        {/* Badges Box */}
        <motion.div custom={2} variants={CARD_VARIANTS} initial="hidden" animate="show"
          className="bg-card rounded-2xl p-5 shadow-sm border border-border flex flex-col card-hover">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-500" /> Achievements
          </h3>
          <div className="grid grid-cols-2 gap-3 flex-1">
            {badges.map(badge => (
              <div key={badge.id} className={`flex flex-col items-center justify-center p-2 rounded-xl text-center transition-all ${badge.earned ? badge.color : "bg-muted/50 text-muted-foreground grayscale opacity-60"}`}>
                <div className="relative">
                  <badge.icon className="w-6 h-6 mb-1" />
                  {!badge.earned && <Lock className="w-3 h-3 absolute -bottom-1 -right-1" />}
                </div>
                <span className="text-[10px] font-bold leading-tight">{badge.name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Homework */}
        <motion.div custom={3} variants={CARD_VARIANTS} initial="hidden" animate="show"
          className="lg:col-span-2 bg-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
            <h2 className="font-bold text-foreground flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" />Action Items</h2>
            <button onClick={() => navigate("/homework")} className="text-xs text-primary hover:text-primary/80 font-semibold transition-colors flex items-center">
              View all <ChevronRight className="h-3 w-3 ml-0.5" />
            </button>
          </div>
          
          <div className="flex-1 flex flex-col">
            {!data?.upcomingHomework?.length ? (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-muted-foreground text-sm">
                <div className="bg-muted p-4 rounded-full mb-3"><BookOpen className="h-6 w-6 opacity-40" /></div>
                <span className="font-medium">All caught up!</span>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.upcomingHomework.map((hw, i) => {
                  const isOverdue = hw.dueDate && hw.dueDate < new Date().toISOString().split("T")[0];
                  const submitted = hw.submissionStatus && hw.submissionStatus !== "draft";
                  return (
                    <motion.div key={hw.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i*0.1 }}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors cursor-pointer group"
                      onClick={() => navigate("/homework")}>
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 shadow-sm ${submitted ? "bg-emerald-500 shadow-emerald-500/40" : isOverdue ? "bg-red-500 shadow-red-500/40 animate-pulse" : "bg-amber-500 shadow-amber-500/40"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{hw.title}</p>
                        <p className="text-xs text-muted-foreground font-medium mt-0.5">{hw.subjectName || "General"}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {hw.dueDate ? (
                          <div className={`text-xs font-bold px-2 py-1 rounded-md ${isOverdue && !submitted ? "bg-red-100 text-red-600 dark:bg-red-900/30" : "bg-muted text-muted-foreground"}`}>
                            {isOverdue ? "Overdue" : format(new Date(hw.dueDate), "dd MMM")}
                          </div>
                        ) : <span className="text-xs text-muted-foreground">No deadline</span>}
                        {submitted && <p className="text-[10px] text-emerald-500 font-bold mt-1 uppercase tracking-wider">Submitted</p>}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* Today's Sessions */}
        {todaySessions.length > 0 && (
          <motion.div custom={3} variants={CARD_VARIANTS} initial="hidden" animate="show"
            className="lg:col-span-2 bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />Today's Sessions
              </h2>
              <button onClick={() => navigate("/timetable")} className="text-xs text-primary hover:text-primary/80 font-semibold transition-colors flex items-center">
                Full timetable <ChevronRight className="h-3 w-3 ml-0.5" />
              </button>
            </div>
            <div className="divide-y divide-border">
              {todaySessions.map((s, i) => (
                <motion.div key={s.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.07 }}
                  className="flex items-center gap-4 px-5 py-3.5">
                  <div className="bg-primary/10 p-2 rounded-xl shrink-0">
                    <Clock className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{s.subjectName ?? "No Subject"}</p>
                    <p className="text-xs text-muted-foreground">Lesson {s.lessonNumber} · {s.startTime?.slice(0, 5)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.type === "online" ? (
                      <span className="flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                        <Wifi className="w-3 h-3" /> Online
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                        <Building2 className="w-3 h-3" /> Centre
                      </span>
                    )}
                    {s.type === "online" && s.onlineLink && (
                      <a href={s.onlineLink} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline">
                        <ExternalLink className="w-3 h-3" /> Join
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Quick Tools */}
        <motion.div custom={4} variants={CARD_VARIANTS} initial="hidden" animate="show" className="flex flex-col gap-3">
          {[
            { label: "Practice Area", desc: "Take a mock exam", icon: Target, href: "/practice", color: "from-blue-500 to-indigo-600" },
            { label: "Flashcards", desc: "Review key concepts", icon: Layers, href: "/flashcards", color: "from-violet-500 to-fuchsia-600" },
            { label: "Recordings", desc: "Re-watch sessions", icon: Video, href: "/recordings", color: "from-emerald-500 to-teal-600" },
          ].map((item, i) => (
            <motion.button key={item.label} whileHover={{ scale: 1.02, x: 4 }} whileTap={{ scale: 0.98 }}
              onClick={() => navigate(item.href)}
              className={`bg-gradient-to-r ${item.color} rounded-2xl p-4 text-white shadow-md flex items-center gap-4 text-left w-full h-full relative overflow-hidden group`}>
              <div className="absolute right-0 top-0 bottom-0 w-16 bg-white/10 skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <div className="bg-white/20 p-3 rounded-xl shrink-0">
                <item.icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm">{item.label}</h3>
                <p className="text-white/80 text-xs font-medium mt-0.5">{item.desc}</p>
              </div>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

function Trophy(props: any) {
  return <Award {...props} />;
}