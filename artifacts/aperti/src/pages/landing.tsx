import { useState, useEffect } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { useLocation } from "wouter";
import {
  School, Sparkles, BarChart3, BookOpen, Video, CreditCard,
  Users, CheckCircle, ArrowRight, Shield,
  GraduationCap, ChevronRight, BookText, Menu, X,
  Brain, Zap, Layers, Activity
} from "lucide-react";

type Teacher = {
  id: number;
  displayName: string;
  subjects: string[];
  studentCount: number;
};

type Stats = { teachers: number; students: number; subjects: number };

const FEATURE_CARDS = [
  { icon: Brain, title: "AI-Powered Reports", desc: "Automated weekly reports for every student — attendance, exam results, weak topics, and custom action plans.", color: "from-violet-500 to-purple-600" },
  { icon: Activity, title: "Smart Analytics", desc: "Real-time performance dashboards, risk scores, trend detection, and predicted grade analysis.", color: "from-blue-500 to-indigo-600" },
  { icon: BookText, title: "Homework Engine", desc: "Assign, submit, and grade homework with AI correction feedback and mark scheme comparison.", color: "from-emerald-500 to-teal-600" },
  { icon: Video, title: "Session Recordings", desc: "Upload Zoom/Meet links with access control — free, students-only, or paid access tiers.", color: "from-orange-500 to-amber-600" },
  { icon: CreditCard, title: "Invoice & Payments", desc: "Create invoices, track payment status, and manage tuition billing seamlessly per student.", color: "from-rose-500 to-pink-600" },
  { icon: Shield, title: "Strict Multi-Tenant", desc: "Every teacher workspace is completely isolated. Zero cross-tenant data access. Enterprise security.", color: "from-slate-600 to-gray-700" },
];

const SUBJECT_COLORS = [
  "bg-violet-100 text-violet-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700", "bg-indigo-100 text-indigo-700",
];

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 30 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } }),
} as any;

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const hue = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{ width: size, height: size, background: `hsl(${hue}, 70%, 60%)`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: size * 0.4, flexShrink: 0, boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>
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
  const { scrollY } = useScroll();
  const headerOpacity = useTransform(scrollY, [0, 50], [0, 1]);

  useEffect(() => {
    fetch("/api/public/teachers").then(r => r.ok ? r.json() : []).then(setTeachers).catch(() => setTeachers([])).finally(() => setLoadingTeachers(false));
    fetch("/api/public/stats").then(r => r.ok ? r.json() : null).then(setStats).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* NAV */}
      <motion.nav 
        style={{ backgroundColor: "rgba(255,255,255,0.8)" }}
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b border-slate-200/50 transition-all"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <School className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-xl tracking-tight">Aperti</span>
            <span className="hidden sm:inline-flex text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded-full tracking-widest uppercase">Nexus</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {["Platform", "Teachers", "Pricing"].map((label) => (
              <a key={label} href={`#${label.toLowerCase()}`} className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors">{label}</a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/login")} className="hidden sm:flex text-sm font-bold text-slate-700 hover:text-indigo-600 px-4 py-2 transition-colors">
              Sign in
            </button>
            <button onClick={() => navigate("/login")} className="text-sm font-bold bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-600 transition-all shadow-md hover:shadow-xl hover:shadow-indigo-500/20 hover:-translate-y-0.5">
              Start Free Trial
            </button>
            <button className="md:hidden p-2 rounded-lg text-slate-600" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="md:hidden bg-white border-t border-slate-100 overflow-hidden">
              <div className="px-4 py-6 space-y-4">
                {["Platform", "Teachers", "Pricing"].map(l => (
                  <a key={l} href={`#${l.toLowerCase()}`} onClick={() => setMobileMenuOpen(false)} className="block text-lg font-bold text-slate-700">{l}</a>
                ))}
                <div className="h-px bg-slate-100 w-full" />
                <button onClick={() => navigate("/login")} className="block w-full text-left text-lg font-bold text-indigo-600">Sign in to workspace →</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-32 px-4 overflow-hidden flex flex-col items-center text-center">
        {/* Cinematic gradient orbs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-indigo-500/20 to-violet-500/20 blur-[100px] rounded-full pointer-events-none -z-10" />
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold tracking-wide uppercase mb-8 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" /> Next-generation education OS
          </div>
          
          <h1 className="text-5xl sm:text-7xl font-black tracking-tighter leading-[1.05] mb-6 text-slate-900">
            Run your academy like a <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">premium enterprise.</span>
          </h1>
          
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed mb-10">
            Aperti Nexus is the ultimate operating system for serious educators. Stop using spreadsheets. Manage students, automate attendance, grade exams, and generate AI insights in one beautiful platform.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={() => navigate("/login")} className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-indigo-600 hover:shadow-2xl hover:shadow-indigo-500/30 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 group">
              Open Workspace <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button onClick={() => document.getElementById('platform')?.scrollIntoView({behavior: 'smooth'})} className="w-full sm:w-auto px-8 py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
              See how it works
            </button>
          </div>
        </motion.div>

        {/* Dashboard Preview Mockup */}
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.2 }} className="mt-20 w-full max-w-6xl mx-auto relative perspective-[1000px]">
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white/50 backdrop-blur-sm shadow-2xl p-2 sm:p-4 rotate-x-[2deg] hover:rotate-x-0 transition-transform duration-700 ease-out">
            <div className="rounded-xl sm:rounded-2xl overflow-hidden bg-slate-100 aspect-video relative border border-slate-200 shadow-inner flex flex-col">
              {/* Fake window header */}
              <div className="h-10 bg-slate-900 flex items-center px-4 gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
              </div>
              <div className="flex-1 bg-white flex items-center justify-center text-slate-400 font-medium">
                {/* Visual placeholder for the app UI */}
                <div className="grid grid-cols-4 gap-4 w-full h-full p-4">
                  <div className="col-span-1 border-r border-slate-100 p-4 space-y-4">
                    <div className="h-8 bg-slate-100 rounded-lg w-full" />
                    <div className="h-8 bg-slate-100 rounded-lg w-3/4" />
                    <div className="h-8 bg-slate-100 rounded-lg w-5/6" />
                  </div>
                  <div className="col-span-3 p-4 space-y-6">
                    <div className="flex gap-4">
                      <div className="h-24 bg-indigo-50 rounded-xl flex-1 border border-indigo-100" />
                      <div className="h-24 bg-emerald-50 rounded-xl flex-1 border border-emerald-100" />
                      <div className="h-24 bg-amber-50 rounded-xl flex-1 border border-amber-100" />
                    </div>
                    <div className="h-64 bg-slate-50 rounded-xl border border-slate-100" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* STATS */}
      {stats && (
        <section className="py-10 border-y border-slate-200 bg-white">
          <div className="max-w-5xl mx-auto px-4 flex flex-wrap items-center justify-center sm:justify-between gap-8 sm:gap-4">
            {[
              { value: stats.teachers, label: "Active Educators" },
              { value: stats.students, label: "Students Managed" },
              { value: stats.subjects, label: "Subjects Taught" },
              { value: "99.9%", label: "Uptime SLA" }
            ].map(s => (
              <div key={s.label} className="text-center sm:text-left">
                <p className="text-3xl sm:text-4xl font-black text-slate-900">{s.value}</p>
                <p className="text-sm font-bold text-slate-500 tracking-wide uppercase mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FEATURES GRID */}
      <section id="platform" className="py-24 sm:py-32 px-4 bg-slate-50 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-indigo-600 font-bold tracking-widest uppercase text-sm mb-4">The Nexus Platform</h2>
            <h3 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              A comprehensive toolkit for the modern academy.
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {FEATURE_CARDS.map((feature, i) => (
              <motion.div key={feature.title} custom={i} variants={CARD_VARIANTS} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-50px" }}
                className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 shadow-lg shadow-slate-200 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h4>
                <p className="text-slate-600 font-medium leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section className="py-24 sm:py-32 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-indigo-400 font-bold tracking-widest uppercase text-sm mb-4">Effortless Flow</h2>
            <h3 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
              From enrollment to excellence.
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { step: 1, title: "Onboard", desc: "Create your workspace and invite students via secure code." },
              { step: 2, title: "Deliver", desc: "Run sessions, mark attendance instantly, and upload recordings." },
              { step: 3, title: "Assess", desc: "Assign smart homework and conduct exams with automated grading." },
              { step: 4, title: "Analyze", desc: "Generate AI reports and communicate progress to parents." }
            ].map((s, i) => (
              <motion.div key={s.step} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }} viewport={{ once: true }}
                className="relative">
                <div className="text-7xl font-black text-white/5 absolute -top-8 -left-4 pointer-events-none select-none">0{s.step}</div>
                <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-lg mb-6 relative z-10 shadow-lg shadow-indigo-500/30">
                  {s.step}
                </div>
                <h4 className="text-xl font-bold mb-3">{s.title}</h4>
                <p className="text-slate-400 font-medium leading-relaxed">{s.desc}</p>
                {i < 3 && <div className="hidden lg:block absolute top-6 left-16 right-0 h-0.5 bg-gradient-to-r from-indigo-600 to-transparent" />}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* TEACHERS */}
      <section id="teachers" className="py-24 sm:py-32 bg-white px-4">
        <div className="max-w-7xl mx-auto">
           <div className="flex flex-col sm:flex-row justify-between items-end mb-16 gap-6">
            <div className="max-w-2xl">
              <h2 className="text-indigo-600 font-bold tracking-widest uppercase text-sm mb-4">Community</h2>
              <h3 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
                Elite educators trust Nexus.
              </h3>
            </div>
            <button onClick={() => navigate("/login")} className="text-indigo-600 font-bold flex items-center gap-2 hover:text-indigo-800 transition-colors">
              Join the directory <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loadingTeachers ? (
              [...Array(3)].map((_, i) => <div key={i} className="h-64 bg-slate-100 rounded-3xl animate-pulse" />)
            ) : teachers.length === 0 ? (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl">
                <GraduationCap className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-xl font-bold text-slate-500">The directory is launching soon.</p>
                <p className="text-slate-400 mt-2">Create your workspace to be featured.</p>
              </div>
            ) : (
              teachers.map((teacher, i) => (
                <motion.div key={teacher.id} custom={i} variants={CARD_VARIANTS} initial="hidden" whileInView="show" viewport={{ once: true }}
                  className="bg-slate-50 rounded-3xl p-8 border border-slate-200 hover:border-indigo-300 hover:shadow-xl hover:bg-white transition-all cursor-pointer group"
                  onClick={() => navigate("/login")}>
                  <div className="flex items-center gap-5 mb-6">
                    <Avatar name={teacher.displayName} size={64} />
                    <div>
                      <h4 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{teacher.displayName}</h4>
                      <p className="text-sm font-bold text-emerald-600 flex items-center gap-1.5 mt-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Active Workspace
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-200">
                    <span className="text-slate-500 font-medium">Managing</span>
                    <span className="text-2xl font-black text-slate-900">{teacher.studentCount} <span className="text-sm font-bold text-slate-400">students</span></span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {teacher.subjects.slice(0, 3).map((subj, si) => (
                      <span key={subj} className={`px-3 py-1 text-xs font-bold rounded-lg ${SUBJECT_COLORS[si % SUBJECT_COLORS.length]}`}>
                        {subj}
                      </span>
                    ))}
                    {teacher.subjects.length > 3 && (
                      <span className="px-3 py-1 text-xs font-bold rounded-lg bg-slate-200 text-slate-600">+{teacher.subjects.length - 3}</span>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="py-24 sm:py-32 px-4 relative overflow-hidden">
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="bg-gradient-to-br from-indigo-600 via-violet-700 to-purple-800 rounded-[3rem] p-10 sm:p-20 text-center text-white shadow-2xl shadow-indigo-500/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay" />
            
            <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="relative z-10">
              <Zap className="w-12 h-12 text-amber-400 mx-auto mb-6" />
              <h2 className="text-4xl sm:text-6xl font-black mb-6 tracking-tight">Ready to elevate your teaching?</h2>
              <p className="text-xl text-indigo-100 font-medium max-w-2xl mx-auto mb-10">
                Stop managing infrastructure and start teaching. Join the premier operating system for modern educators.
              </p>
              <button onClick={() => navigate("/login")} className="px-10 py-5 bg-white text-indigo-900 rounded-2xl font-black text-lg hover:scale-105 hover:shadow-2xl transition-all flex items-center justify-center gap-3 mx-auto group">
                Create Workspace <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-12 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
              <School className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-lg text-slate-900 tracking-tight">Aperti Nexus</span>
          </div>
          <p className="text-slate-500 font-medium text-sm">© {new Date().getFullYear()} Aperti Education. All rights reserved.</p>
          <div className="flex gap-6 text-sm font-bold text-slate-400">
            <a href="#" className="hover:text-indigo-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Terms</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}