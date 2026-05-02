import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  School, Sparkles, BarChart3, BookOpen, Video, CreditCard, Bell,
  Users, CheckCircle, ArrowRight, Star, Zap, Shield, Globe,
  GraduationCap, ChevronRight, BookText, Award, Flame, Menu, X,
  Layers, Brain, Clock
} from "lucide-react";

type Teacher = {
  id: number;
  displayName: string;
  subjects: string[];
  studentCount: number;
};

type Stats = { teachers: number; students: number; subjects: number };

const FEATURE_CARDS = [
  { icon: Brain, title: "AI-Powered Reports", desc: "Automated weekly reports for every student — attendance, exam results, weak topics, action plans.", color: "from-violet-500 to-purple-600" },
  { icon: BarChart3, title: "Smart Analytics", desc: "Real-time performance dashboards, risk scores, trend detection, and predicted grade analysis.", color: "from-blue-500 to-indigo-600" },
  { icon: BookText, title: "Homework Engine", desc: "Assign, submit, and grade homework with AI correction feedback and mark scheme comparison.", color: "from-emerald-500 to-teal-600" },
  { icon: Video, title: "Session Recordings", desc: "Upload Zoom/Meet links with access control — free, students-only, or paid access tiers.", color: "from-orange-500 to-amber-600" },
  { icon: CreditCard, title: "Invoice & Payments", desc: "Create invoices, track payment status, and manage tuition billing per student.", color: "from-rose-500 to-pink-600" },
  { icon: Shield, title: "Strict Multi-Tenant", desc: "Every teacher workspace is completely isolated. Zero cross-tenant data access. Enterprise-grade security.", color: "from-slate-600 to-gray-700" },
];

const SUBJECT_COLORS = [
  "bg-violet-100 text-violet-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700", "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700", "bg-orange-100 text-orange-700",
];

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] } }),
};

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const hue = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{ width: size, height: size, background: `hsl(${hue}, 60%, 55%)`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: size * 0.35, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

export default function Landing() {
  const [, navigate] = useLocation();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    fetch("/api/public/teachers").then(r => r.ok ? r.json() : []).then(setTeachers).catch(() => setTeachers([])).finally(() => setLoadingTeachers(false));
    fetch("/api/public/stats").then(r => r.ok ? r.json() : null).then(setStats).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <School className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
            </div>
            <span className="font-black text-lg tracking-tight text-gray-900">Aperti</span>
            <span className="hidden sm:inline-flex text-[10px] font-bold bg-gradient-to-r from-indigo-500 to-violet-600 text-white px-2 py-0.5 rounded-full">ULTIMATE</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {[["Features", "#features"], ["Teachers", "#teachers"]].map(([label, href]) => (
              <a key={label} href={href} className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">{label}</a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/login")}
              className="hidden sm:flex text-sm font-semibold text-gray-700 hover:text-gray-900 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors">
              Sign in
            </button>
            <button onClick={() => navigate("/login")}
              className="text-sm font-semibold bg-gradient-to-r from-indigo-500 to-violet-600 text-white px-5 py-2 rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-indigo-200">
              Get Started
            </button>
            <button className="md:hidden p-2 rounded-lg hover:bg-gray-50" onClick={() => setMobileMenuOpen(v => !v)}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-gray-100 bg-white overflow-hidden">
              <div className="px-4 py-4 space-y-1">
                <a href="#features" className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Features</a>
                <a href="#teachers" className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Teachers</a>
                <button onClick={() => navigate("/login")} className="block w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-indigo-600">Sign in →</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* HERO */}
      <section className="pt-24 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-40" />
          <div className="absolute top-32 right-1/4 w-80 h-80 bg-violet-100 rounded-full blur-3xl opacity-40" />
          <div className="absolute -bottom-10 left-1/2 w-72 h-72 bg-blue-100 rounded-full blur-3xl opacity-30" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-semibold px-4 py-2 rounded-full mb-8 border border-indigo-100">
            <Sparkles className="h-3.5 w-3.5" />AI-Powered Education Operating System
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-black text-gray-900 leading-none tracking-tighter">
            The future of<br />
            <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600 bg-clip-text text-transparent">
              private tutoring
            </span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Aperti Ultimate gives private tutors a complete operating system — attendance, exams, AI reports, homework correction, payments, and recordings — all in one premium platform.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={() => navigate("/login")}
              className="group flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold px-8 py-4 rounded-2xl text-base hover:opacity-90 transition-all shadow-xl shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5">
              Start for free <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <a href="#teachers"
              className="flex items-center gap-2 text-gray-600 font-semibold px-6 py-4 rounded-2xl hover:bg-gray-50 transition-colors text-base">
              Browse teachers <ChevronRight className="h-4 w-4" />
            </a>
          </motion.div>

          {/* Stats strip */}
          {stats && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }}
              className="mt-16 inline-flex items-center gap-8 bg-white border border-gray-100 rounded-2xl px-8 py-4 shadow-sm divide-x divide-gray-100">
              {[
                { value: stats.teachers, label: "Active Teachers", icon: GraduationCap },
                { value: stats.students, label: "Students Enrolled", icon: Users },
                { value: stats.subjects, label: "Subjects Covered", icon: BookOpen },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-3 px-4 first:pl-0 last:pr-0">
                  <s.icon className="h-5 w-5 text-indigo-400" />
                  <div className="text-left">
                    <p className="text-2xl font-black text-gray-900">{s.value}</p>
                    <p className="text-xs text-gray-400 font-medium">{s.label}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-gray-50/50">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-16">
            <p className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-3">Platform Features</p>
            <h2 className="text-4xl font-black text-gray-900 tracking-tight">Everything you need.<br />Nothing you don't.</h2>
            <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">Built for serious educators who want a professional system without enterprise complexity.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURE_CARDS.map((card, i) => (
              <motion.div key={card.title} custom={i} variants={CARD_VARIANTS} initial="hidden" whileInView="show" viewport={{ once: true }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 group cursor-default">
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform`}>
                  <card.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 text-base mb-2">{card.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-16">
            <p className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="text-4xl font-black text-gray-900 tracking-tight">Up and running in minutes</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: "01", icon: School, title: "Create workspace", desc: "Sign up and configure your teacher workspace with subjects, sessions, and students." },
              { step: "02", icon: Users, title: "Add students", desc: "Import your student roster. Students activate their own accounts with a unique code." },
              { step: "03", icon: CheckCircle, title: "Mark & track", desc: "Record attendance each session, assign homework, and publish exams — all automated." },
              { step: "04", icon: Sparkles, title: "AI reports", desc: "One click generates premium weekly reports for every student with insights and action plans." },
            ].map((step, i) => (
              <motion.div key={step.step} custom={i} variants={CARD_VARIANTS} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center mx-auto mb-4">
                  <step.icon className="h-6 w-6 text-indigo-500" />
                </div>
                <p className="text-xs font-black text-indigo-400 tracking-widest mb-2">{step.step}</p>
                <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* TEACHER DIRECTORY */}
      <section id="teachers" className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-indigo-50/50 to-violet-50/30">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-16">
            <p className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-3">Teacher Directory</p>
            <h2 className="text-4xl font-black text-gray-900 tracking-tight">Meet our educators</h2>
            <p className="mt-4 text-lg text-gray-500">Active teachers currently using Aperti Ultimate to manage their academies.</p>
          </motion.div>

          {loadingTeachers ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => <div key={i} className="h-52 bg-white rounded-2xl animate-pulse" />)}
            </div>
          ) : teachers.length === 0 ? (
            <div className="text-center py-16">
              <GraduationCap className="h-16 w-16 text-indigo-200 mx-auto mb-4" />
              <p className="text-gray-400 font-medium text-lg">No teachers listed yet</p>
              <p className="text-gray-300 text-sm mt-1">Be the first educator to join Aperti Ultimate</p>
              <button onClick={() => navigate("/login")} className="mt-6 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold px-6 py-3 rounded-2xl text-sm hover:opacity-90 transition-opacity">
                Create your workspace
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {teachers.map((teacher, i) => (
                <motion.div key={teacher.id} custom={i} variants={CARD_VARIANTS} initial="hidden" whileInView="show" viewport={{ once: true }}
                  whileHover={{ y: -4 }} className="bg-white rounded-2xl p-6 shadow-sm border border-white/80 hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer group"
                  onClick={() => navigate("/login")}>
                  <div className="flex items-start gap-4 mb-4">
                    <Avatar name={teacher.displayName} size={48} />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-base truncate">{teacher.displayName}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <p className="text-xs text-emerald-600 font-medium">Active</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-black text-indigo-600">{teacher.studentCount}</p>
                      <p className="text-[10px] text-gray-400 font-medium">students</p>
                    </div>
                  </div>

                  {teacher.subjects.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {teacher.subjects.slice(0, 5).map((subj, si) => (
                        <span key={subj} className={`text-xs px-2.5 py-1 rounded-full font-semibold ${SUBJECT_COLORS[si % SUBJECT_COLORS.length]}`}>
                          {subj}
                        </span>
                      ))}
                      {teacher.subjects.length > 5 && (
                        <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-gray-100 text-gray-500">+{teacher.subjects.length - 5}</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mt-2">No subjects listed yet</p>
                  )}

                  <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                    <span className="text-xs text-gray-400">Click to connect</span>
                    <span className="text-indigo-500 group-hover:translate-x-1 transition-transform">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="relative bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 rounded-3xl p-12 text-center overflow-hidden shadow-2xl shadow-indigo-200">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
            </div>
            <div className="relative">
              <Sparkles className="h-10 w-10 text-white/80 mx-auto mb-4" />
              <h2 className="text-4xl font-black text-white tracking-tight mb-4">Ready to run your academy like a pro?</h2>
              <p className="text-white/70 text-lg mb-8 max-w-xl mx-auto">Join educators already using Aperti Ultimate to manage students, automate reports, and grow their academies.</p>
              <button onClick={() => navigate("/login")}
                className="inline-flex items-center gap-2 bg-white text-indigo-700 font-bold px-8 py-4 rounded-2xl text-base hover:bg-indigo-50 transition-colors shadow-xl">
                Get started today <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-100 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <School className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-gray-900">Aperti</span>
            <span className="text-xs text-gray-400">Ultimate</span>
          </div>
          <p className="text-sm text-gray-400">The AI Education Operating System — built for serious educators.</p>
          <button onClick={() => navigate("/login")} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            Sign in →
          </button>
        </div>
      </footer>
    </div>
  );
}
