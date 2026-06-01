import { useState, useRef, FormEvent } from "react";
import { motion, useInView, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight, Shield, BookOpen, Brain, BarChart3, Video,
  ClipboardCheck, GraduationCap, CheckCircle2, Sparkles,
  Menu, X, Users, FileText, Zap, ChevronRight,
} from "lucide-react";
import { Link } from "wouter";

const TEAL = "#00796B";
const TEAL_LIGHT = "#E6F4F1";

/* ── Scroll reveal ── */
function Reveal({ children, delay = 0, y = 24 }: { children: React.ReactNode; delay?: number; y?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ── Hero SVG illustration – neural / learning network ── */
function HeroIllustration() {
  const nodes = [
    { cx: 200, cy: 160, r: 28, label: "Teacher" },
    { cx: 420, cy: 80, r: 20, label: "LiveClass" },
    { cx: 560, cy: 200, r: 22, label: "Analytics" },
    { cx: 440, cy: 300, r: 20, label: "Student" },
    { cx: 280, cy: 320, r: 18, label: "Mentor" },
    { cx: 100, cy: 280, r: 18, label: "Parent" },
    { cx: 350, cy: 180, r: 14, label: "" },
    { cx: 480, cy: 150, r: 10, label: "" },
  ];
  const edges = [
    [0, 1], [0, 4], [0, 5], [0, 6], [1, 2], [1, 7],
    [2, 3], [3, 4], [4, 5], [6, 3], [6, 1], [7, 2],
  ];

  return (
    <svg
      viewBox="0 0 660 400"
      className="w-full max-w-2xl mx-auto"
      style={{ height: 340 }}
      aria-hidden
    >
      {/* Glow filter */}
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="nodeGrad" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#4DB6AC" />
          <stop offset="100%" stopColor={TEAL} />
        </radialGradient>
      </defs>

      {/* Edges */}
      {edges.map(([a, b], i) => (
        <motion.line
          key={i}
          x1={nodes[a].cx} y1={nodes[a].cy}
          x2={nodes[b].cx} y2={nodes[b].cy}
          stroke={TEAL} strokeWidth="1.5" strokeOpacity="0.22"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.3 + i * 0.06, ease: "easeInOut" }}
        />
      ))}

      {/* Pulse rings */}
      {[0, 2, 3].map((ni, i) => (
        <motion.circle
          key={`pulse-${ni}`}
          cx={nodes[ni].cx} cy={nodes[ni].cy}
          r={nodes[ni].r + 8}
          fill="none"
          stroke={TEAL}
          strokeWidth="1"
          strokeOpacity="0.18"
          initial={{ scale: 1, opacity: 0.18 }}
          animate={{ scale: [1, 1.6, 1], opacity: [0.18, 0, 0.18] }}
          transition={{ duration: 3, delay: i * 1.1, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: `${nodes[ni].cx}px ${nodes[ni].cy}px` }}
        />
      ))}

      {/* Nodes */}
      {nodes.map((n, i) => (
        <motion.g
          key={i}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring" as const, stiffness: 220, damping: 18, delay: 0.1 + i * 0.08 }}
          style={{ transformOrigin: `${n.cx}px ${n.cy}px` }}
        >
          <circle cx={n.cx} cy={n.cy} r={n.r + 3} fill="white" opacity="0.6" />
          <circle cx={n.cx} cy={n.cy} r={n.r} fill="url(#nodeGrad)" filter="url(#glow)" />
          {n.label && (
            <text
              x={n.cx} y={n.cy + n.r + 14}
              textAnchor="middle"
              fontSize="10"
              fill="#475569"
              fontFamily="Inter, sans-serif"
              fontWeight="500"
            >
              {n.label}
            </text>
          )}
        </motion.g>
      ))}

      {/* Floating data packets */}
      {[0, 1].map((i) => (
        <motion.circle
          key={`pkt-${i}`}
          r="4" fill={TEAL} opacity="0.7"
          initial={{ cx: nodes[0].cx, cy: nodes[0].cy }}
          animate={{
            cx: [nodes[0].cx, nodes[i === 0 ? 1 : 4].cx],
            cy: [nodes[0].cy, nodes[i === 0 ? 1 : 4].cy],
          }}
          transition={{ duration: 2.5, delay: i * 1.2, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}
        />
      ))}
    </svg>
  );
}

/* ── Feature card ── */
function FeatureCard({ icon, title, desc, delay = 0 }: { icon: React.ReactNode; title: string; desc: string; delay?: number }) {
  return (
    <Reveal delay={delay}>
      <motion.div
        whileHover={{ y: -6, boxShadow: "0 20px 48px rgba(0,121,107,0.12)" }}
        transition={{ type: "spring" as const, stiffness: 340, damping: 24 }}
        className="rounded-2xl border border-slate-100 bg-white p-6 h-full flex flex-col gap-4"
      >
        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: TEAL_LIGHT }}
        >
          {icon}
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900 mb-1.5">{title}</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
        </div>
      </motion.div>
    </Reveal>
  );
}

/* ── Pricing card ── */
function PricingCard({ name, price, features, popular }: { name: string; price: string; features: string[]; popular?: boolean }) {
  return (
    <Reveal>
      <motion.div
        whileHover={{ y: -6, boxShadow: popular ? "0 24px 60px rgba(0,121,107,0.20)" : "0 16px 40px rgba(0,0,0,0.08)" }}
        transition={{ type: "spring" as const, stiffness: 340, damping: 24 }}
        className={`relative rounded-2xl border bg-white p-7 h-full flex flex-col ${
          popular ? "border-[#00796B] ring-2 ring-[#00796B]/15" : "border-slate-100"
        }`}
      >
        {popular && (
          <span
            className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-white text-[11px] font-bold px-4 py-1 rounded-full tracking-wide"
            style={{ background: TEAL }}
          >
            MOST POPULAR
          </span>
        )}
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">{name}</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-extrabold text-slate-900">{price}</span>
            <span className="text-sm text-slate-400 leading-tight">EGP<br />/ student / mo</span>
          </div>
        </div>
        <ul className="space-y-3 mb-8 flex-1">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: TEAL }} />
              {f}
            </li>
          ))}
        </ul>
        <a href="#apply">
          <Button
            className="w-full rounded-xl font-semibold h-10"
            style={popular ? { background: TEAL, color: "white" } : { background: "#F1F5F9", color: "#334155" }}
          >
            Request Access
          </Button>
        </a>
      </motion.div>
    </Reveal>
  );
}

/* ── Early access form ── */
function EarlyAccessForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); setSubmitted(true); }, 900);
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.93 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring" as const, stiffness: 280, damping: 22 }}
        className="text-center p-12 bg-white border border-slate-100 rounded-2xl shadow-sm max-w-xl mx-auto"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring" as const, stiffness: 380, damping: 20, delay: 0.1 }}
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: TEAL_LIGHT }}
        >
          <Sparkles className="h-7 w-7" style={{ color: TEAL }} />
        </motion.div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Application received.</h3>
        <p className="text-slate-500 text-sm leading-relaxed">
          Our team will review your application and reach out within 48 hours to set up your personalised Aperti workspace.
        </p>
      </motion.div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-xl mx-auto bg-white border border-slate-100 rounded-2xl p-8 shadow-sm space-y-5"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">Full Name *</Label>
          <Input required placeholder="e.g. Alexandra Chen" className="h-10 rounded-xl border-slate-200" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">Email *</Label>
          <Input required type="email" placeholder="you@school.com" className="h-10 rounded-xl border-slate-200" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">Estimated Students *</Label>
          <Input required type="number" min={1} placeholder="e.g. 120" className="h-10 rounded-xl border-slate-200" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">Subjects & Exam Boards</Label>
          <Input placeholder="e.g. Physics CAIE, Maths Edexcel" className="h-10 rounded-xl border-slate-200" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-slate-700">What would you like Aperti to solve?</Label>
        <Textarea
          rows={3}
          placeholder="Tell us your biggest teaching challenge…"
          className="rounded-xl border-slate-200 resize-none"
        />
      </div>
      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 rounded-xl font-semibold text-white"
        style={{ background: loading ? "#4DB6AC" : TEAL }}
      >
        {loading ? (
          <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 0.9, repeat: Infinity }}>
            Submitting…
          </motion.span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            Submit Application <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </Button>
      <p className="text-center text-xs text-slate-400">
        No commitment required. We'll personally reach out within 48 hours.
      </p>
    </form>
  );
}

/* ── Main landing page ── */
export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();
  const navBg = useTransform(scrollY, [0, 80], ["rgba(245,245,245,0)", "rgba(255,255,255,0.96)"]);
  const navBorder = useTransform(scrollY, [0, 80], ["rgba(0,0,0,0)", "rgba(226,232,240,1)"]);

  const features = [
    {
      icon: <Video className="h-5 w-5" style={{ color: TEAL }} />,
      title: "Live Teaching",
      desc: "High-fidelity virtual classrooms with WebRTC, host controls, hand-raise, whiteboard sync, and session recording — built for professional educators.",
    },
    {
      icon: <ClipboardCheck className="h-5 w-5" style={{ color: TEAL }} />,
      title: "Smart Attendance",
      desc: "QR-based check-in with anti-fraud scanning, automatic parent notifications for absences, and detailed attendance analytics in real time.",
    },
    {
      icon: <Brain className="h-5 w-5" style={{ color: TEAL }} />,
      title: "AI-Powered Tutoring",
      desc: "The Mentor adapts to each student's learning gaps, preferred style, and exam board — delivering personalised guidance at every step.",
    },
    {
      icon: <BarChart3 className="h-5 w-5" style={{ color: TEAL }} />,
      title: "Deep Insight Analytics",
      desc: "InsightStream surfaces attendance trends, grade trajectories, engagement scores, and at-risk flags before they become problems.",
    },
    {
      icon: <GraduationCap className="h-5 w-5" style={{ color: TEAL }} />,
      title: "Auto-Grading",
      desc: "SubmitFlow accepts handwritten or typed work, applies your mark scheme via AI, and returns annotated feedback instantly.",
    },
    {
      icon: <Shield className="h-5 w-5" style={{ color: TEAL }} />,
      title: "Exam Integrity",
      desc: "ShieldCore provides behavioural proctoring, browser-lock mode, and AI-generated unique question sets — all built in.",
    },
  ];

  const plans = [
    {
      name: "Starter",
      price: "50",
      features: ["QR Attendance & Reporting", "PlanGrid Timetable", "SubmitFlow Homework", "Student & Parent Portals", "10 GB Secure Storage"],
    },
    {
      name: "Professional",
      price: "100",
      popular: true,
      features: [
        "Everything in Starter",
        "LiveClass (up to 50 peers)",
        "The Mentor AI Tutor",
        "InkSpace Digital Whiteboard",
        "InsightStream Analytics",
        "50 GB Storage",
      ],
    },
    {
      name: "Enterprise",
      price: "150",
      features: [
        "Everything in Professional",
        "LiveClass (up to 200 peers)",
        "ShieldCore Proctoring",
        "TeamForge Collaboration",
        "Priority Support",
        "100 GB Storage",
      ],
    },
    {
      name: "Master",
      price: "200",
      features: [
        "Unlimited Seats & Storage",
        "White-Label Branding",
        "Dedicated Account Manager",
        "Custom Integrations & API",
        "SLA Guarantee",
        "Custom Pricing for Centres",
      ],
    },
  ];

  const navLinks = [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Apply", href: "#apply" },
  ];

  return (
    <div className="min-h-screen text-slate-900" style={{ background: "#F5F5F5", fontFamily: "Inter, sans-serif" }}>

      {/* ── NAV ── */}
      <motion.nav
        className="fixed top-0 w-full z-50 backdrop-blur-sm border-b"
        style={{ backgroundColor: navBg, borderColor: navBorder }}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <a href="/" className="text-xl font-extrabold tracking-tight text-slate-900">
            Aperti<span style={{ color: TEAL }}>.</span>
          </a>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
            {navLinks.map(l => (
              <a key={l.label} href={l.href} className="hover:text-slate-900 transition-colors">{l.label}</a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 text-sm">Sign in</Button>
            </Link>
            <a href="#apply">
              <Button size="sm" className="rounded-xl text-white px-5 text-sm font-semibold" style={{ background: TEAL }}>
                Request Access
              </Button>
            </a>
          </div>

          <button className="md:hidden p-1" onClick={() => setMobileOpen(v => !v)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-t border-slate-100 px-5 py-5 flex flex-col gap-4 text-sm font-medium"
            >
              {navLinks.map(l => (
                <a key={l.label} href={l.href} onClick={() => setMobileOpen(false)} className="text-slate-600">{l.label}</a>
              ))}
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                <Button variant="outline" size="sm" className="w-full rounded-xl">Sign in</Button>
              </Link>
              <a href="#apply" onClick={() => setMobileOpen(false)}>
                <Button size="sm" className="w-full rounded-xl text-white font-semibold" style={{ background: TEAL }}>
                  Request Access
                </Button>
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ── HERO ── */}
      <section className="pt-36 pb-24 md:pt-52 md:pb-32 px-5 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left — copy */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
            >
              <Badge
                className="mb-7 rounded-full px-4 py-1.5 text-xs font-semibold border-0 tracking-wide"
                style={{ background: TEAL_LIGHT, color: TEAL }}
              >
                Educational Operating System
              </Badge>
            </motion.div>

            <motion.h1
              className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.05] mb-6"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              Where every mind{" "}
              <span style={{ color: TEAL }}>finds its rhythm.</span>
            </motion.h1>

            <motion.p
              className="text-lg text-slate-500 leading-relaxed mb-10 max-w-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.18 }}
            >
              The intelligent operating system that replaces fragmented tools with one unified, beautifully designed platform — built for educators who refuse to compromise.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.28 }}
            >
              <a href="#apply">
                <Button
                  size="lg"
                  className="rounded-xl h-12 px-8 text-white font-semibold shadow-md"
                  style={{ background: TEAL }}
                >
                  Request Early Access <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <a href="#features">
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-xl h-12 px-6 border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50"
                >
                  Explore Features <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </a>
            </motion.div>

            <motion.div
              className="mt-10 flex flex-wrap gap-6 text-xs text-slate-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {["Trusted by educators across 3 countries", "GDPR-compliant data ownership", "Dedicated onboarding support"].map(t => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: TEAL }} />
                  {t}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Right — illustration */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:block"
          >
            <HeroIllustration />
          </motion.div>
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <section className="py-10 px-5" style={{ background: "white" }}>
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="flex flex-wrap items-center justify-center gap-10 text-sm text-slate-400 font-medium">
              {[
                { icon: <Shield className="h-4 w-4" />, text: "Enterprise-grade security" },
                { icon: <Zap className="h-4 w-4" />, text: "Real-time synchronisation" },
                { icon: <Users className="h-4 w-4" />, text: "Multi-role portals" },
                { icon: <BookOpen className="h-4 w-4" />, text: "All major exam boards" },
                { icon: <CheckCircle2 className="h-4 w-4" />, text: "White-label available" },
              ].map((item, i) => (
                <span key={i} className="flex items-center gap-2" style={{ color: "#94A3B8" }}>
                  <span style={{ color: TEAL }}>{item.icon}</span>
                  {item.text}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 px-5" style={{ background: "#F5F5F5" }}>
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <Badge className="mb-5 rounded-full px-4 py-1.5 text-xs font-semibold border-0" style={{ background: TEAL_LIGHT, color: TEAL }}>
                Core Capabilities
              </Badge>
              <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
                One platform. Every tool you need.
              </h2>
              <p className="text-slate-500 max-w-xl mx-auto text-lg leading-relaxed">
                Stop juggling fragmented apps. Aperti brings your entire teaching workflow into one coherent, beautifully crafted system.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <FeatureCard key={f.title} {...f} delay={i * 0.07} />
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 px-5" style={{ background: "white" }}>
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
                From chaos to clarity.
              </h2>
              <p className="text-slate-500 max-w-lg mx-auto">
                Aperti is thoughtfully structured around the way great educators already think.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Configure your workspace",
                desc: "Add your subjects, student roster, and timetable. Our onboarding team will guide you through every detail.",
              },
              {
                step: "02",
                title: "Run your first session",
                desc: "Take attendance with a QR scan, launch a live class, assign homework — everything flows from one dashboard.",
              },
              {
                step: "03",
                title: "Act on real-time insight",
                desc: "Aperti surfaces who is falling behind, which topics need attention, and which students are thriving.",
              },
            ].map((item, i) => (
              <Reveal key={item.step} delay={i * 0.1}>
                <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
                  <div
                    className="text-5xl font-extrabold mb-5 leading-none"
                    style={{ color: TEAL_LIGHT, WebkitTextStroke: `2px ${TEAL}` }}
                  >
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 px-5" style={{ background: "#F5F5F5" }}>
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <Badge className="mb-5 rounded-full px-4 py-1.5 text-xs font-semibold border-0" style={{ background: TEAL_LIGHT, color: TEAL }}>
                Transparent Pricing
              </Badge>
              <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
                Plans that scale with you.
              </h2>
              <p className="text-slate-500 max-w-lg mx-auto">
                Pay per student, per month. Adjust seats at any time with FlexSeats — no lock-in, no surprise invoices.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map(p => (
              <PricingCard key={p.name} {...p} />
            ))}
          </div>

          <Reveal>
            <p className="text-center text-sm text-slate-400 mt-8">
              Volume discounts available for large centres. InstaPay accepted.{" "}
              <a href="#apply" className="underline underline-offset-2" style={{ color: TEAL }}>
                Talk to us for custom pricing.
              </a>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── EARLY ACCESS FORM ── */}
      <section id="apply" className="py-24 px-5" style={{ background: "white" }}>
        <div className="max-w-7xl mx-auto text-center">
          <Reveal>
            <Badge className="mb-5 rounded-full px-4 py-1.5 text-xs font-semibold border-0" style={{ background: TEAL_LIGHT, color: TEAL }}>
              Exclusive Community
            </Badge>
            <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
              Join Aperti Early Access.
            </h2>
            <p className="text-slate-500 mb-12 max-w-lg mx-auto text-lg leading-relaxed">
              We are onboarding a select community of pioneering educators. Tell us about your school — we will personally build your workspace together.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <EarlyAccessForm />
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-100 py-12 px-5" style={{ background: "#F5F5F5" }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <p className="text-base font-extrabold text-slate-900">
                Aperti<span style={{ color: TEAL }}>.</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">Where every mind finds its rhythm.</p>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
              <a href="/paper-vault" className="hover:text-slate-700 transition-colors">Past Papers</a>
              <a href="/terms" className="hover:text-slate-700 transition-colors">Terms</a>
              <a href="/privacy" className="hover:text-slate-700 transition-colors">Privacy</a>
              <a href="/contact" className="hover:text-slate-700 transition-colors">Contact</a>
              <a href="/sitemap" className="hover:text-slate-700 transition-colors">Sitemap</a>
              <a href="mailto:info@aperti.ai" style={{ color: TEAL }} className="hover:opacity-80 transition-opacity">
                info@aperti.ai
              </a>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-slate-400">
            <span>© 2026 Aperti. All rights reserved.</span>
            <span>Built for educators who refuse to compromise.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
