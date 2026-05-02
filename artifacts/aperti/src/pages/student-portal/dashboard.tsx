import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { BookOpen, CheckSquare, FolderOpen, TrendingUp, Flame, Clock, Award, ChevronRight, Calendar } from "lucide-react";
import { useAuth } from "@/context/auth";

type PortalData = {
  student: any;
  stats: { attendanceRate: number; present: number; absent: number; total: number; streak: number };
  latestExam: { examName: string; percentage: number } | null;
  upcomingHomework: { id: number; title: string; dueDate: string | null; subjectName: string | null; submissionStatus: string | null }[];
};

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
      <svg width={130} height={130} className="-rotate-90">
        <circle cx={65} cy={65} r={r} fill="none" stroke="#e5e7eb" strokeWidth={10} />
        <motion.circle
          cx={65} cy={65} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
        />
      </svg>
      <div className="absolute text-center">
        <motion.p
          className="text-3xl font-black text-gray-900"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >{rate}%</motion.p>
        <p className="text-[10px] text-gray-400 font-medium">Attendance</p>
      </div>
    </div>
  );
}

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4, ease: "easeOut" } }),
};

export default function StudentDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const firstName = data?.student?.studentName?.split(" ")[0] || user?.displayName?.split(" ")[0] || "there";
  const rate = data?.stats.attendanceRate ?? 0;
  const streak = data?.stats.streak ?? 0;

  const getMotivation = () => {
    if (rate >= 90) return "Outstanding attendance! Keep it up! 🌟";
    if (rate >= 80) return "Great consistency! You're on track 👍";
    if (rate >= 70) return "Good effort — aim for 85%+ this term 📈";
    return "Attendance needs improvement — every session counts 💪";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-white/80 animate-pulse rounded-2xl w-72" />
        <div className="grid grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-36 bg-white/80 animate-pulse rounded-2xl" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-3xl font-black text-gray-900">{getGreeting()}, {firstName}! 👋</h1>
        <p className="text-gray-500 mt-1">{getMotivation()}</p>
      </motion.div>

      {/* Top row: attendance ring + streak + exam */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Attendance ring */}
        <motion.div custom={0} variants={CARD_VARIANTS} initial="hidden" animate="show"
          className="bg-white rounded-2xl p-5 shadow-sm border border-indigo-50 flex flex-col items-center gap-3">
          <CircleProgress rate={rate} />
          <div className="text-center">
            <p className="text-xs text-gray-500">{data?.stats.present ?? 0} present · {data?.stats.absent ?? 0} absent</p>
          </div>
        </motion.div>

        {/* Streak */}
        <motion.div custom={1} variants={CARD_VARIANTS} initial="hidden" animate="show"
          className="bg-gradient-to-br from-orange-400 to-rose-500 rounded-2xl p-5 shadow-sm text-white flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5" />
            <span className="text-sm font-semibold opacity-90">Attendance Streak</span>
          </div>
          <div>
            <p className="text-5xl font-black">{streak}</p>
            <p className="text-sm opacity-80 mt-1">{streak === 1 ? "session" : "sessions"} in a row</p>
            {streak >= 5 && <p className="text-xs mt-2 font-semibold">🔥 You're on fire!</p>}
            {streak >= 10 && <p className="text-xs font-semibold">⭐ Incredible streak!</p>}
          </div>
        </motion.div>

        {/* Latest exam */}
        <motion.div custom={2} variants={CARD_VARIANTS} initial="hidden" animate="show"
          className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-5 shadow-sm text-white flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            <span className="text-sm font-semibold opacity-90">Latest Exam</span>
          </div>
          {data?.latestExam ? (
            <div>
              <p className="text-4xl font-black">{data.latestExam.percentage}%</p>
              <p className="text-sm opacity-80 mt-1 truncate">{data.latestExam.examName}</p>
              <p className="text-xs mt-2 font-semibold">
                {data.latestExam.percentage >= 80 ? "🌟 Excellent!" : data.latestExam.percentage >= 60 ? "👍 Good work" : "📚 Keep practising"}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xl font-semibold opacity-70">No exams yet</p>
              <p className="text-sm opacity-60 mt-1">Results will appear here</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Upcoming Homework */}
      <motion.div custom={3} variants={CARD_VARIANTS} initial="hidden" animate="show"
        className="bg-white rounded-2xl shadow-sm border border-indigo-50 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h2 className="font-bold text-gray-900 flex items-center gap-2"><BookOpen className="h-4 w-4 text-indigo-500" />Upcoming Homework</h2>
          <button onClick={() => navigate("/homework")} className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1 font-medium transition-colors">
            View all <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        {!data?.upcomingHomework?.length ? (
          <div className="py-10 text-center text-gray-400 text-sm">
            <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-20" />No homework assigned yet
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.upcomingHomework.map((hw, i) => {
              const isOverdue = hw.dueDate && hw.dueDate < new Date().toISOString().split("T")[0];
              const submitted = hw.submissionStatus && hw.submissionStatus !== "draft";
              return (
                <motion.div key={hw.id} custom={i} variants={CARD_VARIANTS} initial="hidden" animate="show"
                  className="flex items-center gap-3 px-5 py-3 hover:bg-indigo-50/30 transition-colors cursor-pointer"
                  onClick={() => navigate("/homework")}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${submitted ? "bg-emerald-400" : isOverdue ? "bg-red-400" : "bg-amber-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{hw.title}</p>
                    <p className="text-xs text-gray-400">{hw.subjectName || "General"}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {hw.dueDate ? (
                      <p className={`text-xs font-medium ${isOverdue && !submitted ? "text-red-500" : "text-gray-400"}`}>
                        {isOverdue ? "Overdue" : `Due ${new Date(hw.dueDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                      </p>
                    ) : <p className="text-xs text-gray-400">No deadline</p>}
                    {submitted && <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Submitted</p>}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Quick Links */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Attendance", icon: CheckSquare, href: "/attendance", color: "from-emerald-400 to-teal-500" },
          { label: "Resources", icon: FolderOpen, href: "/resources", color: "from-blue-400 to-indigo-500" },
          { label: "My Profile", icon: TrendingUp, href: "/profile", color: "from-purple-400 to-pink-500" },
        ].map((item, i) => (
          <motion.button key={item.label} custom={i + 4} variants={CARD_VARIANTS} initial="hidden" animate="show"
            whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate(item.href)}
            className={`bg-gradient-to-br ${item.color} rounded-2xl p-4 text-white shadow-sm flex flex-col items-center gap-2`}>
            <item.icon className="h-5 w-5" />
            <span className="text-xs font-semibold">{item.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
