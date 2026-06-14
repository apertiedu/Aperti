import { useState, useRef, FormEvent, useEffect, useMemo } from "react";
import { motion, useInView, AnimatePresence, useScroll, useTransform, useReducedMotion, useMotionValue, useSpring } from "framer-motion";
import { Link } from "wouter";
import { Landing3DHeroCanvas } from "@/components/landing-3d-hero";
import { useQuery } from "@tanstack/react-query";
import { animate as animeAnimate, stagger as animeStagger } from "animejs";
import {
  ArrowRight, BookOpen, Brain, BarChart3, Video, CheckCircle2,
  Menu, X, GraduationCap, Clock, Users, ChevronRight, Sparkles,
  Shield, Zap, Target, Star, Globe, Quote, ChevronDown, ExternalLink,
  Rocket, Map, FileText, Activity, Check, Minus, Building2,
} from "lucide-react";

const TEAL = "#0D9488";
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
  id: number; name: string; type?: "teacher" | "student"; price_egp: number; max_students: number | null;
  badge: string | null; is_highlighted: boolean; features: string[];
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

/* ─────────────────────────── 3D Tilt Feature Card ─────────────────────────── */
function Feature3DTiltCard({ teal, Icon, title, description, index }: {
  teal: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  description: string;
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 200, damping: 28 });
  const springY = useSpring(y, { stiffness: 200, damping: 28 });
  const rotateX = useTransform(springY, [-60, 60], [7, -7]);
  const rotateY = useTransform(springX, [-60, 60], [-7, 7]);
  const glowOpacity = useMotionValue(0);
  const glowSpring = useSpring(glowOpacity, { stiffness: 200, damping: 25 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set(e.clientX - rect.left - rect.width / 2);
    y.set(e.clientY - rect.top - rect.height / 2);
    glowOpacity.set(1);
  };
  const handleLeave = () => {
    x.set(0);
    y.set(0);
    glowOpacity.set(0);
  };

  const ICON_BGS = [`${teal}12`, "#7C3AED14", "#0891B214", "#DC262614", "#D9770614", "#05966914"];

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      className="relative card-shine bg-white rounded-2xl border border-gray-100 shadow-sm h-full overflow-hidden cursor-default">
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          opacity: glowSpring,
          background: `radial-gradient(circle at 50% 0%, ${teal}10 0%, transparent 70%)`,
        }} />
      <div className="p-6 h-full flex flex-col relative z-10">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
          style={{ background: ICON_BGS[index % ICON_BGS.length] }}>
          <Icon className="h-5 w-5" style={{ color: teal }} />
        </div>
        <h3 className="font-bold text-gray-900 mb-2 text-sm">{title}</h3>
        <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
      </div>
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
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = document.querySelector(".landing-scroll") as HTMLElement | null;
    if (!container) return;
    scrollRef.current = container;
    const fn = () => setScrolled(container.scrollTop > 60);
    container.addEventListener("scroll", fn, { passive: true });
    return () => container.removeEventListener("scroll", fn);
  }, []);

  const navBg = scrolled
    ? "bg-white/95 backdrop-blur-xl shadow-sm border-b border-gray-100"
    : "bg-transparent backdrop-blur-sm";
  const logoColor = scrolled ? "#121212" : "#ffffff";
  const linkColor = scrolled ? "text-gray-500 hover:text-gray-900" : "text-white/70 hover:text-white";
  const mobileIconColor = scrolled ? "text-gray-500" : "text-white/70";

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navBg}`}>
      <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/">
          <span className="text-xl font-extrabold tracking-tight cursor-pointer transition-colors duration-300" style={{ color: logoColor }}>
            Aperti<span style={{ color: TEAL }}>.</span>
          </span>
        </Link>
        <div className={`hidden md:flex items-center gap-7 text-sm font-medium transition-colors duration-300 ${linkColor}`}>
          <a href="#features" className="transition-colors">Features</a>
          <Link href="/courses" className="transition-colors">Courses</Link>
          <a href="#pricing" className="transition-colors">Pricing</a>
          <a href="#apply" className="transition-colors">Apply</a>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <Link href="/courses">
            <button className="text-sm font-medium px-4 py-2 rounded-xl transition-all duration-300"
              style={scrolled
                ? { border: "1px solid #e5e7eb", color: "#374151", background: "transparent" }
                : { border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.8)", background: "rgba(255,255,255,0.06)" }}>
              Explore Courses
            </button>
          </Link>
          <Link href="/login">
            <button className="text-sm font-semibold px-4 py-2 rounded-xl text-white transition-all hover:opacity-90" style={{ background: TEAL }}>
              Sign In
            </button>
          </Link>
        </div>
        <button className={`md:hidden p-2 rounded-lg transition-colors ${mobileIconColor}`} onClick={() => setOpen(!open)}>
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
  Science: "#0D9488",
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
  const prefersReduced = useReducedMotion();
  useEffect(() => {
    if (prefersReduced) { setCount(target); return; }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !hasRun.current) {
        hasRun.current = true;
        observer.disconnect();
        if (target === 0) return;
        const obj = { value: 0 };
        animeAnimate(obj, {
          value: target,
          duration,
          ease: "outCubic",
          onUpdate() { setCount(Math.round(obj.value)); },
          onComplete() { setCount(target); },
        });
      }
    }, { threshold: 0.2 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration, prefersReduced]);
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

function DarkStatItem({ value, suffix = "", label, delay, teal }: { value: number; suffix?: string; label: string; delay: number; teal: string }) {
  const { count, ref } = useCountUp(value, 2000);
  return (
    <motion.div ref={ref} className="text-center"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
      <p className="text-4xl md:text-5xl font-black mb-2"
        style={{ color: teal, textShadow: `0 0 48px ${teal}50` }}>
        {count.toLocaleString()}{suffix}
      </p>
      <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</p>
    </motion.div>
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

  const hasRealData = (stats?.students ?? 0) > 0 || (stats?.teachers ?? 0) > 0;
  const teal = TEAL;

  const PLATFORM_CAPABILITIES = [
    { label: "IGCSE-ready curriculum", sublabel: "Full syllabus coverage", icon: BookOpen },
    { label: "AI-powered grading", sublabel: "Seconds, not hours", icon: Brain },
    { label: "Built for Egypt", sublabel: "Arabic & English support", icon: Globe },
    { label: "Live analytics", sublabel: "Every student tracked", icon: BarChart3 },
  ];

  return (
    <div className="py-20 px-5 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #060D1B 0%, #091525 60%, #0D1F2D 100%)" }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: `linear-gradient(${teal}08 1px, transparent 1px), linear-gradient(90deg, ${teal}08 1px, transparent 1px)`, backgroundSize: "64px 64px" }} />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 70% 50% at 50% 100%, ${teal}18 0%, transparent 65%)` }} />
      <div className="max-w-5xl mx-auto relative z-10">
        {hasRealData ? (
          <>
            <p className="text-center text-xs font-bold uppercase tracking-widest mb-12"
              style={{ color: `${teal}80`, letterSpacing: "0.2em" }}>Live platform metrics</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
              {[
                { value: stats?.students ?? 0, suffix: "+", label: "Active students" },
                { value: stats?.teachers ?? 0, suffix: "", label: "Educators" },
                { value: stats?.courses ?? 0, suffix: "", label: "Published courses" },
                { value: stats?.assessments_completed ?? 0, suffix: "+", label: "Assessments graded" },
              ].map((s, i) => (
                <DarkStatItem key={i} value={s.value} suffix={s.suffix} label={s.label} delay={i * 0.1} teal={teal} />
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-center text-xs font-bold uppercase tracking-widest mb-12"
              style={{ color: `${teal}80`, letterSpacing: "0.2em" }}>Platform capabilities</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
              {PLATFORM_CAPABILITIES.map((cap, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="text-center p-6 rounded-2xl"
                  style={{ background: `${teal}08`, border: `1px solid ${teal}20` }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: `${teal}15` }}>
                    <cap.icon className="h-6 w-6" style={{ color: teal }} />
                  </div>
                  <p className="text-base font-bold mb-1" style={{ color: "rgba(255,255,255,0.85)" }}>{cap.label}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{cap.sublabel}</p>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── Marquee Strip ─────────────────────────── */
const MARQUEE_ITEMS = [
  "AI Grading", "Live Classes", "Parent Portal", "IGCSE Ready",
  "Smart Analytics", "Auto Feedback", "Attendance Tracking", "Exam Preparation",
  "AI Mentor 24/7", "Question Bank", "GradeBook+", "Progress Reports",
  "Spaced Repetition", "Instant QR Attendance", "SnapGrade AI", "Parent Alerts",
];

function MarqueeStrip() {
  const prefersReduced = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<any>(null);
  const doubled = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];

  useEffect(() => {
    if (prefersReduced || !trackRef.current) return;
    const el = trackRef.current;
    animRef.current = animeAnimate(el, {
      translateX: "-50%",
      duration: 38000,
      ease: "linear",
      loop: true,
    });
    return () => { animRef.current?.pause?.(); };
  }, [prefersReduced]);

  return (
    <div className="relative overflow-hidden py-3.5"
      style={{ background: `linear-gradient(90deg, #0A4A44 0%, #0D9488 50%, #0A4A44 100%)` }}>
      <div className="absolute inset-y-0 left-0 w-20 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to right, #0A4A44, transparent)" }} />
      <div className="absolute inset-y-0 right-0 w-20 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to left, #0A4A44, transparent)" }} />
      {prefersReduced ? (
        <div className="flex flex-wrap gap-4 justify-center px-8">
          {MARQUEE_ITEMS.map((item, i) => (
            <span key={i} className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white/40" />{item}
            </span>
          ))}
        </div>
      ) : (
        <div ref={trackRef} className="flex items-center gap-10 whitespace-nowrap will-change-transform"
          style={{ width: "max-content" }}>
          {doubled.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-2 text-xs font-bold text-white/75 uppercase tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" />
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Pricing ─────────────────────────── */
const TEACHER_COLORS = [TEAL, "#00897B", "#00695C", "#004D40"];
const STUDENT_COLORS = ["#0277BD", "#0288D1", "#01579B"];

const PLAN_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  starter: Zap, essential: Star, pro: Target, elite: Shield,
  basic: BookOpen, learner: Brain, scholar: GraduationCap,
};

function CMSPricingCard({ plan, colorIdx, isStudent }: { plan: CMSPlan; colorIdx: number; isStudent?: boolean }) {
  const palette = isStudent ? STUDENT_COLORS : TEACHER_COLORS;
  const color = palette[colorIdx % palette.length];
  const featuresArr: string[] = Array.isArray(plan.features) ? plan.features : [];
  const Icon = PLAN_ICONS[plan.name?.toLowerCase()] ?? Star;
  const popular = plan.is_highlighted || plan.badge === "POPULAR";
  return (
    <motion.div
      whileHover={{ y: -5, boxShadow: `0 20px 48px ${color}18`, transition: { duration: 0.2 } }}
      className="bg-white rounded-2xl p-6 border-2 relative flex flex-col h-full"
      style={{ borderColor: popular ? color : "#f0f0f0" }}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold text-white whitespace-nowrap"
          style={{ background: color }}>
          {plan.badge ?? "MOST POPULAR"}
        </div>
      )}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${color}14` }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <h3 className="font-extrabold text-gray-900 text-lg mb-1">{plan.name}</h3>
      <div className="mb-1 flex items-end gap-1">
        {plan.price_egp === 0 ? (
          <span className="text-3xl font-black" style={{ color }}>Free</span>
        ) : (
          <>
            <span className="text-3xl font-black" style={{ color }}>{Number(plan.price_egp).toLocaleString()}</span>
            <span className="text-gray-400 text-sm mb-1">EGP / mo</span>
          </>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-5">
        {plan.max_students ? `Up to ${plan.max_students} students` : "Unlimited"}
      </p>
      <div className="space-y-2 mb-6 flex-1">
        {featuresArr.map((f, fi) => (
          <div key={fi} className="flex items-start gap-2 text-sm text-gray-600">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color }} />
            {f}
          </div>
        ))}
      </div>
      <Link href="/register">
        <button className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90"
          style={{ background: popular ? color : `${color}12`, color: popular ? "white" : color }}>
          Get Started →
        </button>
      </Link>
    </motion.div>
  );
}

const FALLBACK_TEACHER_PLANS: CMSPlan[] = [
  { id: 1, name: "Starter",   type: "teacher", price_egp: 2500,  max_students: 30,  badge: null,      is_highlighted: false, features: ["Up to 30 students","Core teaching tools","Attendance & homework","Basic analytics","Email support"] },
  { id: 2, name: "Essential", type: "teacher", price_egp: 5000,  max_students: 75,  badge: "POPULAR", is_highlighted: true,  features: ["Up to 75 students","All Starter features","AI grading & mentor","Live classes","Question bank","Priority support"] },
  { id: 3, name: "Pro",       type: "teacher", price_egp: 7500,  max_students: 150, badge: null,      is_highlighted: false, features: ["Up to 150 students","All Essential features","SnapGrade AI","Parent portal","Advanced analytics","Custom branding"] },
  { id: 4, name: "Elite",     type: "teacher", price_egp: 10000, max_students: null, badge: null,     is_highlighted: false, features: ["Unlimited students","All Pro features","Dedicated support","Custom integrations","White-label option","SLA guarantee"] },
];

const FALLBACK_STUDENT_PLANS: CMSPlan[] = [
  { id: 5, name: "Basic",   type: "student", price_egp: 0,   max_students: null, badge: null, is_highlighted: false, features: ["Access to assigned lessons","Homework submission","Basic progress tracking"] },
  { id: 6, name: "Learner", type: "student", price_egp: 299, max_students: null, badge: "POPULAR", is_highlighted: true, features: ["All Basic features","AI mentor access","Flashcards & revision","Exam practice vault"] },
  { id: 7, name: "Scholar", type: "student", price_egp: 599, max_students: null, badge: null, is_highlighted: false, features: ["All Learner features","SnapGrade AI grading","Study groups","Parent progress reports","Priority AI responses"] },
];

const FALLBACK_FAQS: CMSFAQ[] = [
  { id: 1, question: "How does attendance work?", answer: "Teachers generate a QR code for each session. Students scan it with their phone to mark themselves present. Teachers can also mark attendance manually. All records are stored and visible in the analytics dashboard.", category: "attendance", order: 1 },
  { id: 2, question: "Can students join multiple courses?", answer: "Yes. Each student can be enrolled in as many courses as they need. Teachers approve enrollment requests. Students can belong to different teachers' courses simultaneously.", category: "courses", order: 2 },
  { id: 3, question: "How are payments approved?", answer: "Students submit an InstaPay reference code as proof of payment. Admins review and approve or reject it. Once approved, the subscription becomes active automatically.", category: "billing", order: 3 },
  { id: 4, question: "Is internet required to use Aperti?", answer: "Most features require an internet connection. However, students can download flashcard decks and revision notes for offline study. Attendance scanning requires the teacher to be online.", category: "access", order: 4 },
  { id: 5, question: "Can teachers manage multiple schools or groups?", answer: "Yes. Teachers can create separate courses for different schools, centers, or private groups. Each course has its own enrollment, attendance, and grade tracking.", category: "teachers", order: 5 },
  { id: 6, question: "How does AI grading work?", answer: "Teachers submit scanned answer sheets or typed student responses. The AI scores answers, identifies errors, and provides written feedback — all in seconds. Teachers review and can override any AI decision.", category: "ai", order: 6 },
  { id: 7, question: "Can parents see their child's progress?", answer: "Yes. Parents link their account to their child's account and get a dedicated dashboard showing attendance, grades, homework completion, and teacher messages.", category: "parents", order: 7 },
  { id: 8, question: "Is Aperti aligned with the IGCSE curriculum?", answer: "Aperti's question bank, flashcard system, and exam practice vault are all structured around IGCSE syllabuses. Teachers can tag content by subject code and topic.", category: "curriculum", order: 8 },
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

/* ─────────────────────────── Get Started Steps ─────────────────────────── */
function GetStartedSteps({ teal }: { teal: string }) {
  const steps = [
    { step: "01", icon: Building2, title: "Create your workspace", desc: "Sign up, name your centre, and configure your subjects in under 3 minutes. No credit card required." },
    { step: "02", icon: Users, title: "Invite your students", desc: "Share a unique join code. Students register instantly and land on their personalised portal." },
    { step: "03", icon: BarChart3, title: "Teach, track & grow", desc: "Assign work, run live sessions, auto-mark quizzes, and watch every student improve in real time." },
  ];
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <section className="py-24 px-5 bg-white" ref={ref}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border mb-5"
            style={{ background: "#E6F4F1", color: teal, borderColor: `${teal}25` }}>
            <Rocket className="h-3 w-3" />Up and running in minutes
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight">
            Three steps to your <span style={{ color: teal }}>first class.</span>
          </h2>
        </div>
        <div className="relative">
          <div className="hidden md:block absolute top-10 left-[16.67%] right-[16.67%] h-0.5 bg-gray-100" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="flex flex-col items-center text-center">
                <div className="relative mb-5">
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-sm"
                    style={{ background: `${teal}10`, border: `2px solid ${teal}20` }}>
                    <s.icon className="h-8 w-8" style={{ color: teal }} />
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full text-xs font-extrabold flex items-center justify-center text-white"
                    style={{ background: teal }}>
                    {s.step.replace("0", "")}
                  </div>
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Step {s.step}</p>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="text-center mt-12">
          <Link href="/register">
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm text-white shadow-lg"
              style={{ background: teal }}>
              Get started free <ArrowRight className="h-4 w-4" />
            </motion.button>
          </Link>
          <p className="text-xs text-gray-400 mt-3">No credit card · Free 30-day trial · Cancel anytime</p>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Comparison Table ─────────────────────────── */
function ComparisonSection({ teal }: { teal: string }) {
  const rows = [
    { feature: "Lesson planning & ContentCraft", aperti: true,  paper: false, sheet: false },
    { feature: "Automated quiz marking",         aperti: true,  paper: false, sheet: false },
    { feature: "Student progress analytics",     aperti: true,  paper: false, sheet: "partial" },
    { feature: "AI revision plan generator",     aperti: true,  paper: false, sheet: false },
    { feature: "Flashcard system (ECHO)",        aperti: true,  paper: false, sheet: false },
    { feature: "AI question extraction",         aperti: true,  paper: false, sheet: false },
    { feature: "Parent portal & notifications",  aperti: true,  paper: false, sheet: false },
    { feature: "Live session tools",             aperti: true,  paper: false, sheet: false },
    { feature: "Past paper library",             aperti: true,  paper: "partial", sheet: false },
    { feature: "Mobile & tablet access",         aperti: true,  paper: "partial", sheet: "partial" },
    { feature: "Invoicing & payments",           aperti: true,  paper: false, sheet: "partial" },
    { feature: "AI mentor 24/7",                 aperti: true,  paper: false, sheet: false },
  ];

  const Cell = ({ val }: { val: boolean | "partial" }) => (
    <td className="py-3 px-4 text-center">
      {val === true  ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-teal-100"><Check size={13} style={{ color: teal }} strokeWidth={3} /></span>
       : val === "partial" ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100"><Minus size={13} className="text-amber-600" strokeWidth={3} /></span>
       : <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100"><X size={13} className="text-gray-300" strokeWidth={3} /></span>}
    </td>
  );

  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <section className="py-24 px-5" style={{ background: "#F5F5F5" }} ref={ref}>
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} className="text-center mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border mb-5"
            style={{ background: "#E6F4F1", color: teal, borderColor: `${teal}25` }}>
            <Building2 className="h-3 w-3" />Why Aperti?
          </span>
          <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">
            Replace the <span className="line-through text-gray-400">spreadsheets</span>{" "}
            and <span style={{ color: teal }}>the chaos.</span>
          </h2>
          <p className="text-gray-500 mt-3 max-w-lg mx-auto text-sm">Everything that used to live in five different tools — now in one.</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-4 px-4 text-left text-sm font-semibold text-gray-600 w-1/2">Feature</th>
                <th className="py-4 px-4 text-center text-sm font-bold w-[16.67%]" style={{ color: teal }}>
                  Aperti
                </th>
                <th className="py-4 px-4 text-center text-xs font-semibold text-gray-400 w-[16.67%]">Pen & paper</th>
                <th className="py-4 px-4 text-center text-xs font-semibold text-gray-400 w-[16.67%]">Spreadsheet</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <motion.tr key={i}
                  initial={{ opacity: 0, x: -8 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.2 + i * 0.04 }}
                  className={`border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                  <td className="py-3 px-4 text-sm text-gray-700">{row.feature}</td>
                  <Cell val={row.aperti as boolean | "partial"} />
                  <Cell val={row.paper as boolean | "partial"} />
                  <Cell val={row.sheet as boolean | "partial"} />
                </motion.tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-teal-100 inline-flex items-center justify-center"><Check size={9} style={{ color: teal }} /></span>Full support</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-amber-100 inline-flex items-center justify-center"><Minus size={9} className="text-amber-600" /></span>Partial / workaround</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-gray-100 inline-flex items-center justify-center"><X size={9} className="text-gray-300" /></span>Not available</span>
          </div>
        </motion.div>
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
function EarlyAccessForm({ ctaText, email, dark = false }: { ctaText?: string; email?: string; dark?: boolean }) {
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

  const cardBg = dark ? "rgba(255,255,255,0.06)" : "white";
  const cardBorder = dark ? "rgba(255,255,255,0.12)" : "#f0f0f0";
  const labelColor = dark ? "rgba(255,255,255,0.5)" : "#4B5563";
  const inputBg = dark ? "rgba(255,255,255,0.06)" : "#F9FAFB";
  const inputBorder = dark ? "rgba(255,255,255,0.12)" : "#E5E7EB";
  const inputColor = dark ? "rgba(255,255,255,0.85)" : "#111827";

  if (submitted) return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl p-10 text-center max-w-lg mx-auto"
      style={{ background: cardBg, border: `1px solid ${cardBorder}`, backdropFilter: "blur(12px)" }}>
      <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: `${TEAL}20` }}>
        <CheckCircle2 className="h-7 w-7" style={{ color: TEAL }} />
      </div>
      <h3 className="text-xl font-extrabold mb-2" style={{ color: dark ? "#ffffff" : "#111827" }}>Application received!</h3>
      <p className="text-sm" style={{ color: dark ? "rgba(255,255,255,0.5)" : "#6B7280" }}>
        We will personally reach out within 48 hours to set up your workspace.
      </p>
    </motion.div>
  );

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl p-8 max-w-lg mx-auto"
      style={{ background: cardBg, border: `1px solid ${cardBorder}`, backdropFilter: dark ? "blur(16px)" : "none", boxShadow: dark ? "0 24px 64px rgba(0,0,0,0.3)" : "0 4px 24px rgba(0,0,0,0.06)" }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {[
          { key: "name", label: "Full Name *", placeholder: "Dr. Ahmed Hassan", type: "text", required: true },
          { key: "email", label: "Email Address *", placeholder: "you@school.com", type: "email", required: true },
          { key: "students", label: "Estimated Students", placeholder: "e.g. 60", type: "text", required: false },
          { key: "subjects", label: "Subjects Taught", placeholder: "Physics, Math…", type: "text", required: false },
        ].map(field => (
          <div key={field.key}>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: labelColor }}>{field.label}</label>
            <input required={field.required} type={field.type} value={form[field.key as keyof typeof form]}
              onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 transition-all"
              style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: inputColor }}
              placeholder={field.placeholder} />
          </div>
        ))}
      </div>
      <div className="mb-5">
        <label className="block text-xs font-semibold mb-1.5" style={{ color: labelColor }}>Tell us about your school</label>
        <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={3}
          className="w-full px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 resize-none transition-all"
          style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: inputColor }}
          placeholder="Tell us about your teaching setup, current challenges, and what you hope Aperti can do for your students…" />
      </div>
      <button type="submit" disabled={loading}
        className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 flex items-center justify-center gap-2"
        style={{ background: `linear-gradient(135deg, ${TEAL}, #00897B)`, boxShadow: `0 8px 24px ${TEAL}35` }}>
        {loading
          ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting…</>
          : <>{ctaText ?? "Get Started Free"} <ArrowRight className="h-4 w-4" /></>}
      </button>
      {email && (
        <p className="text-center text-xs mt-4" style={{ color: dark ? "rgba(255,255,255,0.3)" : "#9CA3AF" }}>
          Or email us at <a href={`mailto:${email}`} className="underline" style={{ color: TEAL }}>{email}</a>
        </p>
      )}
    </form>
  );
}

/* ─────────────────────────── Anime Hero Title ─────────────────────────── */
function AnimeHeroTitle({ headline, headlineAccent, teal, dark = false }: {
  headline: string; headlineAccent: string; teal: string; dark?: boolean;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (prefersReduced || !titleRef.current) return;
    const spans = titleRef.current.querySelectorAll<HTMLElement>(".word-span");
    spans.forEach(s => { s.style.opacity = "0"; s.style.transform = "translateY(28px)"; });
    animeAnimate(spans, {
      opacity: [0, 1],
      translateY: [28, 0],
      delay: animeStagger(55),
      duration: 800,
      ease: "outExpo",
    });
  }, [headline, headlineAccent, prefersReduced]);

  const headlineWords = headline.split(" ");
  const accentWords = headlineAccent.split(" ");

  return (
    <h1 ref={titleRef}
      className="text-5xl md:text-6xl lg:text-[68px] font-black leading-[1.04] tracking-tight mb-6"
      style={{ color: dark ? "#ffffff" : "#121212" }}>
      {headlineWords.map((word, i) => (
        <span key={i} className="word-span inline-block" style={{ marginRight: "0.25em" }}>
          {word}
        </span>
      ))}
      <br />
      {accentWords.map((word, i) => (
        <span key={i} className="word-span inline-block" style={{ color: teal, marginRight: "0.25em" }}>
          {word}
        </span>
      ))}
    </h1>
  );
}

/* ─────────────────────────── Anime Feature Grid ─────────────────────────── */
function AnimeFeatureGrid({ features, teal }: {
  features: Array<{ icon: string; title: string; description: string }>;
  teal: string;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);
  const prefersReduced = useReducedMotion();
  const cols = features.length <= 3 ? "lg:grid-cols-3"
    : features.length === 4 ? "lg:grid-cols-4"
    : features.length === 5 ? "lg:grid-cols-5"
    : "lg:grid-cols-3";

  useEffect(() => {
    if (prefersReduced || !gridRef.current) return;
    const el = gridRef.current;
    const cards = el.querySelectorAll<HTMLElement>(".anim-feature-card");
    cards.forEach(c => { c.style.opacity = "0"; c.style.transform = "rotateX(55deg) translateZ(-70px) translateY(30px)"; });
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !hasAnimated.current) {
        hasAnimated.current = true;
        observer.disconnect();
        animeAnimate(cards, {
          opacity: [0, 1],
          rotateX: ['55deg', '0deg'],
          translateZ: ['-70px', '0px'],
          translateY: [30, 0],
          delay: animeStagger(80),
          duration: 850,
          ease: "outExpo",
        });
      }
    }, { threshold: 0.08 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [features, prefersReduced]);

  return (
    <div ref={gridRef} className={`grid-perspective grid grid-cols-1 sm:grid-cols-2 gap-5 ${cols}`}>
      {features.map((f, i) => {
        const Icon = getIcon(f.icon);
        return (
          <div key={i} className="anim-feature-card"
            style={{ opacity: prefersReduced ? 1 : 0 }}>
            <Feature3DTiltCard teal={teal} Icon={Icon} title={f.title} description={f.description} index={i} />
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── Anime Pricing Stagger ─────────────────────────── */
function AnimePricingGrid({ plans, teal, isStudent }: {
  plans: CMSPlan[]; teal: string; isStudent: boolean;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);
  const prefersReduced = useReducedMotion();
  const cols = plans.length >= 4 ? "lg:grid-cols-4" : plans.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";

  useEffect(() => {
    hasAnimated.current = false;
  }, [isStudent]);

  useEffect(() => {
    if (prefersReduced || !gridRef.current) return;
    const el = gridRef.current;
    const cards = el.querySelectorAll<HTMLElement>(".anim-pricing-card");
    cards.forEach(c => { c.style.opacity = "0"; c.style.transform = "rotateX(40deg) translateZ(-60px) translateY(24px)"; });
    if (hasAnimated.current) return;
    hasAnimated.current = true;
    requestAnimationFrame(() => {
      animeAnimate(cards, {
        opacity: [0, 1],
        rotateX: ['40deg', '0deg'],
        translateZ: ['-60px', '0px'],
        translateY: [24, 0],
        delay: animeStagger(70),
        duration: 750,
        ease: "outExpo",
      });
    });
  }, [plans, prefersReduced]);

  return (
    <div ref={gridRef} className={`grid-perspective grid grid-cols-1 sm:grid-cols-2 ${cols} gap-6 mt-8`}>
      {plans.map((p, i) => (
        <div key={p.id} className="anim-pricing-card" style={{ opacity: prefersReduced ? 1 : 0 }}>
          <CMSPricingCard plan={p} colorIdx={i} isStudent={isStudent} />
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────── Anime 3D Steps ─────────────────────────── */
function Anime3DSteps({ teal }: { teal: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (prefersReduced || !containerRef.current) return;
    const el = containerRef.current;
    const cards = el.querySelectorAll<HTMLElement>('.step-3d');
    cards.forEach(c => {
      c.style.opacity = '0';
      c.style.transform = 'rotateY(65deg) translateZ(-90px)';
    });
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !hasAnimated.current) {
        hasAnimated.current = true;
        observer.disconnect();
        animeAnimate(cards, {
          opacity: [0, 1],
          rotateY: ['65deg', '0deg'],
          translateZ: ['-90px', '0px'],
          delay: animeStagger(130),
          duration: 950,
          ease: 'outExpo',
        });
      }
    }, { threshold: 0.15 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [prefersReduced]);

  const STEPS = [
    { step: "01", title: "Create your workspace", desc: "Sign up in minutes. Configure subjects and invite students — no setup fees, no waiting.", icon: Shield },
    { step: "02", title: "Invite students & parents", desc: "Students register and select you as teacher. Parents link via secure pairing code. Approve with one click.", icon: Users },
    { step: "03", title: "Teach, assess, analyse", desc: "Deliver courses, auto-grade exams, and watch real-time analytics tell you exactly which student needs help.", icon: BarChart3 },
  ];

  return (
    <div ref={containerRef} className="grid-perspective grid grid-cols-1 md:grid-cols-3 gap-6 relative">
      <div className="hidden md:block absolute top-12 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px"
        style={{ background: `linear-gradient(to right, ${teal}30, ${teal}60, ${teal}30)` }} />
      {STEPS.map((item) => (
        <motion.div key={item.step} className="step-3d bg-white rounded-2xl p-7 border border-gray-100 shadow-sm relative text-center"
          whileHover={{ y: -8, boxShadow: `0 24px 48px ${teal}14`, transition: { duration: 0.2 } }}
          style={{ opacity: prefersReduced ? 1 : 0 }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 relative"
            style={{ background: `${teal}12` }}>
            <item.icon className="h-6 w-6" style={{ color: teal }} />
            <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white"
              style={{ background: teal }}>
              {item.step.replace("0", "")}
            </span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-3">{item.title}</h3>
          <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
        </motion.div>
      ))}
    </div>
  );
}

/* ─────────────────────────── ICON MAP ─────────────────────────── */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Brain, BarChart3, Video, Shield, Zap, BookOpen, Target, Users, Globe, Star, CheckCircle2, Rocket, Map, FileText, Activity,
};
const getIcon = (name?: string) => ICON_MAP[name ?? ""] ?? Zap;

/* ─────────────────────────── LIVE DASHBOARD PREVIEW ─────────────────────────── */
const DASHBOARD_SLIDES = [
  {
    role: "Teacher",
    label: "For Teachers",
    color: "#0D9488",
    badge: "CoreHub",
    title: "Your class at a glance",
    widgets: [
      { title: "Active Students", value: "34", sub: "2 need attention", icon: Users, color: "#0D9488", bg: "#E6F4F1" },
      { title: "Avg. Score", value: "78%", sub: "↑ 6% this week", icon: BarChart3, color: "#7C3AED", bg: "#F3F0FF" },
      { title: "Homework Rate", value: "91%", sub: "29/32 submitted", icon: CheckCircle2, color: "#059669", bg: "#D1FAE5" },
    ],
    list: ["Maya Hassan — needs help with Forces", "Ahmed Karim — excellent progress", "Lena Wolff — attendance drop"],
  },
  {
    role: "Student",
    label: "For Students",
    color: "#7C3AED",
    badge: "StudyStream",
    title: "Your study session",
    widgets: [
      { title: "Today's Tasks", value: "4", sub: "2 completed", icon: CheckCircle2, color: "#0D9488", bg: "#E6F4F1" },
      { title: "Streak", value: "12 days", sub: "Keep it up!", icon: Zap, color: "#DC2626", bg: "#FEF2F2" },
      { title: "Next Exam", value: "6 days", sub: "Physics Paper 2", icon: Target, color: "#D97706", bg: "#FEF3C7" },
    ],
    list: ["Flashcards: Organic Chemistry (15 cards due)", "Practice: Forces & Motion — 12 questions", "Mentor session booked for 4:00 PM"],
  },
  {
    role: "Parent",
    label: "For Parents",
    color: "#D97706",
    badge: "GuardianHub",
    title: "Zara's progress this week",
    widgets: [
      { title: "Attendance", value: "100%", sub: "All sessions attended", icon: Shield, color: "#059669", bg: "#D1FAE5" },
      { title: "Last Exam", value: "84%", sub: "Chemistry: Atoms", icon: Star, color: "#7C3AED", bg: "#F3F0FF" },
      { title: "Homework", value: "8/9", sub: "1 overdue", icon: BookOpen, color: "#D97706", bg: "#FEF3C7" },
    ],
    list: ["Teacher message: 'Excellent focus this week'", "Upcoming: Maths exam in 3 days", "New grade posted: Biology Lab report 91%"],
  },
  {
    role: "Admin",
    label: "For Admins",
    color: "#DC2626",
    badge: "CommandCenter",
    title: "Centre operations",
    widgets: [
      { title: "Total Students", value: "248", sub: "↑ 12 this month", icon: Users, color: "#0D9488", bg: "#E6F4F1" },
      { title: "Revenue", value: "EGP 42K", sub: "On track for target", icon: BarChart3, color: "#DC2626", bg: "#FEF2F2" },
      { title: "AI Usage", value: "3.2K", sub: "queries this week", icon: Brain, color: "#7C3AED", bg: "#F3F0FF" },
    ],
    list: ["3 new teacher applications pending", "Subscription renewals: 8 due this week", "System health: All services nominal"],
  },
];

function LiveDashboardPreview() {
  const [active, setActive] = useState(0);
  // NOTE: Values shown below are illustrative demo previews — not real user data.
  // Live platform stats (student count, teacher count, etc.) are fetched from /api/landing/stats.
  const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (prefersReduced) return;
    const id = setInterval(() => setActive(a => (a + 1) % DASHBOARD_SLIDES.length), 3200);
    return () => clearInterval(id);
  }, [prefersReduced]);

  const slide = DASHBOARD_SLIDES[active];

  return (
    <div className="relative w-full max-w-[440px] mx-auto select-none">
      {/* Browser chrome */}
      <div className="rounded-2xl shadow-2xl overflow-hidden border border-gray-200/70" style={{ background: "#F8FAFC" }}>
        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200/60" style={{ background: "#fff" }}>
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
          <div className="flex-1 mx-3 h-5 rounded-full bg-gray-100 flex items-center px-3">
            <span className="text-[9px] text-gray-400 font-mono">app.aperti.ai</span>
          </div>
        </div>

        {/* Dashboard body */}
        <div className="p-4 min-h-[280px]">
          <AnimatePresence mode="wait">
            <motion.div key={active}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}>
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: `${slide.color}15`, color: slide.color }}>
                    {slide.badge}
                  </span>
                  <p className="text-xs font-bold text-gray-800 mt-1">{slide.title}</p>
                </div>
                <span className="text-[9px] text-gray-400">{new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
              </div>
              {/* Widgets row */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {slide.widgets.map((w, i) => (
                  <motion.div key={i} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.07 }}
                    className="rounded-xl p-2.5" style={{ background: w.bg }}>
                    <w.icon className="h-3.5 w-3.5 mb-1.5" style={{ color: w.color }} />
                    <p className="text-sm font-black" style={{ color: w.color }}>{w.value}</p>
                    <p className="text-[8px] text-gray-500 leading-tight mt-0.5">{w.title}</p>
                    <p className="text-[7px] text-gray-400 leading-tight">{w.sub}</p>
                  </motion.div>
                ))}
              </div>
              {/* List items */}
              <div className="space-y-1.5">
                {slide.list.map((item, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.06 }}
                    className="flex items-start gap-2 text-[9px] text-gray-600 bg-white rounded-lg px-2.5 py-1.5">
                    <span className="w-1 h-1 rounded-full mt-1 shrink-0" style={{ background: slide.color }} />
                    {item}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Role tabs at bottom */}
        <div className="flex border-t border-gray-200/60" style={{ background: "#fff" }}>
          {DASHBOARD_SLIDES.map((s, i) => (
            <button key={i} onClick={() => setActive(i)}
              className="flex-1 py-2 text-[9px] font-semibold transition-all"
              style={{ color: i === active ? s.color : "#9CA3AF", borderTop: i === active ? `2px solid ${s.color}` : "2px solid transparent" }}>
              {s.role}
            </button>
          ))}
        </div>
      </div>

      {/* Demo label */}
      <div className="absolute -bottom-6 left-0 right-0 flex justify-center">
        <span className="text-[9px] text-gray-400 bg-white/80 border border-gray-200 rounded-full px-2 py-0.5">
          Illustrative preview · Live data shown on your actual dashboard
        </span>
      </div>

      {/* Glow */}
      <div className="absolute -inset-4 -z-10 rounded-3xl opacity-20 blur-2xl"
        style={{ background: `radial-gradient(circle, ${slide.color}50, transparent 70%)` }} />
    </div>
  );
}

/* ─────────────────────────── INTERACTIVE DEMO ─────────────────────────── */
const DEMO_STEPS = [
  {
    role: "Teacher",
    icon: GraduationCap,
    color: "#0D9488",
    step: "Create an assessment",
    desc: "Choose your question bank, set a time limit, and publish. Students receive it instantly.",
    visual: { title: "New Assessment", items: ["Topic: Forces & Motion", "Questions: 12 (auto-selected)", "Time limit: 45 min", "Due: Tomorrow 5 PM"] },
  },
  {
    role: "Student",
    icon: Brain,
    color: "#7C3AED",
    step: "Receive & attempt",
    desc: "Students open their ExamRoom, complete timed questions, and submit — all from any device.",
    visual: { title: "Forces & Motion Quiz", items: ["Q4 of 12 — Multiple Choice", "Calculate the net force on a 5kg block…", "Option A: 10N ● Option B: 25N ○", "Time remaining: 28:14"] },
  },
  {
    role: "AI",
    icon: Zap,
    color: "#DC2626",
    step: "Auto-graded instantly",
    desc: "Aperti grades structured questions in seconds, flags edge cases for teacher review, and updates the gradebook.",
    visual: { title: "Grading complete", items: ["Graded: 32/34 students", "Auto: 29 • Review flagged: 3", "Class avg: 74%", "Weak area: Newton's 3rd Law"] },
  },
  {
    role: "Analytics",
    icon: BarChart3,
    color: "#D97706",
    step: "Act on insights",
    desc: "The AI Mentor automatically creates personalised revision packs for each student based on their errors.",
    visual: { title: "Mentor action taken", items: ["12 students: weak on Forces", "Revision pack sent to each", "Next session: re-test in 7 days", "Parent notifications: sent"] },
  },
];

function InteractiveDemo({ teal }: { teal: string }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const step = DEMO_STEPS[active];

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setActive(a => (a + 1) % DEMO_STEPS.length), 3500);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <section className="py-24 px-5 bg-white">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border mb-5"
              style={{ background: TEAL_LIGHT, color: teal, borderColor: `${teal}25` }}>
              <Activity className="h-3 w-3" />See it in action
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
              From lesson to insight<br />
              <span style={{ color: teal }}>in four steps.</span>
            </h2>
            <p className="text-gray-500 max-w-md mx-auto">The complete teaching cycle — from setting work to acting on results — happens entirely inside Aperti.</p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}>

          {/* Step selector */}
          <div className="space-y-2.5">
            {DEMO_STEPS.map((s, i) => (
              <motion.button key={i} onClick={() => setActive(i)}
                className="w-full text-left rounded-2xl p-5 border-2 transition-all relative overflow-hidden"
                style={{
                  borderColor: i === active ? `${s.color}35` : "#F3F4F6",
                  background: i === active ? `${s.color}05` : "white",
                }}>
                {i === active && (
                  <motion.div
                    className="absolute bottom-0 left-0 h-0.5 rounded-full"
                    style={{ background: s.color }}
                    initial={{ width: "0%" }}
                    animate={{ width: paused ? "current" : "100%" }}
                    transition={{ duration: 3.5, ease: "linear" }}
                  />
                )}
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all"
                    style={{ background: i === active ? `${s.color}15` : `${s.color}08` }}>
                    <s.icon className="h-5 w-5" style={{ color: s.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold rounded-full px-2 py-0.5"
                        style={{ background: `${s.color}12`, color: s.color }}>{s.role}</span>
                      <span className="text-sm font-bold text-gray-800">{s.step}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
                  </div>
                  {i === active && (
                    <div className="w-2 h-2 rounded-full shrink-0 mt-1"
                      style={{ background: s.color }} />
                  )}
                </div>
              </motion.button>
            ))}
          </div>

          {/* Visual mockup */}
          <AnimatePresence mode="wait">
            <motion.div key={active}
              initial={{ opacity: 0, x: 20, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.97 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col"
              style={{ boxShadow: `0 20px 60px ${step.color}14, 0 4px 20px rgba(0,0,0,0.06)` }}>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3"
                style={{ background: `linear-gradient(135deg, ${step.color}08, ${step.color}04)` }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${step.color}15` }}>
                  <step.icon className="h-4 w-4" style={{ color: step.color }} />
                </div>
                <div>
                  <span className="text-sm font-bold text-gray-800">{step.visual.title}</span>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: step.color }} />
                  <span className="text-[10px] font-bold" style={{ color: step.color }}>Live</span>
                </div>
              </div>
              <div className="p-5 space-y-3 flex-1">
                {step.visual.items.map((item, i) => (
                  <motion.div key={`${active}-${i}`}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.3 }}
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{ background: `${step.color}06`, border: `1px solid ${step.color}12` }}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: step.color }} />
                    <span className="text-sm text-gray-700 font-medium">{item}</span>
                  </motion.div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between">
                <span className="text-[10px] text-gray-400">Step {active + 1} of {DEMO_STEPS.length}</span>
                <div className="flex gap-1.5">
                  {DEMO_STEPS.map((s, i) => (
                    <button key={i} onClick={() => setActive(i)}
                      className="rounded-full transition-all"
                      style={{ width: i === active ? 20 : 6, height: 6, background: i === active ? step.color : "#E5E7EB" }} />
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── Pricing Visual ─────────────────────────── */
const PRICING_STATS = [
  { value: "5×", label: "Faster grading", icon: Zap },
  { value: "40%", label: "More retention", icon: Target },
  { value: "24/7", label: "AI mentor", icon: Brain },
];

function PricingVisual({ teal }: { teal: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <div ref={ref} className="mt-12 overflow-hidden rounded-2xl relative" style={{
      background: "linear-gradient(135deg, #0D9488 0%, #0F766E 40%, #0C4A6E 100%)",
      minHeight: 200,
    }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.1)",
            width: 80 + i * 70,
            height: 80 + i * 70,
            top: "50%", left: i % 2 === 0 ? "-5%" : "auto",
            right: i % 2 !== 0 ? "-5%" : "auto",
            transform: "translateY(-50%)",
            animation: `glowRing ${8 + i * 1.5}s ease-in-out ${i * 0.5}s infinite`,
          }} />
        ))}
        <svg className="absolute inset-0 w-full h-full opacity-10">
          <defs>
            <pattern id="p-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#p-dots)" />
        </svg>
        <style>{`
          @keyframes glowRing { 0%,100%{opacity:0.08} 50%{opacity:0.18} }
          @keyframes statFloat { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-5px)} }
        `}</style>
      </div>

      <div className="relative px-8 py-10">
        <div className="text-center mb-8">
          <motion.h3
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-2xl md:text-3xl font-extrabold text-white mb-2 tracking-tight">
            Everything you need.<br />
            <span className="text-white/70">From day one.</span>
          </motion.h3>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-white/60 text-sm max-w-md mx-auto">
            Every plan includes the full Aperti platform — not a trimmed-down version.
          </motion.p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {PRICING_STATS.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-xl p-5 text-center backdrop-blur-sm"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.15)",
                animation: `statFloat ${4 + i * 0.6}s ease-in-out ${i * 0.4}s infinite`,
              }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{ background: "rgba(255,255,255,0.15)" }}>
                <s.icon className="h-4 w-4 text-white" />
              </div>
              <p className="text-2xl font-black text-white mb-0.5">{s.value}</p>
              <p className="text-[11px] text-white/60 font-medium">{s.label}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.55 }}
          className="flex flex-wrap items-center justify-center gap-4 mt-8">
          {["No lock-in contract", "InstaPay accepted", "Free onboarding call", "Cancel any time"].map((badge, i) => (
            <span key={i} className="flex items-center gap-1.5 text-xs text-white/70">
              <CheckCircle2 className="h-3.5 w-3.5 text-white/50" />
              {badge}
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Pricing Section ─────────────────────────── */
function PricingSection({ teal, teacherPlans, studentPlans, pricingHeadline, pricingAccent, contactEmail }: {
  teal: string; teacherPlans: CMSPlan[]; studentPlans: CMSPlan[];
  pricingHeadline: string; pricingAccent: string; contactEmail: string;
}) {
  const [tab, setTab] = useState<"teacher" | "student">("teacher");
  const activePlans = tab === "teacher" ? teacherPlans : studentPlans;
  const isStudent = tab === "student";
  const cols = activePlans.length >= 4 ? "lg:grid-cols-4" : activePlans.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";

  return (
    <section id="pricing" className="py-24 px-5 bg-white">
      <div className="max-w-7xl mx-auto">
        <Reveal>
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border mb-5"
              style={{ background: TEAL_LIGHT, color: teal, borderColor: `${teal}25` }}>
              Transparent Pricing
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
              {pricingHeadline}{pricingAccent && <> <span style={{ color: teal }}>{pricingAccent}</span></>}
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto mb-8">
              Simple, transparent pricing in EGP — no lock-in, no surprise invoices. InstaPay accepted.
            </p>
            {/* Tab toggle */}
            <div className="inline-flex items-center rounded-xl border border-gray-200 p-1 bg-gray-50 gap-1">
              {(["teacher", "student"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className="px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
                  style={{
                    background: tab === t ? teal : "transparent",
                    color: tab === t ? "white" : "#6B7280",
                    boxShadow: tab === t ? `0 2px 8px ${teal}30` : "none",
                  }}>
                  {t === "teacher" ? "For Teachers" : "For Students"}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            <AnimePricingGrid plans={activePlans} teal={teal} isStudent={isStudent} />
          </motion.div>
        </AnimatePresence>

        {tab === "teacher" && <PricingVisual teal={teal} />}

        <Reveal delay={0.4}>
          <p className="text-center text-sm text-gray-400 mt-8">
            Volume discounts available for large centres.{" "}
            <a href={`mailto:${contactEmail}`} className="underline underline-offset-2 font-medium" style={{ color: teal }}>
              Talk to us for custom pricing.
            </a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────── MAIN LANDING ─────────────────────────── */
export default function Landing() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container: scrollContainerRef });
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -40]);
  const { data: cms } = useLandingCMS();

  const sections = cms?.sections ?? [];
  const testimonials = cms?.testimonials ?? [];
  const faqs = (cms?.faqs?.length ? cms.faqs : FALLBACK_FAQS) as CMSFAQ[];
  const allPlans: CMSPlan[] = cms?.plans ?? [];
  const teacherPlans: CMSPlan[] = useMemo(() => {
    const t = allPlans.filter(p => !p.type || p.type === "teacher");
    return t.length > 0 ? t : FALLBACK_TEACHER_PLANS;
  }, [allPlans]);
  const studentPlans: CMSPlan[] = useMemo(() => {
    const s = allPlans.filter(p => p.type === "student");
    return s.length > 0 ? s : FALLBACK_STUDENT_PLANS;
  }, [allPlans]);
  const teal = cms?.branding?.primary_color ?? TEAL;

  const hero     = getSection(sections, "hero");
  const featureS = getSection(sections, "features");
  const statsS   = getSection(sections, "statistics");
  const pricingS = getSection(sections, "pricing");
  const contactS = getSection(sections, "contact");

  const headline       = (hero.headline as string)         ?? "The platform IGCSE tutors";
  const headlineAccent = (hero.headline_accent as string)  ?? "trust to run their class.";
  const subheadline    = (hero.subheadline as string)      ?? "Attendance, grading, AI feedback, parent updates, and student analytics — all in one place. Built for Egyptian IGCSE educators.";
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
  const contactCta      = (contactS.cta_text as string) ?? "Get Started Free";
  const contactEmail    = (contactS.email as string)    ?? "support@aperti.ai";

  return (
    <div ref={scrollContainerRef} className="font-sans landing-scroll" style={{ color: "#121212", background: "#F5F5F5" }}>
      <Nav />

      {/* ── HERO ── */}
      <section className="snap-start min-h-screen flex items-center pt-20 pb-10 px-5 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #060D1B 0%, #091525 55%, #0D1F2D 100%)" }}>

        {/* Fullscreen 3D animated background */}
        <Landing3DHeroCanvas />

        {/* Subtle dark gradient overlay for text readability */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to right, rgba(6,13,27,0.85) 0%, rgba(6,13,27,0.55) 55%, rgba(6,13,27,0.2) 100%)" }} />

        {/* Teal glow blobs */}
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${teal}18 0%, transparent 70%)`, filter: "blur(40px)" }} />
        <div className="absolute -bottom-24 -left-24 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${teal}10 0%, transparent 70%)`, filter: "blur(60px)" }} />

        <div className="max-w-7xl mx-auto w-full relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.9, ease: [0.22,1,0.36,1] }}>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold mb-7 border"
                style={{ background: `${teal}18`, color: teal, borderColor: `${teal}40` }}>
                <Sparkles className="h-3 w-3" />
                {badgeText}
              </motion.div>
              <AnimeHeroTitle headline={headline} headlineAccent={headlineAccent} teal={teal} dark />
              <motion.p
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                className="text-lg leading-relaxed mb-9 max-w-xl"
                style={{ color: "rgba(255,255,255,0.65)" }}>
                {subheadline}
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
                className="flex flex-wrap gap-3 mb-8">
                <Link href="/register">
                  <motion.button whileHover={{ scale: 1.03, boxShadow: `0 12px 36px ${teal}50` }} whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm text-white shadow-xl transition-shadow"
                    style={{ background: `linear-gradient(135deg, ${teal}, #00897B)`, boxShadow: `0 8px 28px ${teal}40` }}>
                    Get Started Free <ArrowRight className="h-4 w-4" />
                  </motion.button>
                </Link>
                <a href="#how-it-works">
                  <motion.button whileHover={{ scale: 1.02, background: "rgba(255,255,255,0.1)" }} whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.15)" }}>
                    See How It Works
                  </motion.button>
                </a>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {[
                  { icon: Shield,       label: "No lock-in"          },
                  { icon: Zap,          label: "Up in minutes"        },
                  { icon: CheckCircle2, label: "IGCSE & IB ready"     },
                  { icon: Star,         label: "AI-powered grading"   },
                ].map(({ icon: Icon, label }) => (
                  <span key={label} className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: `${teal}cc` }} />
                    {label}
                  </span>
                ))}
              </motion.div>
            </motion.div>

            <motion.div style={{ y: heroY }} initial={{ opacity: 0, x: 40, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 1, delay: 0.25, ease: [0.22,1,0.36,1] }}
              className="relative hidden lg:block">
              {/* Glow ring behind the preview */}
              <div className="absolute inset-0 -m-8 rounded-3xl pointer-events-none"
                style={{ background: `radial-gradient(ellipse at center, ${teal}20 0%, transparent 70%)`, filter: "blur(20px)" }} />
              <div className="relative" style={{ filter: "drop-shadow(0 32px 64px rgba(0,0,0,0.5))" }}>
                <LiveDashboardPreview />
              </div>
            </motion.div>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="scroll-cue absolute bottom-8 left-1/2 flex flex-col items-center gap-1.5 z-10">
          <div className="w-5 h-8 rounded-full flex items-start justify-center pt-1.5"
            style={{ border: "1.5px solid rgba(255,255,255,0.2)" }}>
            <motion.div className="w-1.5 h-2 rounded-full" style={{ background: teal }}
              animate={{ y: [0, 8, 0], opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
          </div>
        </div>
      </section>

      {/* ── MARQUEE STRIP ── */}
      <MarqueeStrip />

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="snap-start min-h-screen flex items-center py-20 px-5" style={{ background: "#F5F5F5" }}>
        <div className="max-w-7xl mx-auto w-full">
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
          <Anime3DSteps teal={teal} />
          <Reveal delay={0.5}>
            <div className="text-center mt-12">
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

      {/* ── FEATURES ── */}
      <section id="features" className="snap-start min-h-screen flex items-center py-16 px-5 bg-white">
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
          <AnimeFeatureGrid features={displayFeatures} teal={teal} />
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

      {/* ── INTERACTIVE DEMO ── */}
      <div className="snap-start">
        <InteractiveDemo teal={teal} />
      </div>

      {/* ── STATS STRIP ── */}
      <div className="snap-start">
        <StatsStrip cmsStats={statItems} />
      </div>

      {/* ── TESTIMONIALS (CMS-driven) ── */}
      <TestimonialsSection testimonials={testimonials} />

      {/* ── PRICING ── */}
      <div className="snap-start">
      <PricingSection
        teal={teal}
        teacherPlans={teacherPlans}
        studentPlans={studentPlans}
        pricingHeadline={pricingHeadline}
        pricingAccent={pricingAccent}
        contactEmail={contactEmail}
      />
      </div>

      {/* ── COMPARISON TABLE ── */}
      <ComparisonSection teal={teal} />

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
      <section id="apply" className="snap-start min-h-screen flex items-center py-20 px-5 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #060D1B 0%, #091525 55%, #0D1F2D 100%)" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: `linear-gradient(${teal}06 1px, transparent 1px), linear-gradient(90deg, ${teal}06 1px, transparent 1px)`, backgroundSize: "80px 80px" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${teal}18 0%, transparent 65%)`, filter: "blur(60px)" }} />
        <div className="max-w-3xl mx-auto text-center w-full relative z-10">
          <Reveal>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold mb-8 border"
              style={{ background: `${teal}18`, color: teal, borderColor: `${teal}40` }}>
              <Rocket className="h-3 w-3" />
              Join the platform now — it's free to start
            </motion.div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-6 leading-[1.06]"
              style={{ color: "#ffffff" }}>
              {contactHeadline || "Your classroom."}<br />
              <span style={{ color: teal }}>Transformed.</span>
            </h2>
            <p className="max-w-lg mx-auto text-lg leading-relaxed mb-10"
              style={{ color: "rgba(255,255,255,0.55)" }}>
              Create your workspace, invite your students, and run your first class — all in one place. No setup fee. No lock-in.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <EarlyAccessForm ctaText={contactCta} email={contactEmail} dark />
          </Reveal>
          <Reveal delay={0.3}>
            <div className="flex flex-wrap items-center justify-center gap-5 mt-10">
              {[
                { icon: Shield, label: "No credit card required" },
                { icon: Zap, label: "Live in under 5 minutes" },
                { icon: CheckCircle2, label: "Cancel anytime" },
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="flex items-center gap-1.5 text-sm"
                  style={{ color: "rgba(255,255,255,0.4)" }}>
                  <Icon className="h-4 w-4" style={{ color: `${teal}cc` }} />
                  {label}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-16 px-5 relative overflow-hidden"
        style={{ background: "#0A0F1A", borderTop: `1px solid ${teal}15` }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-14">

            {/* Brand */}
            <div className="lg:col-span-1">
              <p className="text-xl font-extrabold mb-3" style={{ color: "#ffffff" }}>
                Aperti<span style={{ color: teal }}>.</span>
              </p>
              <p className="text-sm leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.4)" }}>
                The educational operating system for modern IGCSE educators. AI-powered, built for Egypt.
              </p>
              <Link href="/register">
                <button className="text-sm font-bold px-5 py-2.5 rounded-xl text-white transition-all hover:opacity-90"
                  style={{ background: `linear-gradient(135deg, ${teal}, #00897B)`, boxShadow: `0 6px 20px ${teal}30` }}>
                  Get Started Free
                </button>
              </Link>
            </div>

            {/* Product */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.15em" }}>Product</p>
              <div className="space-y-3">
                {[
                  { label: "Features", href: "/features" },
                  { label: "Course Marketplace", href: "/courses" },
                  { label: "Assessment Hub", href: "/login" },
                  { label: "AI Mentor", href: "/login" },
                  { label: "Past Papers", href: "/paper-vault" },
                ].map(({ label, href }) => (
                  <div key={label}>
                    <Link href={href}>
                      <span className="text-sm transition-colors cursor-pointer" style={{ color: "rgba(255,255,255,0.5)" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#ffffff")}
                        onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}>
                        {label}
                      </span>
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* Company */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.15em" }}>Company</p>
              <div className="space-y-3">
                {[
                  { label: "Roadmap", href: "/roadmap" },
                  { label: "Release Notes", href: "/release-notes" },
                  { label: "Status", href: "/status" },
                  { label: "Trust Center", href: "/trust" },
                  { label: "Sitemap", href: "/sitemap" },
                ].map(({ label, href }) => (
                  <div key={label}>
                    <Link href={href}>
                      <span className="text-sm transition-colors cursor-pointer" style={{ color: "rgba(255,255,255,0.5)" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#ffffff")}
                        onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}>
                        {label}
                      </span>
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* Legal & contact */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.15em" }}>Legal</p>
              <div className="space-y-3 mb-6">
                {[
                  { label: "Terms of Service", href: "/terms" },
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Contact", href: "/contact" },
                ].map(({ label, href }) => (
                  <div key={label}>
                    <a href={href} className="text-sm transition-colors"
                      style={{ color: "rgba(255,255,255,0.5)" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#ffffff")}
                      onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}>
                      {label}
                    </a>
                  </div>
                ))}
              </div>
              {contactEmail && (
                <a href={`mailto:${contactEmail}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{ color: teal }}>
                  {contactEmail}
                </a>
              )}
            </div>
          </div>

          <div className="pt-8 border-t flex flex-col sm:flex-row justify-between items-center gap-3"
            style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
              © 2026 Aperti. All rights reserved.
            </span>
            <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.2)" }}>
              Built for educators who refuse to compromise.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
