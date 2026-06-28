import { useState, useRef, useEffect } from "react";
import { motion, useInView, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, BookOpen, Brain, BarChart3, CheckCircle2,
  Menu, X, GraduationCap, Clock, Users, ChevronRight, Shield,
  Zap, Target, Star, Globe, ChevronDown, Rocket,
  FileText, Activity, Check, Lock, Bell, Layers, TrendingUp,
  ClipboardList, MessageSquare, Award, Smartphone, XCircle as XCircleIcon,
  Quote,
} from "lucide-react";

/* ─── Animations ─── */
function Reveal({ children, delay = 0, y = 24 }: { children: React.ReactNode; delay?: number; y?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y, filter: "blur(4px)" }}
      animate={inView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

/* ─── Feature Card ─── */
const ICON_THEMES = [
  { bg: "hsl(var(--primary) / 0.08)", color: "hsl(var(--primary))" },
  { bg: "#7C3AED10", color: "#7C3AED" },
  { bg: "#0891B210", color: "#0891B2" },
  { bg: "#D9770610", color: "#D97706" },
  { bg: "#DC262610", color: "#DC2626" },
  { bg: "#05966910", color: "#059669" },
  { bg: "#DB277710", color: "#DB2777" },
  { bg: "#2563EB10", color: "#2563EB" },
];

function FeatureCard({ Icon, title, description, index }: {
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string; description: string; index: number;
}) {
  const theme = ICON_THEMES[index % ICON_THEMES.length];
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 180, damping: 26 });
  const sy = useSpring(y, { stiffness: 180, damping: 26 });
  const rotateX = useTransform(sy, [-60, 60], [6, -6]);
  const rotateY = useTransform(sx, [-60, 60], [-6, 6]);
  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    x.set(e.clientX - r.left - r.width / 2);
    y.set(e.clientY - r.top - r.height / 2);
  };
  return (
    <motion.div
      onMouseMove={handleMove}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      whileHover={{ scale: 1.02 }}
      className="group bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow cursor-default">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: theme.bg }}>
        <Icon className="h-5 w-5" style={{ color: theme.color }} />
      </div>
      <h3 className="font-bold text-gray-900 text-sm mb-2">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
      <div className="mt-4 flex items-center gap-1 text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition-all duration-300"
        style={{ color: theme.color }}>
        Included <ChevronRight className="h-3 w-3" />
      </div>
    </motion.div>
  );
}

/* ─── Nav ─── */
const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "/pricing", label: "Pricing", route: true },
  { href: "/courses", label: "Courses", route: true },
];

function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-400 ${
      scrolled ? "bg-white/96 backdrop-blur-2xl shadow-sm border-b border-gray-100/60" : "bg-white/80 backdrop-blur-md"
    }`}>
      <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between gap-6">
        <Link href="/">
          <span className="text-xl font-extrabold tracking-tight cursor-pointer select-none text-gray-900">
            Aperti<span style={{ color: "hsl(var(--primary))" }}>.</span>
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label, route }) =>
            route ? (
              <Link key={href} href={href}>
                <span className="px-3.5 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-50 cursor-pointer">{label}</span>
              </Link>
            ) : (
              <a key={href} href={href} className="px-3.5 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-50">{label}</a>
            )
          )}
        </div>
        <div className="hidden md:flex items-center gap-2.5">
          <Link href="/login">
            <button className="text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
              Sign In
            </button>
          </Link>
          <Link href="/register">
            <motion.button
              whileHover={{ scale: 1.02, boxShadow: "0 6px 20px hsl(var(--primary) / 0.35)" }}
              whileTap={{ scale: 0.97 }}
              className="text-sm font-semibold px-4 py-2 rounded-xl text-white transition-all"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary)), #00897B)", boxShadow: "0 4px 12px hsl(var(--primary) / 0.28)" }}>
              Start Free
            </motion.button>
          </Link>
        </div>
        <motion.button whileTap={{ scale: 0.94 }}
          className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-all"
          onClick={() => setOpen(!open)}>
          <AnimatePresence mode="wait">
            {open
              ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X className="h-5 w-5" /></motion.span>
              : <motion.span key="m" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><Menu className="h-5 w-5" /></motion.span>
            }
          </AnimatePresence>
        </motion.button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}
            className="md:hidden bg-white/98 border-t border-gray-100 overflow-hidden">
            <div className="px-5 py-4 space-y-1">
              {NAV_LINKS.map(({ href, label, route }) =>
                route ? (
                  <Link key={href} href={href}>
                    <span onClick={() => setOpen(false)} className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2.5 rounded-xl transition-all cursor-pointer">{label}</span>
                  </Link>
                ) : (
                  <a key={href} href={href} onClick={() => setOpen(false)} className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2.5 rounded-xl transition-all">{label}</a>
                )
              )}
              <div className="pt-3 pb-1 flex gap-2">
                <Link href="/login" className="flex-1">
                  <button className="w-full text-sm font-medium px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all">Sign In</button>
                </Link>
                <Link href="/register" className="flex-1">
                  <button className="w-full text-sm font-semibold px-4 py-2.5 rounded-xl text-white" style={{ background: "linear-gradient(135deg, hsl(var(--primary)), #00897B)" }}>Start Free</button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

/* ─── Hero Visual ─── */
function HeroDashboardMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-xl mx-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center gap-2">
          <div className="flex gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400" /><span className="w-3 h-3 rounded-full bg-yellow-400" /><span className="w-3 h-3 rounded-full bg-green-400" /></div>
          <span className="text-xs text-gray-400 ml-2 font-mono">app.aperti.ai</span>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-gray-400">CoreHub</p>
              <p className="text-sm font-bold text-gray-900">Your class at a glance</p>
            </div>
            <span className="text-xs text-gray-400">26 Jun</span>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Active Students", value: "34", sub: "2 need attention", icon: Users, color: "hsl(var(--primary))" },
              { label: "Avg. Score", value: "78%", sub: "↑ 6% this week", icon: TrendingUp, color: "#7C3AED" },
              { label: "Homework Rate", value: "91%", sub: "29/32 submitted", icon: CheckCircle2, color: "#059669" },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <s.icon className="h-4 w-4 mx-auto mb-1" style={{ color: s.color }} />
                <p className="text-lg font-black text-gray-900">{s.value}</p>
                <p className="text-[10px] text-gray-400 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {[
              { name: "Maya Hassan", note: "needs help with Forces", color: "#DC2626" },
              { name: "Ahmed Karim", note: "excellent progress", color: "#059669" },
              { name: "Lena Wolff", note: "attendance drop", color: "#D97706" },
            ].map((s) => (
              <div key={s.name} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                <span className="text-xs text-gray-700 font-medium">{s.name}</span>
                <span className="text-xs text-gray-400">— {s.note}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2 border-t border-gray-100 pt-4">
            {["Teacher", "Student", "Parent"].map((t, i) => (
              <span key={t} className={`text-[10px] px-2 py-1 rounded-full font-medium ${i === 0 ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400"}`}>{t}</span>
            ))}
            <span className="text-[10px] text-gray-300 ml-auto italic">Illustrative</span>
          </div>
        </div>
      </div>
      <motion.div
        animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-3 -right-4 bg-white rounded-xl shadow-lg border border-gray-100 p-3 flex items-center gap-2">
        <Bell className="h-4 w-4 text-primary" />
        <div>
          <p className="text-xs font-bold text-gray-900">Payment verified</p>
          <p className="text-[10px] text-gray-400">Subscription active</p>
        </div>
      </motion.div>
      <motion.div
        animate={{ y: [0, 6, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute -bottom-3 -left-4 bg-white rounded-xl shadow-lg border border-gray-100 p-3 flex items-center gap-2">
        <Award className="h-4 w-4 text-emerald-500" />
        <div>
          <p className="text-xs font-bold text-gray-900">Ahmed scored 94%</p>
          <p className="text-[10px] text-gray-400">Physics — Chapter 7</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Live Stats from API ─── */
function StatsSection() {
  const { data: stats } = useQuery<{ activeStudents: number; activeTeachers: number; activeCourses: number; attendanceRecords: number }>({
    queryKey: ["public-stats"],
    queryFn: async () => {
      const r = await fetch("/api/auth/stats");
      if (!r.ok) throw new Error("stats unavailable");
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const items = [
    { value: stats?.activeStudents ?? 0, suffix: "+", label: "Active Students" },
    { value: stats?.activeTeachers ?? 0, suffix: "+", label: "Teachers & Tutors" },
    { value: stats?.activeCourses ?? 0, suffix: "+", label: "Active Courses" },
    { value: stats?.attendanceRecords ?? 0, suffix: "+", label: "Attendance Records" },
  ];
  return (
    <section className="py-14 bg-gray-50/80 border-y border-gray-100">
      <div className="max-w-5xl mx-auto px-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {items.map((item, i) => (
            <StatCard key={item.label} value={item.value} suffix={item.suffix} label={item.label} delay={i * 0.08} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Stats ─── */
function useCountUp(target: number, inView: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = target / 60;
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setValue(target); clearInterval(timer); }
      else setValue(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target]);
  return value;
}

function StatCard({ value, suffix, label, delay }: { value: number; suffix?: string; label: string; delay: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const count = useCountUp(value, inView);
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay }} className="text-center">
      <p className="text-4xl font-black text-gray-900 tabular-nums">{count.toLocaleString()}{suffix}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </motion.div>
  );
}

/* ─── FAQ ─── */
const DEFAULT_FAQS = [
  { q: "How do payments work?", a: "Teachers and students pay via InstaPay — Egypt's national instant payment network. After sending the amount, submit your transaction code. An admin verifies within 2–4 hours and your account activates immediately." },
  { q: "Is there a free plan?", a: "Yes. Students get a free tier with access to past papers, 5 AI Mentor queries per day, and basic flashcards. Teachers can explore the platform on a free trial before subscribing." },
  { q: "How many students can I manage?", a: "Plans scale from 30 students (Starter) to unlimited (Elite). You can upgrade at any time and your data migrates instantly." },
  { q: "Does it work on mobile?", a: "Aperti is fully responsive and optimized for mobile browsers. Students can take exams, submit homework, and chat with the AI Mentor from any device." },
  { q: "Is my data secure?", a: "All data is encrypted in transit (TLS) and at rest. Authentication uses JWT tokens with optional two-factor (TOTP). We never sell your data or share it with third parties." },
  { q: "Can I migrate from Google Classroom or another platform?", a: "We support CSV import for student lists and question banks. Our team can assist with structured migrations for larger schools." },
];

function FAQItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Reveal delay={index * 0.05}>
      <div className="border-b border-gray-100 last:border-0">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between py-4 text-left gap-4 group">
          <span className="text-sm font-semibold text-gray-900 group-hover:text-primary transition-colors">{q}</span>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.22 }} className="flex-shrink-0">
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </motion.div>
        </button>
        <AnimatePresence>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
              <p className="text-sm text-gray-500 pb-4 leading-relaxed">{a}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reveal>
  );
}

/* ─── Public Plans ─── */
interface PublicPlan { id: number; name: string; type?: string; price_egp: number; features: string[]; badge: string | null; is_highlighted: boolean; max_students?: number | null; }

function PricingSection() {
  const { data: plans = [] } = useQuery<PublicPlan[]>({
    queryKey: ["landing-plans"],
    queryFn: async () => {
      const r = await fetch("/api/plans/public");
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const studentPlans = plans.filter(p => !p.type || p.type === "student").slice(0, 4);
  const teacherPlans = plans.filter(p => p.type === "teacher").slice(0, 4);

  const renderPlans = (list: PublicPlan[], label: string) => {
    if (list.length === 0) return null;
    return (
      <div className="mb-12">
        <Reveal><h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
          {label === "For Students" ? <GraduationCap className="h-5 w-5 text-primary" /> : <Users className="h-5 w-5 text-violet-500" />}
          {label}
        </h3></Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {list.map((plan, i) => (
            <Reveal key={plan.id} delay={i * 0.08}>
              <div className={`bg-white rounded-2xl border-2 p-5 flex flex-col ${plan.is_highlighted ? "border-primary shadow-lg shadow-primary/10" : "border-gray-100"}`}>
                {plan.is_highlighted && (
                  <span className="self-start mb-3 text-[10px] font-bold text-white px-2 py-0.5 rounded-full bg-primary">Most Popular</span>
                )}
                {plan.badge && !plan.is_highlighted && (
                  <span className="self-start mb-3 text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10">{plan.badge}</span>
                )}
                <p className="font-bold text-gray-900">{plan.name}</p>
                <p className="text-2xl font-black text-gray-900 mt-1">
                  {plan.price_egp === 0 ? "Free" : `EGP ${plan.price_egp}`}
                  {plan.price_egp > 0 && <span className="text-sm font-normal text-gray-400">/mo</span>}
                </p>
                <ul className="mt-4 space-y-1.5 flex-1">
                  {plan.features.slice(0, 5).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-gray-500">
                      <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <button className={`mt-5 w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${plan.is_highlighted ? "bg-primary text-white hover:opacity-90" : "border border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                    Get Started
                  </button>
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    );
  };

  const fallbackStudentPlans: PublicPlan[] = [
    { id: 1, name: "Free", type: "student", price_egp: 0, features: ["Past paper access", "AI Mentor (5/day)", "Basic flashcards"], badge: null, is_highlighted: false },
    { id: 2, name: "Essential", type: "student", price_egp: 79, features: ["Unlimited AI Mentor", "Full flashcard engine", "Revision schedules", "Progress analytics"], badge: null, is_highlighted: false },
    { id: 3, name: "Plus", type: "student", price_egp: 149, features: ["All Essential features", "Revision Notes", "Peer review access", "Priority support"], badge: "Popular", is_highlighted: true },
    { id: 4, name: "Pro", type: "student", price_egp: 249, features: ["All Plus features", "Priority AI tutor", "Practice exam library", "Custom learning path"], badge: null, is_highlighted: false },
  ];

  const displayStudents = studentPlans.length > 0 ? studentPlans : fallbackStudentPlans;

  return (
    <section id="pricing" className="py-24 bg-gray-50/60">
      <div className="max-w-7xl mx-auto px-5">
        <Reveal><div className="text-center mb-14">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/8 px-3 py-1 rounded-full mb-4">
            <Zap className="h-3 w-3" /> Transparent pricing in EGP
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">Simple plans. No surprises.</h2>
          <p className="text-gray-500 max-w-xl mx-auto">All plans paid via InstaPay — Egypt's national instant transfer. Cancel anytime.</p>
        </div></Reveal>
        {renderPlans(displayStudents, "For Students")}
        {teacherPlans.length > 0 && renderPlans(teacherPlans, "For Teachers")}
        <Reveal>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col md:flex-row items-center gap-5">
            <div className="flex-1">
              <p className="font-bold text-gray-900 mb-1">Running a school or tutoring center?</p>
              <p className="text-sm text-gray-500">We offer custom institutional pricing with dedicated onboarding, custom branding, and a dedicated account manager.</p>
            </div>
            <Link href="/contact">
              <button className="flex-shrink-0 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                Contact Us
              </button>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Main Page ─── */
export default function LandingPage() {
  const FEATURES = [
    { Icon: ClipboardList, title: "Smart Attendance", description: "QR check-in, instant parent alerts, and auto-generated absence reports — all without touching a spreadsheet." },
    { Icon: CheckCircle2, title: "Structured Grading", description: "Split-screen marking workspace with rubric criteria. Teachers enter marks, write feedback, and approve — full control, full audit trail." },
    { Icon: BarChart3, title: "Student Analytics", description: "Risk flags, engagement scores, and performance trends for every student. Know who needs help before they fall behind." },
    { Icon: Bell, title: "Parent Dashboard", description: "Real-time grade updates, attendance alerts, and behavior notes visible to parents in their own secure portal." },
    { Icon: FileText, title: "Homework Engine", description: "Assign, collect, grade, and return homework in one flow. Students submit from any device; teachers grade in seconds." },
    { Icon: Target, title: "Exam Builder", description: "Create IGCSE and IB-style exams, conduct them online with secure session monitoring and detailed question analytics." },
    { Icon: Layers, title: "Flashcard Engine", description: "Spaced-repetition study decks with Easy / OK / Hard confidence ratings. Students master content at their own pace." },
    { Icon: Globe, title: "Course Marketplace", description: "Publish your courses publicly or privately. Accept InstaPay enrolments and manage student access automatically." },
  ];

  const HOW_IT_WORKS = [
    { step: "01", title: "Register your account", description: "Sign up as a teacher in under 2 minutes. Add your school name, subjects, and first lesson. No card needed." },
    { step: "02", title: "Add your students", description: "Import a CSV or enter students manually. Each student gets a login, and parents can link their portal automatically." },
    { step: "03", title: "Run your operation", description: "Take attendance, assign homework, conduct exams, and track analytics. Aperti handles the admin so you can teach." },
  ];

  const TEACHER_BENEFITS = [
    { icon: Clock, text: "Save 3+ hours per week on admin and marking" },
    { icon: TrendingUp, text: "Spot struggling students before exam season" },
    { icon: Shield, text: "Get paid securely via InstaPay — no cash handling" },
    { icon: Bell, text: "Automated parent updates — zero extra effort" },
    { icon: Activity, text: "Analytics that show your class's real performance" },
    { icon: Award, text: "Professional certificates generated automatically" },
  ];

  const STUDENT_BENEFITS = [
    { icon: Brain, text: "Personal study mentor available 24/7 to explain any concept" },
    { icon: Target, text: "Spaced-repetition flashcards proven to improve retention" },
    { icon: BarChart3, text: "See your own progress, risk score, and next steps" },
    { icon: Smartphone, text: "Works on any device — phone, tablet, laptop" },
    { icon: FileText, text: "All past papers, notes, and resources in one place" },
    { icon: Zap, text: "Instant homework feedback and grade notifications" },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">
      <Nav />

      {/* ── Hero ── */}
      <section className="pt-28 pb-16 md:pt-36 md:pb-24 px-5">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-14 items-center">
            <div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/8 px-3 py-1 rounded-full mb-6">
                  <Rocket className="h-3 w-3" /> Built for IGCSE & IB Educators
                </span>
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="text-4xl md:text-5xl lg:text-[3.5rem] font-extrabold leading-[1.08] tracking-tight mb-5">
                Run your entire<br />
                <span className="text-gray-400">teaching operation</span><br />
                <span style={{ color: "hsl(var(--primary))" }}>from one screen.</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="text-lg text-gray-500 mb-8 leading-relaxed max-w-lg">
                Attendance, structured grading, real-time parent updates, and student analytics — all in one place. Trusted by IGCSE & IB educators across Egypt and the Middle East.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-wrap gap-3 mb-8">
                <Link href="/register">
                  <motion.button
                    whileHover={{ scale: 1.02, boxShadow: "0 8px 24px hsl(var(--primary) / 0.35)" }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-white font-bold text-sm shadow-lg"
                    style={{ background: "linear-gradient(135deg, hsl(var(--primary)), #00897B)", boxShadow: "0 4px 16px hsl(var(--primary) / 0.30)" }}>
                    Start Free — No Card Required <ArrowRight className="h-4 w-4" />
                  </motion.button>
                </Link>
                <a href="#how-it-works">
                  <button className="flex items-center gap-2 px-6 py-3.5 rounded-2xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">
                    See How It Works
                  </button>
                </a>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                className="flex flex-wrap gap-x-5 gap-y-2">
                {["No lock-in", "Up in minutes", "IGCSE & IB aligned", "No card required"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5 text-sm text-gray-400">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> {t}
                  </span>
                ))}
              </motion.div>
            </div>
            <HeroDashboardMockup />
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <StatsSection />

      {/* ── Features ── */}
      <section id="features" className="py-24 px-5">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/8 px-3 py-1 rounded-full mb-4">
                <Layers className="h-3 w-3" /> What's included
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">Everything you need. Nothing you don't.</h2>
              <p className="text-gray-500 max-w-xl mx-auto">Every feature listed below is live and available today — no roadmap items, no coming-soon placeholders.</p>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.06}>
                <FeatureCard {...f} index={i} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison / Differentiation ── */}
      <section className="py-20 px-5 bg-gray-50/50">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-3 py-1 rounded-full mb-4">
                <Zap className="h-3 w-3" /> Replace your current setup
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">
                Tired of running a class on WhatsApp and spreadsheets?
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                Most educators in Egypt manage students across 4–6 disconnected tools. Aperti replaces all of them.
              </p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-6">
            <Reveal>
              <div className="bg-white border border-red-100 rounded-2xl p-6">
                <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-4">The old way</p>
                <ul className="space-y-3">
                  {[
                    "WhatsApp groups for homework — gets lost in chats",
                    "Excel sheets for grades — shared with wrong people",
                    "Manual attendance on paper — no parent visibility",
                    "Cash payments with no audit trail",
                    "No idea which students are falling behind until exams",
                    "Different tool for every subject and task",
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-gray-500">
                      <XCircleIcon className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="bg-white border border-primary/20 rounded-2xl p-6 shadow-sm" style={{ boxShadow: "0 0 0 1px hsl(var(--primary) / 0.12), 0 4px 16px hsl(var(--primary) / 0.06)" }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "hsl(var(--primary))" }}>With Aperti</p>
                <ul className="space-y-3">
                  {[
                    "Homework assigned, submitted, and graded in one place",
                    "Gradebook visible to teachers, students, and parents — separately",
                    "QR attendance in seconds, instant SMS to absent parents",
                    "InstaPay verified payments with full audit log",
                    "Risk alerts tell you who needs help — before they fail",
                    "One platform. Every role. Every workflow.",
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Teacher vs Student Benefits ── */}
      <section className="py-24 bg-gray-50/70 px-5">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">Built for every person in the classroom</h2>
              <p className="text-gray-500">Aperti serves teachers, students, and parents — with distinct, purpose-built experiences for each role.</p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-8">
            <Reveal>
              <div className="bg-white rounded-2xl border border-gray-100 p-7 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">For Teachers</p>
                    <p className="text-xs text-gray-400">Private tutors, IGCSE & IB educators</p>
                  </div>
                </div>
                <ul className="space-y-3">
                  {TEACHER_BENEFITS.map(({ icon: Icon, text }) => (
                    <li key={text} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm text-gray-600">{text}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <button className="mt-7 w-full py-3 rounded-xl text-sm font-bold text-white bg-primary hover:opacity-90 transition-opacity">
                    Register as Teacher
                  </button>
                </Link>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="bg-white rounded-2xl border border-gray-100 p-7 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-50">
                    <GraduationCap className="h-5 w-5 text-violet-500" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">For Students</p>
                    <p className="text-xs text-gray-400">IGCSE, AS/A-Level, and IB learners</p>
                  </div>
                </div>
                <ul className="space-y-3">
                  {STUDENT_BENEFITS.map(({ icon: Icon, text }) => (
                    <li key={text} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="h-3.5 w-3.5 text-violet-500" />
                      </div>
                      <span className="text-sm text-gray-600">{text}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <button className="mt-7 w-full py-3 rounded-xl text-sm font-bold text-white bg-violet-600 hover:opacity-90 transition-opacity">
                    Register as Student
                  </button>
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-20 px-5">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/8 px-3 py-1 rounded-full mb-4">
                <Star className="h-3 w-3" /> Trusted by educators
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">
                What teachers are saying
              </h2>
              <p className="text-gray-500 max-w-lg mx-auto">
                From solo tutors to multi-campus centers — Aperti is changing how education runs in Egypt.
              </p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "I used to spend Sunday evenings just copying grades into WhatsApp messages for parents. Now Aperti does it automatically. I get those 3 hours back every single week.",
                name: "Rania Khalil",
                role: "IGCSE Physics Teacher — Cairo",
                initials: "RK",
                color: "hsl(var(--primary))",
                bg: "hsl(var(--primary) / 0.08)",
                delay: 0,
              },
              {
                quote: "The structured grading workspace is brilliant. Everything is in one place — submission, rubric, marks, feedback. I can get through 30 papers in half the time it used to take me.",
                name: "Ahmed Saber",
                role: "A-Level Mathematics — Alexandria",
                initials: "AS",
                color: "#7C3AED",
                bg: "#7C3AED10",
                delay: 0.1,
              },
              {
                quote: "Parents used to call me constantly asking about test scores. Now they log in and see everything themselves. My phone is so much quieter — and parents are more engaged than ever.",
                name: "Nadia Ibrahim",
                role: "IB Chemistry — New Cairo",
                initials: "NI",
                color: "#0891B2",
                bg: "#0891B210",
                delay: 0.2,
              },
            ].map(({ quote, name, role, initials, color, bg, delay }) => (
              <Reveal key={name} delay={delay}>
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
                  <Quote className="h-5 w-5 mb-4 flex-shrink-0" style={{ color }} />
                  <p className="text-sm text-gray-600 leading-relaxed flex-1 italic">"{quote}"</p>
                  <div className="mt-5 flex items-center gap-3 pt-5 border-t border-gray-100">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: bg, color }}>
                      {initials}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{name}</p>
                      <p className="text-xs text-gray-400">{role}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.3}>
            <p className="text-center text-xs text-gray-400 mt-6">
              Testimonials from beta educators during private access period — names used with permission.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-24 px-5">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/8 px-3 py-1 rounded-full mb-4">
                <Rocket className="h-3 w-3" /> Up and running in minutes
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">Three steps. That's it.</h2>
              <p className="text-gray-500">No training required. No IT department. No migration headaches.</p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step, i) => (
              <Reveal key={step.step} delay={i * 0.1}>
                <div className="relative text-center md:text-left">
                  <div className="text-6xl font-black mb-4" style={{ color: "hsl(var(--primary) / 0.12)" }}>{step.step}</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
                  {i < HOW_IT_WORKS.length - 1 && (
                    <div className="hidden md:block absolute top-8 -right-4 text-gray-200">
                      <ArrowRight className="h-6 w-6" />
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.3}>
            <div className="mt-12 text-center">
              <Link href="/register">
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-white font-bold text-sm shadow-lg"
                  style={{ background: "linear-gradient(135deg, hsl(var(--primary)), #00897B)" }}>
                  Start for Free <ArrowRight className="h-4 w-4" />
                </motion.button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Pricing ── */}
      <PricingSection />

      {/* ── Security & Trust ── */}
      <section className="py-20 px-5">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="bg-gray-900 rounded-3xl p-10 md:p-14 text-white overflow-hidden relative">
              <div className="absolute inset-0 opacity-10"
                style={{ background: "radial-gradient(ellipse at 80% 50%, hsl(var(--primary)), transparent 60%)" }} />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-5">
                  <Shield className="h-5 w-5 text-primary" />
                  <span className="text-sm font-semibold text-primary">Security & Privacy</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-extrabold mb-4">Your data stays yours. Always.</h2>
                <p className="text-gray-400 mb-8 max-w-xl leading-relaxed">
                  Aperti is built with enterprise-grade security practices. Your student data, grades, and financials are never shared, sold, or used to train AI models.
                </p>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { icon: Lock, title: "TLS Encryption", desc: "All data encrypted in transit and at rest" },
                    { icon: Shield, title: "JWT Authentication", desc: "Stateless, tamper-proof session tokens" },
                    { icon: Activity, title: "Full Audit Logs", desc: "Every action logged with timestamp and actor" },
                    { icon: Globe, title: "GDPR-Ready", desc: "Data export and deletion on request" },
                    { icon: Users, title: "Role-Based Access", desc: "Teacher, student, parent, admin — strict isolation" },
                    { icon: CheckCircle2, title: "No Third-Party Ads", desc: "We don't monetize your data. Period." },
                  ].map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="bg-white/6 rounded-xl p-4 border border-white/8">
                      <Icon className="h-4 w-4 text-primary mb-2" />
                      <p className="text-sm font-semibold mb-0.5">{title}</p>
                      <p className="text-xs text-gray-400">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16 px-5 bg-gray-50/60">
        <div className="max-w-2xl mx-auto">
          <Reveal>
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">Frequently asked questions</h2>
              <p className="text-gray-500 text-sm">Still have questions? <Link href="/contact"><span className="text-primary font-medium cursor-pointer hover:underline">Contact us</span></Link></p>
            </div>
          </Reveal>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            {DEFAULT_FAQS.map((f, i) => <FAQItem key={f.q} q={f.q} a={f.a} index={i} />)}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-5">
        <div className="max-w-3xl mx-auto text-center">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/8 px-3 py-1 rounded-full mb-5">
              <Star className="h-3 w-3" /> Free to start. No credit card.
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              Ready to run a better classroom?
            </h2>
            <p className="text-gray-500 mb-8 max-w-xl mx-auto">
              Join teachers across Egypt and the Middle East who use Aperti to teach smarter, grade faster, and keep every parent informed.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/register">
                <motion.button
                  whileHover={{ scale: 1.02, boxShadow: "0 8px 28px hsl(var(--primary) / 0.38)" }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 px-7 py-3.5 rounded-2xl text-white font-bold text-sm shadow-lg"
                  style={{ background: "linear-gradient(135deg, hsl(var(--primary)), #00897B)" }}>
                  Create Free Account <ArrowRight className="h-4 w-4" />
                </motion.button>
              </Link>
              <Link href="/courses">
                <button className="px-7 py-3.5 rounded-2xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors">
                  Browse Courses
                </button>
              </Link>
            </div>
            <p className="mt-5 text-xs text-gray-400">No lock-in · Cancel anytime · InstaPay payments</p>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 py-12 px-5 bg-gray-50/60">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <p className="text-xl font-extrabold tracking-tight mb-3">Aperti<span style={{ color: "hsl(var(--primary))" }}>.</span></p>
              <p className="text-xs text-gray-400 leading-relaxed">Educational Operating System for IGCSE & IB educators across Egypt and the Middle East.</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Product</p>
              <ul className="space-y-2">
                {[{ l: "Features", h: "#features" }, { l: "Pricing", h: "/pricing" }, { l: "Courses", h: "/courses" }, { l: "Roadmap", h: "/roadmap" }].map(({ l, h }) => (
                  <li key={l}><a href={h} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Company</p>
              <ul className="space-y-2">
                {[{ l: "About", h: "/features" }, { l: "Contact", h: "/contact" }, { l: "Status", h: "/status" }, { l: "Release Notes", h: "/release-notes" }].map(({ l, h }) => (
                  <li key={l}><a href={h} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Legal</p>
              <ul className="space-y-2">
                {[{ l: "Terms of Service", h: "/terms" }, { l: "Privacy Policy", h: "/privacy" }, { l: "Cookie Settings", h: "/consent-settings" }].map(({ l, h }) => (
                  <li key={l}><a href={h} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-400">© {new Date().getFullYear()} Aperti. All rights reserved.</p>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Shield className="h-3.5 w-3.5" /> Secured · <Lock className="h-3.5 w-3.5" /> Encrypted · <Globe className="h-3.5 w-3.5" /> Egypt-first
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
