import { useState, useRef, FormEvent, useEffect } from "react";
import { motion, useInView, AnimatePresence, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, BookOpen, Brain, BarChart3, Video, CheckCircle2,
  Menu, X, GraduationCap, Clock, Users, ChevronRight, Sparkles,
  Shield, Zap, Target, Star, Globe, Quote, ChevronDown, ExternalLink,
  Rocket, Map, FileText, Activity,
} from "lucide-react";

const TEAL = "#00796B";
const TEAL_LIGHT = "#E6F4F1";

/* ─────────────────────────── CMS types ─────────────────────────── */
interface LandingSection {
  id: number; slug: string; type: string; content: Record<string, unknown>; is_published: boolean; order: number;
}
interface CMSTestimonial {
  id: number; name: string; role: string; organization: string; quote: string; rating: number; photo_url: string | null;
}
interface CMSFAQ {
  id: number; question: string; answer: string; category: string; order: number;
}
interface CMSPlan {
  id: number; name: string; price_egp: number; max_students: number | null; badge: string | null;
  is_highlighted: boolean; features: string[];
}
interface CMSBranding { primary_color: string | null; logo_url: string | null; }
interface LandingData {
  sections: LandingSection[];
  testimonials: CMSTestimonial[];
  faqs: CMSFAQ[];
  plans: CMSPlan[];
  branding: CMSBranding;
}

function useLandingCMS() {
  return useQuery<LandingData>({
    queryKey: ["landing-cms"],
    queryFn: async () => {
      const res = await fetch("/api/landing");
      if (!res.ok) throw new Error("CMS fetch failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

function getSection(sections: LandingSection[], slug: string) {
  return sections.find(s => s.slug === slug && s.is_published)?.content ?? {};
}

/* ─────────────────────────── Animations ─────────────────────────── */
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

/* ─────────────────────────── Hero SVG ─────────────────────────── */
function AbstractGeometry() {
  const T  = [270, 118], TR = [332, 154], TL = [208, 154];
  const M  = [270, 190], BR = [332, 226], BL = [208, 226], B = [270, 262];
  const edges: [number[], number[]][] = [
    [T, TR], [T, TL], [TR, M], [TL, M],
    [TR, BR], [M, B], [TL, BL], [BR, B], [BL, B],
  ];
  const topFace   = `${T[0]},${T[1]} ${TR[0]},${TR[1]} ${M[0]},${M[1]} ${TL[0]},${TL[1]}`;
  const rightFace = `${TR[0]},${TR[1]} ${BR[0]},${BR[1]} ${B[0]},${B[1]} ${M[0]},${M[1]}`;
  const leftFace  = `${TL[0]},${TL[1]} ${M[0]},${M[1]} ${B[0]},${B[1]} ${BL[0]},${BL[1]}`;
  const particles = [
    { cx: 490, cy: 80,  r: 3,   delay: 0   }, { cx: 80,  cy: 160, r: 2.5, delay: 0.6 },
    { cx: 560, cy: 330, r: 3.5, delay: 1.1 }, { cx: 40,  cy: 350, r: 2,   delay: 1.7 },
    { cx: 520, cy: 200, r: 2,   delay: 0.3 }, { cx: 140, cy: 310, r: 2,   delay: 0.9 },
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
      <circle cx={270} cy={190} r={180} fill="url(#geoGlow)" />
      {Array.from({ length: 8 }, (_, row) => Array.from({ length: 10 }, (_, col) => (
        <circle key={`${row}-${col}`} cx={50 + col * 56} cy={30 + row * 50} r={1.2} fill={TEAL} opacity={0.08} />
      )))}
      <polygon points={topFace}   fill={TEAL} opacity={0.13} />
      <polygon points={rightFace} fill={TEAL} opacity={0.08} />
      <polygon points={leftFace}  fill={TEAL} opacity={0.05} />
      {edges.map(([a, b], i) => (
        <motion.line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
          stroke={TEAL} strokeWidth={1.6} strokeOpacity={0.55}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.2 + i * 0.08, ease: "easeOut" }} />
      ))}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
        <line x1={490} y1={90} x2={450} y2={195} stroke={TEAL} strokeWidth={1.2} strokeOpacity={0.38} />
        <line x1={490} y1={90} x2={530} y2={195} stroke={TEAL} strokeWidth={1.2} strokeOpacity={0.38} />
        <line x1={450} y1={195} x2={530} y2={195} stroke={TEAL} strokeWidth={1.2} strokeOpacity={0.38} />
        <line x1={490} y1={90} x2={490} y2={195} stroke={TEAL} strokeWidth={1} strokeOpacity={0.2} strokeDasharray="4 3" />
      </motion.g>
      <motion.g filter="url(#softGlow)" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.9, type: "spring", bounce: 0.3 }} style={{ originX: "100px", originY: "310px" }}>
        <circle cx={100} cy={310} r={52} fill="none" stroke={TEAL} strokeWidth={1.4} strokeOpacity={0.35} />
        <ellipse cx={100} cy={310} rx={52} ry={14} fill="none" stroke={TEAL} strokeWidth={1} strokeOpacity={0.22} strokeDasharray="5 3" />
        <line x1={100} y1={258} x2={100} y2={362} stroke={TEAL} strokeWidth={0.8} strokeOpacity={0.18} strokeDasharray="4 3" />
      </motion.g>
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}>
        <ellipse cx={510} cy={320} rx={45} ry={18} fill="none" stroke={TEAL} strokeWidth={1.2} strokeOpacity={0.3} />
        <ellipse cx={510} cy={320} rx={22} ry={9}  fill="none" stroke={TEAL} strokeWidth={1}   strokeOpacity={0.2} />
      </motion.g>
      {particles.map((p, i) => (
        <motion.circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={TEAL} opacity={0.4}
          animate={{ y: [-5, 5, -5], opacity: [0.4, 0.65, 0.4] }}
          transition={{ duration: 3 + i * 0.7, delay: p.delay, repeat: Infinity, ease: "easeInOut" }} />
      ))}
    </svg>
  );
}

/* ─────────────────────────── Nav ─────────────────────────── */
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
        <Link href="/"><span className="text-xl font-extrabold tracking-tight cursor-pointer" style={{ color: "#121212" }}>Aperti<span style={{ color: TEAL }}>.</span></span></Link>
        <div className="hidden md:flex items-center gap-7 text-sm font-medium text-gray-500">
          <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
          <Link href="/courses" className="hover:text-gray-900 transition-colors">Courses</Link>
          <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
          <a href="#apply" className="hover:text-gray-900 transition-colors">Apply</a>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <Link href="/courses"><button className="text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all">Explore Courses</button></Link>
          <Link href="/login"><button className="text-sm font-semibold px-4 py-2 rounded-xl text-white transition-all hover:opacity-90" style={{ background: TEAL }}>Sign In</button></Link>
        </div>
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
                <a key={href} href={href} onClick={() => setOpen(false)} className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-1">{label}</a>
              ))}
              <Link href="/courses"><span className="block text-sm font-medium text-gray-600 hover:text-gray-900 py-1" onClick={() => setOpen(false)}>Courses</span></Link>
              <div className="pt-2 flex gap-2">
                <Link href="/register" className="flex-1"><button className="w-full text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 text-gray-700">Register</button></Link>
                <Link href="/login" className="flex-1"><button className="w-full text-sm font-semibold px-4 py-2 rounded-xl text-white" style={{ background: TEAL }}>Sign In</button></Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

/* ─────────────────────────── Courses ─────────────────────────── */
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
      return data.sort((a, b) => (b.enrolled_count ?? 0) - (a.enrolled_count ?? 0)).slice(0, 3);
    },
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {[0,1,2].map(i => <FeaturedCourseSkeleton key={i} />)}
    </div>
  );

  if (courses.length === 0) return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }} className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
      <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center shadow-lg"
        style={{ background: `linear-gradient(135deg, ${TEAL}, #00897B)` }}>
        <BookOpen className="h-8 w-8 text-white" />
      </motion.div>
      <p className="font-extrabold text-gray-900 text-lg mb-2">Courses launching soon</p>
      <p className="text-sm text-gray-400 max-w-xs mx-auto">Our educators are preparing exclusive content. Be the first to enroll.</p>
      <Link href="/courses"><button className="mt-6 px-6 py-3 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-shadow" style={{ background: `linear-gradient(135deg, ${TEAL}, #00897B)` }}>Visit Marketplace</button></Link>
    </motion.div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {courses.map((c, i) => {
        const color = subjectColor(c.subject);
        return (
          <Reveal key={c.id} delay={i * 0.1}>
            <Link href={`/courses/${c.id}`}>
              <motion.div whileHover={{ y: -8, boxShadow: "0 24px 48px rgba(0,0,0,0.12)", transition: { duration: 0.25 } }}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100 cursor-pointer h-full flex flex-col">
                <div className="h-38 relative flex items-end p-4" style={{ background: `linear-gradient(145deg, ${color}18 0%, ${color}30 100%)`, minHeight: 144 }}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div animate={{ rotate: [0, 3, -3, 0] }} transition={{ duration: 6, repeat: Infinity, delay: i * 0.4 }}
                      className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md"
                      style={{ background: `linear-gradient(135deg, ${color}CC, ${color})` }}>
                      <BookOpen className="h-7 w-7 text-white" />
                    </motion.div>
                  </div>
                  {c.subject && <span className="relative z-10 text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm" style={{ background: `${color}22`, color, border: `1px solid ${color}30` }}>{c.subject}</span>}
                  {(c.enrolled_count ?? 0) > 0 && (
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 shadow-sm">
                      <Users className="h-3 w-3" style={{ color }} />
                      <span className="text-[10px] font-bold" style={{ color }}>{c.enrolled_count} enrolled</span>
                    </div>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 flex-1">{c.title}</h3>
                    {c.price_egp != null && <span className="text-xs font-black whitespace-nowrap ml-1" style={{ color: TEAL }}>{c.price_egp} EGP</span>}
                  </div>
                  {c.teacher_name && <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><GraduationCap className="h-3 w-3" />{c.teacher_name}</p>}
                  {c.description && <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-3 flex-1">{c.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-auto pt-2 border-t border-gray-50">
                    {c.duration_weeks && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{c.duration_weeks}w</span>}
                    <span className="flex items-center gap-1 ml-auto" style={{ color }}>View Course <ChevronRight className="h-3 w-3" /></span>
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

/* ─────────────────────────── Stats ─────────────────────────── */
function useCountUp(target: number, duration = 1600) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasRun = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
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
    }, { threshold: 0.2 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);
  return { count, ref };
}

interface LiveStats {
  students: number; teachers: number; courses: number;
  assessments_completed: number; resources_uploaded: number; live_sessions: number;
}

function StatItem({ value, suffix = "", label, delay }: { value: number; suffix?: string; label: string; delay: number }) {
  const { count, ref } = useCountUp(value);
  return (
    <Reveal delay={delay}>
      <div ref={ref} className="text-center">
        <p className="text-3xl font-black mb-1" style={{ color: TEAL }}>{count.toLocaleString()}{suffix}</p>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
      </div>
    </Reveal>
  );
}

function StatsStrip({ cmsStats }: { cmsStats: Array<{ label: string; value: string }> }) {
  const { data: stats } = useQuery<LiveStats>({
    queryKey: ["landing-live-stats"],
    queryFn: async () => {
      const res = await fetch("/api/landing/stats");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const liveItems = [
    { value: stats?.students ?? 0, suffix: (stats?.students ?? 0) > 0 ? "+" : "", label: "Active students" },
    { value: stats?.teachers ?? 0, suffix: "", label: "Educators on the platform" },
    { value: stats?.courses ?? 0, suffix: "", label: "Published courses" },
    { value: stats?.assessments_completed ?? 0, suffix: (stats?.assessments_completed ?? 0) > 0 ? "+" : "", label: "Assessments submitted" },
  ];

  const displayItems = cmsStats.length >= 4
    ? cmsStats.slice(0, 4).map((s, i) => {
        const live = liveItems[i];
        const numMatch = s.value.match(/[\d,]+/);
        const numVal = numMatch ? parseInt(numMatch[0].replace(/,/g, ""), 10) : live.value;
        const hasPlus = s.value.includes("+");
        return { value: typeof numVal === "number" && numVal > live.value ? numVal : live.value, suffix: hasPlus || live.suffix ? "+" : "", label: s.label };
      })
    : liveItems;

  return (
    <div className="py-16 px-5 border-y border-gray-100" style={{ background: "#F9FAFB" }}>
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        {displayItems.map((s, i) => <StatItem key={i} value={s.value} suffix={s.suffix} label={s.label} delay={i * 0.08} />)}
      </div>
    </div>
  );
}

/* ─────────────────────────── Pricing ─────────────────────────── */
const PLAN_COLORS = [TEAL, "#00695C", "#004D40", "#1565C0"];

function CMSPricingCard({ plan, colorIdx }: { plan: CMSPlan; colorIdx: number }) {
  const color = PLAN_COLORS[colorIdx % PLAN_COLORS.length];
  const featuresArr: string[] = Array.isArray(plan.features) ? plan.features : [];
  return (
    <motion.div whileHover={{ y: -6, transition: { duration: 0.2 } }}
      className={`bg-white rounded-2xl p-6 shadow-sm border-2 relative overflow-hidden ${plan.is_highlighted ? "" : "border-gray-100"}`}
      style={{ borderColor: plan.is_highlighted ? color : undefined }}>
      {(plan.badge || plan.is_highlighted) && (
        <div className="absolute top-4 right-4 px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: color }}>
          {plan.badge ?? "POPULAR"}
        </div>
      )}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${color}15` }}>
        <Star className="h-5 w-5" style={{ color }} />
      </div>
      <h3 className="font-extrabold text-gray-900 text-lg mb-1">{plan.name}</h3>
      <div className="mb-1">
        <span className="text-3xl font-black" style={{ color }}>{plan.price_egp}</span>
        <span className="text-gray-400 text-sm ml-1">EGP / mo</span>
      </div>
      <p className="text-xs text-gray-400 mb-5">{plan.max_students ? `Up to ${plan.max_students} students` : "Unlimited"}</p>
      <div className="space-y-2 mb-6">
        {featuresArr.map((f, fi) => (
          <div key={fi} className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color }} />
            {f}
          </div>
        ))}
      </div>
      <a href="#apply">
        <button className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
          style={{ background: plan.is_highlighted ? color : `${color}12`, color: plan.is_highlighted ? "white" : color }}>
          Get Started
        </button>
      </a>
    </motion.div>
  );
}

const FALLBACK_PLANS: CMSPlan[] = [
  { id: 1, name: "Starter",      price_egp: 50,  max_students: 30,  badge: null,      is_highlighted: false, features: ["30 students","Attendance","Homework submissions","Basic analytics"] },
  { id: 2, name: "Professional", price_egp: 100, max_students: 80,  badge: "POPULAR", is_highlighted: true,  features: ["80 students","All Starter features","AI Tutor (Mentor)","QueryVault & CardStack","Parent Hub"] },
  { id: 3, name: "Enterprise",   price_egp: 150, max_students: 200, badge: null,      is_highlighted: false, features: ["200 students","All Professional features","InsightStream analytics","Priority support","API access"] },
  { id: 4, name: "Master",       price_egp: 200, max_students: null, badge: null,     is_highlighted: false, features: ["Unlimited students","All features","Custom integrations","Dedicated support","SLA guaranteed"] },
];

/* ─────────────────────────── Testimonials ─────────────────────────── */
interface VerifiedTestimonial extends CMSTestimonial { is_verified?: boolean; }

function TestimonialsSection({ testimonials }: { testimonials: VerifiedTestimonial[] }) {
  if (!testimonials.length) return (
    <section className="py-24 px-5" style={{ background: "#F5F5F5" }}>
      <div className="max-w-7xl mx-auto text-center">
        <Reveal>
          <div className="mb-10">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border mb-5"
              style={{ background: TEAL_LIGHT, color: TEAL, borderColor: `${TEAL}25` }}>
              <Star className="h-3 w-3" />Trusted by educators
            </span>
            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
              What teachers are <span style={{ color: TEAL }}>saying.</span>
            </h2>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 max-w-md mx-auto">
            <Quote className="h-10 w-10 mx-auto mb-4 opacity-20" style={{ color: TEAL }} />
            <p className="text-sm text-gray-500 leading-relaxed">Be the first educator to share your experience with Aperti.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );

  return (
    <section className="py-24 px-5" style={{ background: "#F5F5F5" }}>
      <div className="max-w-7xl mx-auto">
        <Reveal>
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border mb-5"
              style={{ background: TEAL_LIGHT, color: TEAL, borderColor: `${TEAL}25` }}>
              <Star className="h-3 w-3" />Trusted by educators
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
              What teachers are <span style={{ color: TEAL }}>saying.</span>
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">Real results from real educators using Aperti every day.</p>
          </div>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {testimonials.slice(0, 6).map((t, i) => (
            <Reveal key={t.id} delay={i * 0.08}>
              <motion.div whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm h-full flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <Quote className="h-6 w-6 opacity-30" style={{ color: TEAL }} />
                  {t.is_verified && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: TEAL_LIGHT, color: TEAL, border: `1px solid ${TEAL}25` }}>
                      <Shield className="h-2.5 w-2.5" />Verified
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed flex-1 mb-5 italic">"{t.quote}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-50">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ background: `linear-gradient(135deg, ${TEAL}, #00897B)` }}>
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 leading-tight">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role}{t.organization ? ` · ${t.organization}` : ""}</p>
                  </div>
                  <div className="ml-auto flex gap-0.5">
                    {Array.from({ length: t.rating }).map((_, ri) => (
                      <Star key={ri} className="h-3 w-3 fill-current" style={{ color: "#F59E0B" }} />
                    ))}
                  </div>
                </div>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── FAQ ─────────────────────────── */
function FAQSection({ faqs }: { faqs: CMSFAQ[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!faqs.length) return null;
  return (
    <section className="py-24 px-5 bg-white">
      <div className="max-w-3xl mx-auto">
        <Reveal>
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border mb-5"
              style={{ background: TEAL_LIGHT, color: TEAL, borderColor: `${TEAL}25` }}>
              FAQ
            </span>
            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
              Frequently asked <span style={{ color: TEAL }}>questions.</span>
            </h2>
          </div>
        </Reveal>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <Reveal key={faq.id} delay={i * 0.04}>
              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                <button onClick={() => setOpen(open === faq.id ? null : faq.id)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50/50 transition-colors">
                  <span className="font-semibold text-gray-900 text-sm pr-4">{faq.question}</span>
                  <motion.div animate={{ rotate: open === faq.id ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {open === faq.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden">
                      <p className="px-6 pb-5 text-sm text-gray-500 leading-relaxed border-t border-gray-50 pt-3">{faq.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Early Access Form ─────────────────────────── */
function EarlyAccessForm({ ctaText, email }: { ctaText?: string; email?: string }) {
  const [form, setForm] = useState({ name: "", email: "", students: "", subjects: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/waitlist/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, name: form.name, metadata: { students: form.students, subjects: form.subjects, message: form.message } }),
      });
    } catch {}
    setLoading(false);
    setSubmitted(true);
  };

  if (submitted) return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100 max-w-lg mx-auto">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: TEAL_LIGHT }}>
        <CheckCircle2 className="h-7 w-7" style={{ color: TEAL }} />
      </div>
      <h3 className="text-xl font-extrabold text-gray-900 mb-2">Application received!</h3>
      <p className="text-gray-500 text-sm">We will personally reach out within 48 hours to set up your workspace.</p>
    </motion.div>
  );

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 max-w-lg mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {[
          { key: "name", label: "Full Name *", placeholder: "Dr. Ahmed Hassan", type: "text", required: true },
          { key: "email", label: "Email Address *", placeholder: "you@school.com", type: "email", required: true },
          { key: "students", label: "Estimated Students", placeholder: "e.g. 60", type: "text", required: false },
          { key: "subjects", label: "Subjects Taught", placeholder: "Physics, Math…", type: "text", required: false },
        ].map(field => (
          <div key={field.key}>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">{field.label}</label>
            <input required={field.required} type={field.type} value={form[field.key as keyof typeof form]}
              onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-gray-50/50"
              placeholder={field.placeholder} />
          </div>
        ))}
      </div>
      <div className="mb-5">
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tell us about your school</label>
        <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={3}
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-gray-50/50 resize-none"
          placeholder="Tell us about your teaching setup, current challenges, and what you hope Aperti can do for your students…" />
      </div>
      <button type="submit" disabled={loading}
        className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 flex items-center justify-center gap-2"
        style={{ background: TEAL }}>
        {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting…</> : <>{ctaText ?? "Request Early Access"} <ArrowRight className="h-4 w-4" /></>}
      </button>
      {email && (
        <p className="text-center text-xs text-gray-400 mt-4">
          Or email us at <a href={`mailto:${email}`} className="underline" style={{ color: TEAL }}>{email}</a>
        </p>
      )}
    </form>
  );
}

/* ─────────────────────────── ICON MAP ─────────────────────────── */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Brain, BarChart3, Video, Shield, Zap, BookOpen, Target, Users, Globe, Star, CheckCircle2, Rocket, Map, FileText, Activity,
};
const getIcon = (name?: string) => ICON_MAP[name ?? ""] ?? Zap;

/* ─────────────────────────── MAIN LANDING ─────────────────────────── */
export default function Landing() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -40]);
  const { data: cms } = useLandingCMS();

  const sections = cms?.sections ?? [];
  const testimonials = cms?.testimonials ?? [];
  const faqs = cms?.faqs ?? [];
  const plans: CMSPlan[] = (cms?.plans ?? []).length > 0 ? (cms?.plans ?? []) : FALLBACK_PLANS;
  const teal = cms?.branding?.primary_color ?? TEAL;

  const hero     = getSection(sections, "hero");
  const featureS = getSection(sections, "features");
  const statsS   = getSection(sections, "statistics");
  const pricingS = getSection(sections, "pricing");
  const contactS = getSection(sections, "contact");

  const headline       = (hero.headline as string)         ?? "Where every mind";
  const headlineAccent = (hero.headline_accent as string)  ?? "finds its rhythm.";
  const subheadline    = (hero.subheadline as string)      ?? "The intelligent operating system that unifies teaching, learning, and assessment in one breathtakingly simple platform.";
  const badgeText      = (hero.badge_text as string)       ?? "Educational Operating System";
  const ctaPrimary     = (hero.cta_primary_text as string) ?? "Explore Courses";
  const ctaSecondary   = (hero.cta_secondary_text as string) ?? "Create Free Account";

  const featuresHeadline      = (featureS.headline as string)       ?? "Everything you need to";
  const featuresHeadlineAccent = (featureS.headline_accent as string) ?? "teach, learn, and grow.";
  const cmsFeatList = (featureS.features as Array<{ icon: string; title: string; description: string }> | undefined) ?? [];
  const displayFeatures = cmsFeatList.length > 0 ? cmsFeatList : [
    { icon: "Video",  title: "Live Interactive Classes",   description: "Host real-time video sessions with whiteboard collaboration, screen sharing, and live chat." },
    { icon: "Brain",  title: "AI-Powered Mentor",         description: "Students get 24/7 tutoring from an AI mentor trained on your course material." },
    { icon: "BarChart3", title: "Smart Attendance",       description: "QR-code check-in, GPS validation, and live dashboards. Never chase a register again." },
    { icon: "Zap",    title: "Auto-Grading Engine",       description: "Submit homework, mark schemes auto-applied. Teachers review only edge cases." },
  ];

  const statItems = (statsS.stats as Array<{ label: string; value: string }> | undefined) ?? [];

  const pricingHeadline = (pricingS.headline as string) ?? "Plans that scale with you.";
  const pricingAccent   = (pricingS.headline_accent as string) ?? "";
  const contactHeadline = (contactS.headline as string) ?? "Start teaching smarter.";
  const contactCta      = (contactS.cta_text as string) ?? "Request Early Access";
  const contactEmail    = (contactS.email as string)    ?? "hello@aperti.io";

  return (
    <div className="min-h-screen font-sans" style={{ background: "#F5F5F5", color: "#121212" }}>
      <Nav />

      {/* ── HERO ── */}
      <section className="min-h-screen flex items-center pt-24 pb-16 px-5 relative overflow-hidden" style={{ background: "white" }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-[0.04]" style={{ background: teal }} />
          <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full opacity-[0.03]" style={{ background: teal }} />
        </div>
        <div className="max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, ease: [0.22,1,0.36,1] }}>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold mb-7 border"
                style={{ background: TEAL_LIGHT, color: teal, borderColor: `${teal}25` }}>
                <Sparkles className="h-3 w-3" />
                {badgeText}
              </motion.div>
              <h1 className="text-5xl md:text-6xl lg:text-[64px] font-black leading-[1.06] tracking-tight mb-6" style={{ color: "#121212" }}>
                {headline}<br />
                <span style={{ color: teal }}>{headlineAccent}</span>
              </h1>
              <p className="text-lg text-gray-500 leading-relaxed mb-9 max-w-xl">{subheadline}</p>
              <div className="flex flex-wrap gap-3 mb-10">
                <a href="#courses-preview">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white shadow-lg"
                    style={{ background: teal, boxShadow: `0 8px 24px ${teal}30` }}>
                    {ctaPrimary} <ArrowRight className="h-4 w-4" />
                  </motion.button>
                </a>
                <Link href="/register">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-gray-700 border border-gray-200 bg-white hover:border-gray-300 transition-colors">
                    {ctaSecondary}
                  </motion.button>
                </Link>
              </div>
            </motion.div>
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
                style={{ background: TEAL_LIGHT, color: teal, borderColor: `${teal}25` }}>
                <Zap className="h-3 w-3" />Simple by design
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">Up and running in three steps.</h2>
              <p className="text-gray-500 max-w-md mx-auto">No complex setup. No weeks of training. Just open Aperti and start teaching.</p>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            <div className="hidden md:block absolute top-12 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px"
              style={{ background: `linear-gradient(to right, ${teal}30, ${teal}60, ${teal}30)` }} />
            {[
              { step: "01", title: "Create your workspace", desc: "Sign up and create your workspace in minutes. Configure your subjects and invite your students — no setup fees, no waiting.", icon: Shield },
              { step: "02", title: "Invite students & parents", desc: "Students register and select you as their teacher. Parents link via a secure pairing code. You approve each connection with one click.", icon: Users },
              { step: "03", title: "Teach, assess, analyse", desc: "Run live classes, set homework, auto-grade exams, and watch real-time analytics tell you exactly which student needs help — before they fall behind.", icon: BarChart3 },
            ].map((item, i) => (
              <Reveal key={item.step} delay={i * 0.12}>
                <motion.div whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm relative text-center">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 relative" style={{ background: `${teal}12` }}>
                    <item.icon className="h-6 w-6" style={{ color: teal }} />
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ background: teal }}>
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
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm text-white shadow-lg"
                  style={{ background: teal, boxShadow: `0 8px 24px ${teal}30` }}>
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
                  style={{ background: TEAL_LIGHT, color: teal, borderColor: `${teal}25` }}>
                  <BookOpen className="h-3 w-3" />Course Marketplace
                </span>
                <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Featured Courses</h2>
                <p className="text-gray-500 mt-2">Expert-led courses with live sessions, AI mentoring, and structured assessments.</p>
              </div>
              <Link href="/courses">
                <button className="hidden sm:flex items-center gap-1.5 text-sm font-semibold hover:opacity-80 transition-opacity" style={{ color: teal }}>
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
                  style={{ borderColor: teal, color: teal }}>
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
                style={{ background: TEAL_LIGHT, color: teal, borderColor: `${teal}25` }}>
                <Target className="h-3 w-3" />Platform Features
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
                {featuresHeadline}<br />
                <span style={{ color: teal }}>{featuresHeadlineAccent}</span>
              </h2>
              <p className="text-gray-500 max-w-lg mx-auto">Built for modern educators who demand the best from every tool they use.</p>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayFeatures.map((f, i) => {
              const Icon = getIcon(f.icon);
              return (
                <Reveal key={i} delay={i * 0.08}>
                  <motion.div whileHover={{ y: -8, boxShadow: "0 20px 40px rgba(0,0,0,0.08)", transition: { duration: 0.2 } }}
                    className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm h-full">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: `${teal}12` }}>
                      <Icon className="h-5 w-5" style={{ color: teal }} />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2 text-sm">{f.title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">{f.description}</p>
                  </motion.div>
                </Reveal>
              );
            })}
          </div>
          <Reveal delay={0.3}>
            <div className="text-center mt-10">
              <Link href="/features">
                <button className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm border-2 transition-all hover:bg-gray-50"
                  style={{ borderColor: teal, color: teal }}>
                  See all features <ExternalLink className="h-4 w-4" />
                </button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── STATS STRIP ── */}
      <StatsStrip cmsStats={statItems} />

      {/* ── TESTIMONIALS (CMS-driven) ── */}
      <TestimonialsSection testimonials={testimonials} />

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 px-5 bg-white">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border mb-5"
                style={{ background: TEAL_LIGHT, color: teal, borderColor: `${teal}25` }}>
                Transparent Pricing
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
                {pricingHeadline}{pricingAccent && <> <span style={{ color: teal }}>{pricingAccent}</span></>}
              </h2>
              <p className="text-gray-500 max-w-lg mx-auto">Pay per student, per month. Simple transparent pricing — no lock-in, no surprise invoices.</p>
            </div>
          </Reveal>
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${plans.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-5`}>
            {plans.map((p, i) => (
              <Reveal key={p.id} delay={i * 0.1}>
                <CMSPricingCard plan={p} colorIdx={i} />
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.4}>
            <p className="text-center text-sm text-gray-400 mt-8">
              Volume discounts available for large centres. InstaPay accepted.{" "}
              <a href={`mailto:${contactEmail}`} className="underline underline-offset-2 font-medium" style={{ color: teal }}>
                Talk to us for custom pricing.
              </a>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ (CMS-driven) ── */}
      <FAQSection faqs={faqs} />

      {/* ── ROADMAP TEASER ── */}
      {sections.some(s => s.slug === "roadmap" && s.is_published) && (
        <section className="py-20 px-5" style={{ background: "#F5F5F5" }}>
          <div className="max-w-3xl mx-auto text-center">
            <Reveal>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border mb-5"
                style={{ background: TEAL_LIGHT, color: teal, borderColor: `${teal}25` }}>
                <Map className="h-3 w-3" />What's coming
              </span>
              <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">
                {(getSection(sections, "roadmap").headline as string) ?? "What we are"}{" "}
                <span style={{ color: teal }}>{(getSection(sections, "roadmap").headline_accent as string) ?? "building next."}</span>
              </h2>
              <p className="text-gray-500 text-sm mb-8">{(getSection(sections, "roadmap").subheadline as string) ?? "See what is coming to Aperti and follow our public roadmap."}</p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link href="/roadmap">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white"
                    style={{ background: teal }}>
                    <Map className="h-4 w-4" />View Roadmap
                  </motion.button>
                </Link>
                <Link href="/release-notes">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm border border-gray-200 bg-white text-gray-700 hover:border-gray-300 transition-colors">
                    <FileText className="h-4 w-4" />Release Notes
                  </motion.button>
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ── GET STARTED CTA ── */}
      <section id="apply" className="py-24 px-5" style={{ background: "#F5F5F5" }}>
        <div className="max-w-3xl mx-auto text-center">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border mb-5"
              style={{ background: TEAL_LIGHT, color: teal, borderColor: `${teal}25` }}>
              <Globe className="h-3 w-3" />Get started today
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">{contactHeadline}</h2>
            <p className="text-gray-500 max-w-lg mx-auto text-lg leading-relaxed mb-10">
              Create your workspace, invite your students, and run your first class — all in one place.
            </p>
          </Reveal>
          <EarlyAccessForm ctaText={contactCta} email={contactEmail} />
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-gray-100 py-12 px-5 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-10">
            <div className="max-w-xs">
              <p className="text-lg font-extrabold text-gray-900 mb-1">Aperti<span style={{ color: teal }}>.</span></p>
              <p className="text-xs text-gray-400 leading-relaxed">Where every mind finds its rhythm. The educational operating system for modern educators.</p>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm text-gray-400">
              <Link href="/courses"><span className="hover:text-gray-700 transition-colors cursor-pointer">Course Marketplace</span></Link>
              <Link href="/features"><span className="hover:text-gray-700 transition-colors cursor-pointer">Features</span></Link>
              <Link href="/roadmap"><span className="hover:text-gray-700 transition-colors cursor-pointer">Roadmap</span></Link>
              <Link href="/release-notes"><span className="hover:text-gray-700 transition-colors cursor-pointer">Release Notes</span></Link>
              <Link href="/status"><span className="hover:text-gray-700 transition-colors cursor-pointer">Status</span></Link>
              <a href="/paper-vault" className="hover:text-gray-700 transition-colors">Past Papers</a>
              <a href="/terms" className="hover:text-gray-700 transition-colors">Terms</a>
              <a href="/privacy" className="hover:text-gray-700 transition-colors">Privacy</a>
              <a href="/contact" className="hover:text-gray-700 transition-colors">Contact</a>
              <Link href="/trust"><span className="hover:text-gray-700 transition-colors cursor-pointer">Trust Center</span></Link>
              <a href="/sitemap" className="hover:text-gray-700 transition-colors">Sitemap</a>
            </div>
            <div>
              <a href={`mailto:${contactEmail}`} className="text-sm font-semibold hover:opacity-80 transition-opacity" style={{ color: teal }}>{contactEmail}</a>
              <div className="mt-4">
                <Link href="/register">
                  <button className="text-sm font-semibold px-5 py-2.5 rounded-xl text-white" style={{ background: teal }}>Get Started Free</button>
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
