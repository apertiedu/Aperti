import { useState, useRef, FormEvent, useEffect } from "react";
import { motion, useInView, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, BookOpen, Brain, BarChart3, Video, CheckCircle2,
  Menu, X, GraduationCap, Clock, Users, ChevronRight, Sparkles,
  Shield, Zap, Target, Star, Globe
} from "lucide-react";

const TEAL = "#00796B";
const TEAL_LIGHT = "#E6F4F1";
const TEAL_MED = "#00897B";

/* ── Scroll reveal ── */
function Reveal({ children, delay = 0, y = 28 }: { children: React.ReactNode; delay?: number; y?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

/* ── Abstract Geometry Hero Visual ── */
function AbstractGeometry() {
  // Isometric cube wireframe key points (cx=270, cy=190, s=72)
  const T  = [270, 118], TR = [332, 154], TL = [208, 154];
  const M  = [270, 190], BR = [332, 226], BL = [208, 226], B = [270, 262];

  const edges: [number[], number[]][] = [
    [T, TR], [T, TL], [TR, M], [TL, M],
    [TR, BR], [M, B], [TL, BL],
    [BR, B], [BL, B],
  ];

  const topFace  = `${T[0]},${T[1]} ${TR[0]},${TR[1]} ${M[0]},${M[1]} ${TL[0]},${TL[1]}`;
  const rightFace = `${TR[0]},${TR[1]} ${BR[0]},${BR[1]} ${B[0]},${B[1]} ${M[0]},${M[1]}`;
  const leftFace  = `${TL[0]},${TL[1]} ${M[0]},${M[1]} ${B[0]},${B[1]} ${BL[0]},${BL[1]}`;

  const particles = [
    { cx: 490, cy: 80, r: 3, delay: 0 }, { cx: 80, cy: 160, r: 2.5, delay: 0.6 },
    { cx: 560, cy: 330, r: 3.5, delay: 1.1 }, { cx: 40, cy: 350, r: 2, delay: 1.7 },
    { cx: 520, cy: 200, r: 2, delay: 0.3 }, { cx: 140, cy: 310, r: 2, delay: 0.9 },
  ];

  return (
    <svg viewBox="0 0 600 400" className="w-full max-w-2xl" style={{ height: 360 }} aria-hidden>
      <defs>
        <radialGradient id="geoGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={TEAL} stopOpacity="0.15" />
          <stop offset="100%" stopColor={TEAL} stopOpacity="0" />
        </radialGradient>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Background glow */}
      <circle cx={270} cy={190} r={180} fill="url(#geoGlow)" />

      {/* Dot grid */}
      {Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: 10 }, (_, col) => (
          <circle key={`${row}-${col}`}
            cx={50 + col * 56} cy={30 + row * 50} r={1.2}
            fill={TEAL} opacity={0.08} />
        ))
      )}

      {/* Cube face fills */}
      <polygon points={topFace}  fill={TEAL} opacity={0.13} />
      <polygon points={rightFace} fill={TEAL} opacity={0.08} />
      <polygon points={leftFace}  fill={TEAL} opacity={0.05} />

      {/* Cube wireframe edges */}
      {edges.map(([a, b], i) => (
        <motion.line key={i}
          x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
          stroke={TEAL} strokeWidth={1.6} strokeOpacity={0.55}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.2 + i * 0.08, ease: "easeOut" }}
        />
      ))}

      {/* Small pyramid (top-right) */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
        <line x1={490} y1={90} x2={450} y2={195} stroke={TEAL} strokeWidth={1.2} strokeOpacity={0.38} />
        <line x1={490} y1={90} x2={530} y2={195} stroke={TEAL} strokeWidth={1.2} strokeOpacity={0.38} />
        <line x1={450} y1={195} x2={530} y2={195} stroke={TEAL} strokeWidth={1.2} strokeOpacity={0.38} />
        <line x1={490} y1={90} x2={490} y2={195} stroke={TEAL} strokeWidth={1} strokeOpacity={0.2} strokeDasharray="4 3" />
      </motion.g>

      {/* Sphere outline (lower-left) */}
      <motion.g filter="url(#softGlow)"
        initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.9, type: "spring", bounce: 0.3 }}
        style={{ originX: "100px", originY: "310px" }}>
        <circle cx={100} cy={310} r={52} fill="none" stroke={TEAL} strokeWidth={1.4} strokeOpacity={0.35} />
        <ellipse cx={100} cy={310} rx={52} ry={14} fill="none" stroke={TEAL} strokeWidth={1} strokeOpacity={0.22} strokeDasharray="5 3" />
        <line x1={100} y1={258} x2={100} y2={362} stroke={TEAL} strokeWidth={0.8} strokeOpacity={0.18} strokeDasharray="4 3" />
      </motion.g>

      {/* Torus hint (bottom-right) */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}>
        <ellipse cx={510} cy={320} rx={45} ry={18} fill="none" stroke={TEAL} strokeWidth={1.2} strokeOpacity={0.3} />
        <ellipse cx={510} cy={320} rx={22} ry={9} fill="none" stroke={TEAL} strokeWidth={1} strokeOpacity={0.2} />
      </motion.g>

      {/* Floating particles */}
      {particles.map((p, i) => (
        <motion.circle key={i} cx={p.cx} cy={p.cy} r={p.r}
          fill={TEAL} opacity={0.4}
          animate={{ y: [-5, 5, -5], opacity: [0.4, 0.65, 0.4] }}
          transition={{ duration: 3 + i * 0.7, delay: p.delay, repeat: Infinity, ease: "easeInOut" }} />
      ))}
    </svg>
  );
}

/* ── Nav ── */
function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/">
          <span className="text-xl font-extrabold tracking-tight cursor-pointer" style={{ color: "#121212" }}>
            Aperti<span style={{ color: TEAL }}>.</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-7 text-sm font-medium text-gray-500">
          <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
          <Link href="/courses" className="hover:text-gray-900 transition-colors">Courses</Link>
          <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
          <a href="#apply" className="hover:text-gray-900 transition-colors">Apply</a>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/courses">
            <button className="text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all">
              Explore Courses
            </button>
          </Link>
          <Link href="/login">
            <button className="text-sm font-semibold px-4 py-2 rounded-xl text-white transition-all hover:opacity-90" style={{ background: TEAL }}>
              Sign In
            </button>
          </Link>
        </div>

        {/* Mobile menu button */}
        <button className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} className="md:hidden bg-white border-t border-gray-100 overflow-hidden">
            <div className="px-5 py-4 space-y-3">
              {[["#features","Features"],["#pricing","Pricing"],["#apply","Apply"]].map(([href,label]) => (
                <a key={href} href={href} onClick={() => setOpen(false)}
                  className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-1">{label}</a>
              ))}
              <Link href="/courses"><span className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-1" onClick={() => setOpen(false)}>Courses</span></Link>
              <div className="pt-2 flex gap-2">
                <Link href="/student-register" className="flex-1">
                  <button className="w-full text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 text-gray-700">Register</button>
                </Link>
                <Link href="/login" className="flex-1">
                  <button className="w-full text-sm font-semibold px-4 py-2 rounded-xl text-white" style={{ background: TEAL }}>Sign In</button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

/* ── Pricing card ── */
const plans = [
  { name: "Starter", price: 50, seats: "Up to 30", color: "#757575", features: ["30 students", "CheckIn & Attendance", "Homework submissions", "Basic analytics"] },
  { name: "Professional", price: 100, seats: "Up to 80", color: TEAL, highlight: true, features: ["80 students", "All Starter features", "LiveClass streaming", "QueryVault & CardStack", "Parent Guardian Hub"] },
  { name: "Enterprise", price: 150, seats: "Up to 200", color: "#00695C", features: ["200 students", "All Professional features", "InsightStream analytics", "Priority support", "API access"] },
  { name: "Master", price: 200, seats: "Unlimited", color: "#004D40", features: ["Unlimited students", "All features", "Custom integrations", "Dedicated support", "SLA guaranteed"] },
];

function PricingCard({ plan }: { plan: typeof plans[0] }) {
  return (
    <motion.div whileHover={{ y: -6, transition: { duration: 0.2 } }}
      className={`bg-white rounded-2xl p-6 shadow-sm border-2 relative overflow-hidden ${plan.highlight ? "" : "border-gray-100"}`}
      style={{ borderColor: plan.highlight ? plan.color : undefined }}>
      {plan.highlight && (
        <div className="absolute top-4 right-4 px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: plan.color }}>
          POPULAR
        </div>
      )}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${plan.color}15` }}>
        <Star className="h-5 w-5" style={{ color: plan.color }} />
      </div>
      <h3 className="font-extrabold text-gray-900 text-lg mb-1">{plan.name}</h3>
      <div className="mb-1">
        <span className="text-3xl font-black" style={{ color: plan.color }}>{plan.price}</span>
        <span className="text-gray-400 text-sm ml-1">EGP / mo</span>
      </div>
      <p className="text-xs text-gray-400 mb-5">{plan.seats}</p>
      <div className="space-y-2 mb-6">
        {plan.features.map(f => (
          <div key={f} className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: plan.color }} />
            {f}
          </div>
        ))}
      </div>
      <a href="#apply">
        <button className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
          style={{ background: plan.highlight ? plan.color : `${plan.color}12`, color: plan.highlight ? "white" : plan.color }}>
          Get Started
        </button>
      </a>
    </motion.div>
  );
}

/* ── Feature card ── */
const features = [
  { icon: Video, title: "Live Interactive Classes", desc: "Host real-time video sessions with whiteboard collaboration, screen sharing, and live chat. Students join from anywhere.", color: TEAL },
  { icon: Brain, title: "AI-Powered Mentor", desc: "Students get 24/7 tutoring from an intelligent AI mentor trained on your course material and exam syllabi.", color: TEAL },
  { icon: BarChart3, title: "Smart Attendance", desc: "QR-code check-in, GPS validation, and live attendance dashboards. Never chase a register again.", color: TEAL },
  { icon: Zap, title: "Auto-Grading Engine", desc: "Submit homework, mark schemes auto-applied. Instant feedback. Teachers review only edge cases.", color: TEAL },
];

/* ── Subject colour palette ── */
const SUBJECT_PALETTE: Record<string, string> = {
  Physics: "#1565C0", Math: "#2E7D32", Mathematics: "#2E7D32",
  Chemistry: "#6A1B9A", Biology: "#00838F", English: "#C62828",
  History: "#4E342E", Geography: "#006064", Economics: "#E65100",
  "Computer Science": "#4527A0", CS: "#4527A0", Arabic: "#AD1457",
  Science: "#00796B",
};
const subjectColor = (s?: string | null) => SUBJECT_PALETTE[s ?? ""] ?? TEAL;

interface PublicCourse {
  id: number; title: string; description: string | null; subject: string | null;
  price_egp: number | null; thumbnail_url: string | null; duration_weeks: number | null;
  enrolled_count: number | null; teacher_name: string | null;
}

function FeaturedCourseSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
      <div className="h-36 bg-gradient-to-br from-gray-100 to-gray-50" />
      <div className="p-5 space-y-3">
        <div className="h-4 bg-gray-100 rounded-lg w-3/4" />
        <div className="h-3 bg-gray-100 rounded-lg w-1/2" />
        <div className="h-3 bg-gray-100 rounded-lg w-1/3" />
      </div>
    </div>
  );
}

function FeaturedCoursesSection() {
  const { data: courses = [], isLoading } = useQuery<PublicCourse[]>({
    queryKey: ["public-courses-featured"],
    queryFn: async () => {
      const res = await fetch("/courses");
      if (!res.ok) return [];
      const data: PublicCourse[] = await res.json();
      return data
        .sort((a, b) => (b.enrolled_count ?? 0) - (a.enrolled_count ?? 0))
        .slice(0, 3);
    },
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[0, 1, 2].map(i => <FeaturedCourseSkeleton key={i} />)}
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm"
      >
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center shadow-lg"
          style={{ background: `linear-gradient(135deg, ${TEAL}, #00897B)` }}
        >
          <BookOpen className="h-8 w-8 text-white" />
        </motion.div>
        <p className="font-extrabold text-gray-900 text-lg mb-2">Courses launching soon</p>
        <p className="text-sm text-gray-400 max-w-xs mx-auto">Our educators are preparing exclusive course content. Be the first to enroll.</p>
        <Link href="/courses">
          <button className="mt-6 px-6 py-3 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-shadow"
            style={{ background: `linear-gradient(135deg, ${TEAL}, #00897B)` }}>
            Visit Marketplace
          </button>
        </Link>
      </motion.div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {courses.map((c, i) => {
        const color = subjectColor(c.subject);
        return (
          <Reveal key={c.id} delay={i * 0.1}>
            <Link href={`/courses/${c.id}`}>
              <motion.div
                whileHover={{ y: -8, boxShadow: "0 24px 48px rgba(0,0,0,0.12)", transition: { duration: 0.25, ease: [0.22,1,0.36,1] } }}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100 cursor-pointer h-full flex flex-col"
              >
                {/* Thumbnail / subject banner */}
                <div className="h-38 relative flex items-end p-4"
                  style={{ background: `linear-gradient(145deg, ${color}18 0%, ${color}30 100%)`, minHeight: 144 }}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      animate={{ rotate: [0, 3, -3, 0] }}
                      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
                      className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md"
                      style={{ background: `linear-gradient(135deg, ${color}CC, ${color})` }}
                    >
                      <BookOpen className="h-7 w-7 text-white" />
                    </motion.div>
                  </div>
                  {/* Subject pill */}
                  {c.subject && (
                    <span className="relative z-10 text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm"
                      style={{ background: `${color}22`, color, border: `1px solid ${color}30` }}>
                      {c.subject}
                    </span>
                  )}
                  {/* Enrolled badge */}
                  {(c.enrolled_count ?? 0) > 0 && (
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 shadow-sm">
                      <Users className="h-3 w-3" style={{ color }} />
                      <span className="text-[10px] font-bold" style={{ color }}>{c.enrolled_count} enrolled</span>
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 flex-1">{c.title}</h3>
                    {c.price_egp != null && (
                      <span className="text-xs font-black whitespace-nowrap ml-1" style={{ color: TEAL }}>
                        {c.price_egp} EGP
                      </span>
                    )}
                  </div>
                  {c.teacher_name && (
                    <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                      <GraduationCap className="h-3 w-3" />{c.teacher_name}
                    </p>
                  )}
                  {c.description && (
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-3 flex-1">{c.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-auto pt-2 border-t border-gray-50">
                    {c.duration_weeks && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{c.duration_weeks}w</span>
                    )}
                    <span className="flex items-center gap-1 ml-auto" style={{ color }}>
                      View Course <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </motion.div>
            </Link>
          </Reveal>
        );
      })}
    </div>
  );
}

/* ── Count-up hook (native IntersectionObserver) ── */
function useCountUp(target: number, duration = 1600) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasRun.current) {
          hasRun.current = true;
          observer.disconnect();
          if (target === 0) return;
          const startTime = performance.now();
          const tick = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { count, ref };
}

interface PlatformStats {
  activeStudents: number;
  activeTeachers: number;
  publishedCourses: number;
  attendanceRecords: number;
}

function StatItem({ value, suffix = "", label, delay }: { value: number; suffix?: string; label: string; delay: number }) {
  const { count, ref } = useCountUp(value);
  return (
    <Reveal delay={delay}>
      <div ref={ref} className="text-center">
        <p className="text-3xl font-black mb-1" style={{ color: TEAL }}>
          {count.toLocaleString()}{suffix}
        </p>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
      </div>
    </Reveal>
  );
}

function StatsStrip() {
  const { data: stats } = useQuery<PlatformStats>({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const res = await fetch("/auth/stats");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const items = [
    { value: stats?.activeStudents ?? 0, suffix: stats && stats.activeStudents > 0 ? "+" : "", label: "Active students" },
    { value: stats?.activeTeachers ?? 0, suffix: "", label: "Educators on the platform" },
    { value: stats?.publishedCourses ?? 0, suffix: "", label: "Published courses" },
    { value: stats?.attendanceRecords ?? 0, suffix: stats && stats.attendanceRecords > 0 ? "+" : "", label: "Attendance records logged" },
  ];

  return (
    <div className="py-16 px-5 border-y border-gray-100" style={{ background: "#F9FAFB" }}>
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        {items.map((s, i) => (
          <StatItem key={i} value={s.value} suffix={s.suffix} label={s.label} delay={i * 0.08} />
        ))}
      </div>
    </div>
  );
}

/* ── Early access form ── */
function EarlyAccessForm() {
  const [form, setForm] = useState({ name: "", email: "", students: "", subjects: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    setLoading(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100 max-w-lg mx-auto">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: TEAL_LIGHT }}>
          <CheckCircle2 className="h-7 w-7" style={{ color: TEAL }} />
        </div>
        <h3 className="text-xl font-extrabold text-gray-900 mb-2">Application received!</h3>
        <p className="text-gray-500 text-sm">We will personally reach out within 48 hours to set up your workspace.</p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 max-w-lg mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full Name *</label>
          <input required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-gray-50/50"
            placeholder="Dr. Ahmed Hassan" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Address *</label>
          <input required type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-gray-50/50"
            placeholder="you@school.com" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Estimated Students</label>
          <input value={form.students} onChange={e => setForm(f => ({...f, students: e.target.value}))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-gray-50/50"
            placeholder="e.g. 60" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Subjects Taught</label>
          <input value={form.subjects} onChange={e => setForm(f => ({...f, subjects: e.target.value}))}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-gray-50/50"
            placeholder="Physics, Math…" />
        </div>
      </div>
      <div className="mb-5">
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tell us about your school</label>
        <textarea value={form.message} onChange={e => setForm(f => ({...f, message: e.target.value}))} rows={3}
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-gray-50/50 resize-none"
          placeholder="Tell us about your teaching setup, current challenges, and what you hope Aperti can do for your students…" />
      </div>
      <button type="submit" disabled={loading}
        className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 flex items-center justify-center gap-2"
        style={{ background: TEAL }}>
        {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</> : <>Request Early Access <ArrowRight className="h-4 w-4" /></>}
      </button>
    </form>
  );
}

/* ── MAIN ── */
export default function Landing() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -40]);

  return (
    <div className="min-h-screen font-sans" style={{ background: "#F5F5F5", color: "#121212" }}>
      <Nav />

      {/* ── HERO ── */}
      <section className="min-h-screen flex items-center pt-24 pb-16 px-5 relative overflow-hidden" style={{ background: "white" }}>
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-[0.04]" style={{ background: TEAL }} />
          <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full opacity-[0.03]" style={{ background: TEAL }} />
        </div>

        <div className="max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left: copy */}
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, ease: [0.22,1,0.36,1] }}>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold mb-7 border"
                style={{ background: TEAL_LIGHT, color: TEAL, borderColor: `${TEAL}25` }}>
                <Sparkles className="h-3 w-3" />
                Educational Operating System
              </motion.div>

              <h1 className="text-5xl md:text-6xl lg:text-[64px] font-black leading-[1.06] tracking-tight mb-6" style={{ color: "#121212" }}>
                Where every mind<br />
                <span style={{ color: TEAL }}>finds its rhythm.</span>
              </h1>

              <p className="text-lg text-gray-500 leading-relaxed mb-9 max-w-xl">
                The intelligent operating system that unifies teaching, learning, and assessment in one breathtakingly simple platform.
              </p>

              <div className="flex flex-wrap gap-3 mb-10">
                <a href="#courses-preview">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white shadow-lg"
                    style={{ background: TEAL, boxShadow: `0 8px 24px ${TEAL}30` }}>
                    Explore Courses <ArrowRight className="h-4 w-4" />
                  </motion.button>
                </a>
                <a href="#apply">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-gray-700 border border-gray-200 bg-white hover:border-gray-300 transition-colors">
                    Request Early Access
                  </motion.button>
                </a>
              </div>

              <div className="flex flex-wrap gap-5 text-xs text-gray-400">
                {["GDPR-compliant data ownership", "Dedicated onboarding support", "No lock-in contracts"].map((t, i) => (
                  <motion.div key={t} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 + i * 0.1 }}
                    className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: TEAL }} />
                    {t}
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Right: SVG */}
            <motion.div style={{ y: heroY }} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.9, delay: 0.2, ease: [0.22,1,0.36,1] }}
              className="relative hidden lg:block">
              <AbstractGeometry />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 px-5" style={{ background: "#F5F5F5" }}>
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border mb-5"
                style={{ background: TEAL_LIGHT, color: TEAL, borderColor: `${TEAL}25` }}>
                <Zap className="h-3 w-3" />Simple by design
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
                Up and running in three steps.
              </h2>
              <p className="text-gray-500 max-w-md mx-auto">No complex setup. No weeks of training. Just open Aperti and start teaching.</p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Connector line desktop */}
            <div className="hidden md:block absolute top-12 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px"
              style={{ background: `linear-gradient(to right, ${TEAL}30, ${TEAL}60, ${TEAL}30)` }} />

            {[
              {
                step: "01",
                title: "Create your workspace",
                desc: "Apply for early access. We personally set up your teacher account, configure your subjects, and onboard your students in under 24 hours.",
                icon: Shield,
                color: TEAL,
              },
              {
                step: "02",
                title: "Invite students & parents",
                desc: "Students register and select you as their teacher. Parents link via a secure pairing code. You approve each connection with one click.",
                icon: Users,
                color: TEAL,
              },
              {
                step: "03",
                title: "Teach, assess, analyse",
                desc: "Run live classes, set homework, auto-grade exams, and watch real-time analytics tell you exactly which student needs help — before they fall behind.",
                icon: BarChart3,
                color: TEAL,
              },
            ].map((item, i) => (
              <Reveal key={item.step} delay={i * 0.12}>
                <motion.div
                  whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm relative text-center"
                >
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 relative"
                    style={{ background: `${item.color}12` }}>
                    <item.icon className="h-6 w-6" style={{ color: item.color }} />
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                      style={{ background: item.color }}>
                      {item.step.replace("0", "")}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-gray-900 mb-3 text-base">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                </motion.div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.4}>
            <div className="text-center mt-10">
              <a href="#apply">
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm text-white shadow-lg"
                  style={{ background: TEAL, boxShadow: `0 8px 24px ${TEAL}30` }}>
                  Get started today <ArrowRight className="h-4 w-4" />
                </motion.button>
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── COURSE PREVIEW ── */}
      <section id="courses-preview" className="py-24 px-5 bg-white">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="flex items-end justify-between mb-12">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border mb-4"
                  style={{ background: TEAL_LIGHT, color: TEAL, borderColor: `${TEAL}25` }}>
                  <BookOpen className="h-3 w-3" />Course Marketplace
                </span>
                <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Featured Courses</h2>
                <p className="text-gray-500 mt-2">Expert-led courses with live sessions, AI mentoring, and structured assessments.</p>
              </div>
              <Link href="/courses">
                <button className="hidden sm:flex items-center gap-1.5 text-sm font-semibold hover:opacity-80 transition-opacity" style={{ color: TEAL }}>
                  View All <ChevronRight className="h-4 w-4" />
                </button>
              </Link>
            </div>
          </Reveal>

          <FeaturedCoursesSection />

          <Reveal delay={0.3}>
            <div className="text-center mt-8">
              <Link href="/courses">
                <button className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm border-2 transition-all hover:bg-gray-50"
                  style={{ borderColor: TEAL, color: TEAL }}>
                  Browse All Courses <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 px-5 bg-white">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border mb-5"
                style={{ background: TEAL_LIGHT, color: TEAL, borderColor: `${TEAL}25` }}>
                <Target className="h-3 w-3" />Platform Features
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
                Everything you need to<br />teach brilliantly.
              </h2>
              <p className="text-gray-500 max-w-lg mx-auto">Built for modern educators who demand the best from every tool they use.</p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.1}>
                <motion.div whileHover={{ y: -8, boxShadow: "0 20px 40px rgba(0,0,0,0.08)", transition: { duration: 0.2 } }}
                  className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm h-full">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: `${f.color}12` }}>
                    <f.icon className="h-5 w-5" style={{ color: f.color }} />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2 text-sm">{f.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ── */}
      <StatsStrip />

      {/* ── TESTIMONIALS ── */}
      <section className="py-24 px-5" style={{ background: "#F5F5F5" }}>
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border mb-5"
                style={{ background: TEAL_LIGHT, color: TEAL, borderColor: `${TEAL}25` }}>
                <Star className="h-3 w-3" />Trusted by educators
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
                Teachers love Aperti.
              </h2>
              <p className="text-gray-500 max-w-md mx-auto">From solo tutors to large teaching centres — here's what they say.</p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                quote: "I used to spend 3 hours a week just tracking attendance and chasing homework. Aperti cut that to under 20 minutes. My students are more engaged and I actually have time to teach.",
                name: "Dr. Sara Khalil",
                role: "Physics Teacher · 85 students",
                initials: "SK",
                color: TEAL,
                stars: 5,
              },
              {
                quote: "The AI mentor is genuinely impressive. My weaker students are asking it questions at midnight and showing up to class with better grasp of the concepts. It's like I have a teaching assistant for every single student.",
                name: "Mr. Omar Hassan",
                role: "Math Tutor · IGCSE & A-Level",
                initials: "OH",
                color: "#00897B",
                stars: 5,
              },
              {
                quote: "Parents message me less about 'how is my child doing?' because GuardianHub answers that for them. They see attendance, homework, scores — all live. Trust went up overnight.",
                name: "Ms. Nadia Farouk",
                role: "English & Literature · 60 students",
                initials: "NF",
                color: "#00695C",
                stars: 5,
              },
            ].map((t, i) => (
              <Reveal key={t.name} delay={i * 0.1}>
                <motion.div
                  whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm flex flex-col h-full"
                >
                  <div className="flex gap-0.5 mb-5">
                    {Array.from({ length: t.stars }).map((_, s) => (
                      <Star key={s} className="h-3.5 w-3.5 fill-current" style={{ color: "#F59E0B" }} />
                    ))}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed flex-1 italic mb-6">"{t.quote}"</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-gray-50">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ background: t.color }}
                    >
                      {t.initials}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{t.name}</p>
                      <p className="text-xs text-gray-400">{t.role}</p>
                    </div>
                  </div>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 px-5 bg-white">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border mb-5"
                style={{ background: TEAL_LIGHT, color: TEAL, borderColor: `${TEAL}25` }}>
                Transparent Pricing
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
                Plans that scale with you.
              </h2>
              <p className="text-gray-500 max-w-lg mx-auto">
                Pay per student, per month. Adjust seats at any time with FlexSeats — no lock-in, no surprise invoices.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.1}>
                <PricingCard plan={p} />
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.4}>
            <p className="text-center text-sm text-gray-400 mt-8">
              Volume discounts available for large centres. InstaPay accepted.{" "}
              <a href="#apply" className="underline underline-offset-2 font-medium" style={{ color: TEAL }}>
                Talk to us for custom pricing.
              </a>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── EARLY ACCESS FORM ── */}
      <section id="apply" className="py-24 px-5" style={{ background: "#F5F5F5" }}>
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border mb-5"
                style={{ background: TEAL_LIGHT, color: TEAL, borderColor: `${TEAL}25` }}>
                <Globe className="h-3 w-3" />Exclusive Community
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
                Join Aperti Early Access.
              </h2>
              <p className="text-gray-500 max-w-lg mx-auto text-lg leading-relaxed">
                We are onboarding a select community of pioneering educators. Tell us about your school — we will personally build your workspace together.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <EarlyAccessForm />
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-gray-100 py-12 px-5 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-10">
            <div className="max-w-xs">
              <p className="text-lg font-extrabold text-gray-900 mb-1">
                Aperti<span style={{ color: TEAL }}>.</span>
              </p>
              <p className="text-xs text-gray-400 leading-relaxed">Where every mind finds its rhythm. The educational operating system for modern educators.</p>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm text-gray-400">
              <Link href="/courses"><span className="hover:text-gray-700 transition-colors cursor-pointer">Course Marketplace</span></Link>
              <a href="/paper-vault" className="hover:text-gray-700 transition-colors">Past Papers</a>
              <a href="/terms" className="hover:text-gray-700 transition-colors">Terms</a>
              <a href="/privacy" className="hover:text-gray-700 transition-colors">Privacy</a>
              <a href="/contact" className="hover:text-gray-700 transition-colors">Contact</a>
              <a href="/sitemap" className="hover:text-gray-700 transition-colors">Sitemap</a>
            </div>
            <div>
              <a href="mailto:info@aperti.ai" className="text-sm font-semibold hover:opacity-80 transition-opacity" style={{ color: TEAL }}>
                info@aperti.ai
              </a>
              <div className="mt-4">
                <Link href="/student-register">
                  <button className="text-sm font-semibold px-5 py-2.5 rounded-xl text-white" style={{ background: TEAL }}>
                    Student Sign Up
                  </button>
                </Link>
              </div>
            </div>
          </div>
          <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-gray-400">
            <span>© 2026 Aperti. All rights reserved.</span>
            <span>Built for educators who refuse to compromise.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
