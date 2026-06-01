import { useState, useRef, useEffect, FormEvent } from "react";
import { motion, useInView, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight, Zap, Shield, BookOpen, Users, CheckCircle2, Sparkles,
  Menu, X, Brain, BarChart3, Video, ClipboardCheck, GraduationCap,
  FileText, Star, ChevronRight,
} from "lucide-react";
import { Link } from "wouter";

/* ─────────────────────────────────────────────
   DESIGN TOKENS (Liquid Flow 2.0)
   bg: #F5F5F5  card: #FFFFFF  text: #121212
   primary teal: #00796B
───────────────────────────────────────────── */
const TEAL = "#00796B";

/* ─────────────────────────────────────────────
   ENHANCED CIRCUIT DEMO
───────────────────────────────────────────── */
function CircuitDemo() {
  const [batteryOn, setBatteryOn] = useState(false);
  const [switchClosed, setSwitchClosed] = useState(false);
  const bulbGlows = batteryOn && switchClosed;

  const wireColor = bulbGlows ? TEAL : "#CBD5E1";
  const wireWidth = bulbGlows ? 3 : 2;

  return (
    <div className="relative w-full max-w-lg mx-auto select-none">
      <p className="text-xs font-mono text-slate-400 mb-3 tracking-wider uppercase">
        Interactive Demo — no sign-up needed
      </p>
      <div
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {/* SVG Circuit */}
        <svg viewBox="0 0 400 200" className="w-full" style={{ height: 180 }}>
          {/* Wires */}
          <motion.path
            d="M 80 100 L 160 100"
            stroke={wireColor}
            strokeWidth={wireWidth}
            fill="none"
            animate={{ stroke: wireColor, strokeWidth: wireWidth }}
            transition={{ duration: 0.4 }}
          />
          <motion.path
            d="M 240 100 L 320 100"
            stroke={wireColor}
            strokeWidth={wireWidth}
            fill="none"
            animate={{ stroke: wireColor, strokeWidth: wireWidth }}
            transition={{ duration: 0.4 }}
          />
          <motion.path
            d="M 320 100 L 320 40 L 80 40 L 80 100"
            stroke={wireColor}
            strokeWidth={wireWidth}
            fill="none"
            animate={{ stroke: wireColor, strokeWidth: wireWidth }}
            transition={{ duration: 0.4 }}
          />

          {/* Battery */}
          <g
            style={{ cursor: "pointer" }}
            onClick={() => setBatteryOn(!batteryOn)}
          >
            <motion.rect
              x="20" y="76" width="60" height="48" rx="8"
              fill={batteryOn ? "#E6F4F1" : "#F8FAFC"}
              stroke={batteryOn ? TEAL : "#CBD5E1"}
              strokeWidth="2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              animate={{ fill: batteryOn ? "#E6F4F1" : "#F8FAFC", stroke: batteryOn ? TEAL : "#CBD5E1" }}
              transition={{ duration: 0.3 }}
            />
            {/* Battery terminals */}
            <rect x="77" y="88" width="6" height="24" rx="2" fill={batteryOn ? TEAL : "#94A3B8"} />
            <rect x="17" y="92" width="6" height="16" rx="2" fill={batteryOn ? TEAL : "#CBD5E1"} />
            {/* +/- */}
            <text x="50" y="97" textAnchor="middle" fontSize="10" fill={batteryOn ? TEAL : "#94A3B8"} fontWeight="bold">+</text>
            <text x="50" y="111" textAnchor="middle" fontSize="14" fill={batteryOn ? TEAL : "#94A3B8"} fontWeight="bold">
              {batteryOn ? "ON" : "BAT"}
            </text>
          </g>

          {/* Switch */}
          <g
            style={{ cursor: "pointer" }}
            onClick={() => setSwitchClosed(!switchClosed)}
          >
            <rect x="152" y="82" width="88" height="36" rx="18" fill="white" stroke={switchClosed ? TEAL : "#CBD5E1"} strokeWidth="2" />
            <motion.g
              animate={{ x: switchClosed ? 52 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <circle
                cx={170} cy={100} r="13"
                fill={switchClosed ? TEAL : "#CBD5E1"}
              />
            </motion.g>
            <text x="196" y="126" textAnchor="middle" fontSize="9" fill="#94A3B8" fontFamily="sans-serif">
              {switchClosed ? "CLOSED" : "OPEN"}
            </text>
          </g>

          {/* Bulb */}
          <g>
            <motion.circle
              cx="320" cy="100" r="28"
              fill={bulbGlows ? "#E6F4F1" : "#F8FAFC"}
              stroke={bulbGlows ? TEAL : "#CBD5E1"}
              strokeWidth="2"
              animate={{
                fill: bulbGlows ? "#E6F4F1" : "#F8FAFC",
                stroke: bulbGlows ? TEAL : "#CBD5E1",
                filter: bulbGlows
                  ? "drop-shadow(0 0 12px rgba(0,121,107,0.6))"
                  : "none",
              }}
              transition={{ duration: 0.4 }}
            />
            {/* Filament lines */}
            <motion.text
              x="320" y="104" textAnchor="middle" fontSize="18"
              animate={{ fill: bulbGlows ? TEAL : "#CBD5E1" }}
              transition={{ duration: 0.3 }}
            >
              💡
            </motion.text>
            <text x="320" y="142" textAnchor="middle" fontSize="9" fill={bulbGlows ? TEAL : "#94A3B8"} fontFamily="sans-serif">
              {bulbGlows ? "GLOWING" : "OFF"}
            </text>
          </g>
        </svg>

        {/* Instructions */}
        <div className="mt-3 flex flex-wrap gap-4 justify-center text-xs text-slate-500" style={{ fontFamily: "Inter, sans-serif" }}>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: batteryOn ? TEAL : "#CBD5E1" }} />
            Tap battery to toggle power
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: switchClosed ? TEAL : "#CBD5E1" }} />
            Flip the switch
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: bulbGlows ? TEAL : "#CBD5E1" }} />
            Watch the bulb glow
          </span>
        </div>

        {bulbGlows && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-center text-sm font-medium"
            style={{ color: TEAL, fontFamily: "Inter, sans-serif" }}
          >
            ✓ Circuit complete — just like a real lesson.
          </motion.div>
        )}
      </div>
      <p className="text-center text-xs text-slate-400 mt-3" style={{ fontFamily: "Inter, sans-serif" }}>
        "Build a circuit in 10 seconds — no sign-up needed."
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SCROLL REVEAL WRAPPER
───────────────────────────────────────────── */
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   FEATURE CARD
───────────────────────────────────────────── */
function FeatureCard({
  icon,
  title,
  desc,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  delay?: number;
}) {
  return (
    <Reveal delay={delay}>
      <motion.div
        whileHover={{ y: -5, boxShadow: "0 12px 32px rgba(0,121,107,0.10)" }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="rounded-2xl border border-slate-200 bg-white p-6 h-full"
      >
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl mb-4"
          style={{ background: "#E6F4F1" }}
        >
          {icon}
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-1.5">{title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
      </motion.div>
    </Reveal>
  );
}

/* ─────────────────────────────────────────────
   PRICING CARD
───────────────────────────────────────────── */
function PricingCard({
  name,
  price,
  features,
  popular,
}: {
  name: string;
  price: string;
  features: string[];
  popular?: boolean;
}) {
  return (
    <Reveal>
      <motion.div
        whileHover={{ y: -5, boxShadow: popular ? "0 16px 48px rgba(0,121,107,0.18)" : "0 12px 32px rgba(0,0,0,0.08)" }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={`relative rounded-2xl border p-6 bg-white h-full flex flex-col ${
          popular ? "border-teal-600 ring-2 ring-teal-600/20" : "border-slate-200"
        }`}
      >
        {popular && (
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-semibold px-3 py-1 rounded-full"
            style={{ background: TEAL }}
          >
            Most Popular
          </div>
        )}
        <div className="mb-4">
          <p className="text-sm font-medium text-slate-500 mb-1">{name}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-slate-900">{price}</span>
            <span className="text-sm text-slate-400">EGP / student / mo</span>
          </div>
        </div>
        <ul className="space-y-2.5 mb-6 flex-1">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: TEAL }} />
              {f}
            </li>
          ))}
        </ul>
        <Button
          className="w-full rounded-xl font-medium"
          style={
            popular
              ? { background: TEAL, color: "white" }
              : { background: "#F1F5F9", color: "#334155" }
          }
        >
          Get started
        </Button>
      </motion.div>
    </Reveal>
  );
}

/* ─────────────────────────────────────────────
   EARLY ACCESS FORM
───────────────────────────────────────────── */
function EarlyAccessForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 800);
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="text-center p-10 border border-slate-200 rounded-2xl bg-white shadow-sm max-w-xl mx-auto"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.1 }}
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: "#E6F4F1" }}
        >
          <Sparkles className="h-8 w-8" style={{ color: TEAL }} />
        </motion.div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">You're on the list!</h3>
        <p className="text-slate-500 text-sm">
          We'll reach out soon to set up your personalised Aperti workspace. Expect great things.
        </p>
      </motion.div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-xl mx-auto space-y-4 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-slate-700 text-sm font-medium">Full Name *</Label>
          <Input
            required
            placeholder="e.g. Alex Rivera"
            className="rounded-xl border-slate-200 focus-visible:ring-teal-600"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-700 text-sm font-medium">Email *</Label>
          <Input
            required
            type="email"
            placeholder="you@school.com"
            className="rounded-xl border-slate-200 focus-visible:ring-teal-600"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-slate-700 text-sm font-medium">Estimated Students *</Label>
          <Input
            required
            type="number"
            min={1}
            placeholder="e.g. 120"
            className="rounded-xl border-slate-200 focus-visible:ring-teal-600"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-700 text-sm font-medium">Subjects & Boards</Label>
          <Input
            placeholder="e.g. Math CAIE, Physics AS"
            className="rounded-xl border-slate-200 focus-visible:ring-teal-600"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-slate-700 text-sm font-medium">What would you love Aperti to solve?</Label>
        <Textarea
          rows={3}
          placeholder="Tell us about your biggest teaching challenge..."
          className="rounded-xl border-slate-200 focus-visible:ring-teal-600 resize-none"
        />
      </div>
      <Button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl h-11 font-semibold text-white"
        style={{ background: loading ? "#4DB6AC" : TEAL }}
      >
        {loading ? (
          <motion.span
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            Submitting…
          </motion.span>
        ) : (
          <span className="flex items-center gap-2">
            Apply for Early Access <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </Button>
      <p className="text-center text-xs text-slate-400">
        No commitment. No credit card. Just a conversation.
      </p>
    </form>
  );
}

/* ─────────────────────────────────────────────
   STAT COUNTER
───────────────────────────────────────────── */
function StatCard({ value, label }: { value: string; label: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  return (
    <div ref={ref} className="text-center">
      <motion.p
        className="text-4xl font-extrabold text-slate-900"
        initial={{ opacity: 0, y: 10 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
      >
        {value}
      </motion.p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN LANDING PAGE
───────────────────────────────────────────── */
export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { scrollY } = useScroll();
  const navBg = useTransform(scrollY, [0, 60], ["rgba(245,245,245,0)", "rgba(255,255,255,0.95)"]);
  const navBorder = useTransform(scrollY, [0, 60], ["rgba(0,0,0,0)", "rgba(226,232,240,1)"]);

  const features = [
    {
      icon: <ClipboardCheck className="h-5 w-5" style={{ color: TEAL }} />,
      title: "CheckIn™",
      desc: "QR-based attendance with anti-fraud scanning, auto-generated logs, and instant reports.",
    },
    {
      icon: <BookOpen className="h-5 w-5" style={{ color: TEAL }} />,
      title: "PlanGrid™",
      desc: "Smart scheduling for online, in-person, and hybrid classes — all in one timetable.",
    },
    {
      icon: <Video className="h-5 w-5" style={{ color: TEAL }} />,
      title: "LiveClass™",
      desc: "High-quality virtual classrooms with host controls, recording, and TwinControl pairing.",
    },
    {
      icon: <Shield className="h-5 w-5" style={{ color: TEAL }} />,
      title: "ShieldCore™",
      desc: "Behavioural proctoring and anti-cheat built directly into your exam flow.",
    },
    {
      icon: <Brain className="h-5 w-5" style={{ color: TEAL }} />,
      title: "The Mentor™",
      desc: "An AI tutor that adapts to each student's weak areas, preferred style, and pace.",
    },
    {
      icon: <BarChart3 className="h-5 w-5" style={{ color: TEAL }} />,
      title: "InsightStream™",
      desc: "Real-time analytics on attendance, grades, engagement, and student risk levels.",
    },
    {
      icon: <Users className="h-5 w-5" style={{ color: TEAL }} />,
      title: "SubmitFlow™",
      desc: "Homework submission with auto-grading, handwriting OCR, and instant feedback.",
    },
    {
      icon: <FileText className="h-5 w-5" style={{ color: TEAL }} />,
      title: "PaperVault™",
      desc: "A free public library of past papers, mark schemes, and revision resources.",
    },
    {
      icon: <GraduationCap className="h-5 w-5" style={{ color: TEAL }} />,
      title: "Ascend™",
      desc: "XP, levels, quests, and leaderboards that make learning feel like an adventure.",
    },
  ];

  const pricingPlans = [
    {
      name: "Starter",
      price: "50",
      features: [
        "CheckIn™ attendance",
        "PlanGrid™ timetable",
        "SubmitFlow™ homework",
        "10 GB secure storage",
        "Up to 50 students",
      ],
    },
    {
      name: "Professional",
      price: "100",
      popular: true,
      features: [
        "Everything in Starter",
        "GradeFlow™ + SchemeCraft™",
        "LiveClass™ (up to 50 participants)",
        "InkSpace™ digital whiteboard",
        "The Mentor™ AI tutor",
        "50 GB storage",
      ],
    },
    {
      name: "Enterprise",
      price: "150",
      features: [
        "Everything in Professional",
        "LiveClass™ (up to 200 participants)",
        "TeamForge™ group projects",
        "ShieldCore™ proctoring",
        "Priority support",
        "100 GB storage",
      ],
    },
    {
      name: "Master",
      price: "200",
      features: [
        "Unlimited everything",
        "White-label branding",
        "Dedicated account manager",
        "Custom integrations",
        "Unlimited storage",
        "SLA guarantee",
      ],
    },
  ];

  const testimonials = [
    {
      name: "Ms. Johnson",
      role: "A-Level Mathematics, 127 students",
      text: "I used to juggle three different apps just to run a single lesson. Aperti replaced all of them — and my students actually enjoy logging in.",
    },
    {
      name: "Mr. Williams",
      role: "IGCSE Physics & Chemistry, 84 students",
      text: "The AI mentor caught students who were struggling before I even noticed. The risk engine is genuinely impressive.",
    },
    {
      name: "Alex Rivera",
      role: "Centre Director, 340 students",
      text: "FlexSeats™ let us scale from 80 to 340 students mid-year without a single admin headache. The billing just worked.",
    },
  ];

  return (
    <div className="min-h-screen text-slate-900" style={{ background: "#F5F5F5", fontFamily: "Inter, sans-serif" }}>

      {/* ── NAV ── */}
      <motion.nav
        className="fixed top-0 w-full z-50 backdrop-blur-sm border-b"
        style={{
          backgroundColor: navBg,
          borderColor: navBorder,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-1 text-xl font-extrabold tracking-tight text-slate-900">
            Aperti<span style={{ color: TEAL }}>™</span>
          </a>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-teal-700 transition-colors">Features</a>
            <a href="#demo" className="hover:text-teal-700 transition-colors">Demo</a>
            <a href="#pricing" className="hover:text-teal-700 transition-colors">Pricing</a>
            <a href="#early-access" className="hover:text-teal-700 transition-colors">Early Access</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
                Sign in
              </Button>
            </Link>
            <a href="#early-access">
              <Button
                size="sm"
                className="rounded-xl text-white px-4"
                style={{ background: TEAL }}
              >
                Get Early Access
              </Button>
            </a>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-slate-200 bg-white px-4 py-4 flex flex-col gap-4 text-sm font-medium"
            >
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-slate-700">Features</a>
              <a href="#demo" onClick={() => setMobileMenuOpen(false)} className="text-slate-700">Demo</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-slate-700">Pricing</a>
              <a href="#early-access" onClick={() => setMobileMenuOpen(false)} className="text-slate-700">Early Access</a>
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" size="sm" className="w-full rounded-xl">Sign in</Button>
              </Link>
              <a href="#early-access" onClick={() => setMobileMenuOpen(false)}>
                <Button size="sm" className="w-full rounded-xl text-white" style={{ background: TEAL }}>
                  Get Early Access
                </Button>
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ── HERO ── */}
      <section className="pt-32 pb-20 md:pt-44 md:pb-28 px-4 max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
        >
          <Badge
            className="mb-6 rounded-full px-4 py-1.5 text-xs font-semibold border-0"
            style={{ background: "#E6F4F1", color: TEAL }}
          >
            Educational Operating System
          </Badge>
        </motion.div>

        <motion.h1
          className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.06] mb-5"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          Where every mind{" "}
          <br className="hidden sm:block" />
          <span style={{ color: TEAL }}>finds its rhythm.</span>
        </motion.h1>

        <motion.p
          className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2 }}
        >
          Aperti replaces the scattered apps you use every day with one intelligent,
          beautifully minimal platform — built for teachers who refuse to compromise.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-3 justify-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <a href="#early-access">
            <Button
              size="lg"
              className="rounded-xl h-12 px-7 text-white font-semibold shadow-md"
              style={{ background: TEAL }}
            >
              Get Early Access <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
          <a href="#demo">
            <Button
              variant="outline"
              size="lg"
              className="rounded-xl h-12 px-7 border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50"
            >
              Watch Demo
            </Button>
          </a>
        </motion.div>

        {/* Social proof strip */}
        <motion.div
          className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {["No credit card required", "Set up in under 5 minutes", "Free during beta"].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: TEAL }} />
              {t}
            </span>
          ))}
        </motion.div>
      </section>

      {/* ── STATS ── */}
      <section className="py-14 px-4" style={{ background: "white" }}>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatCard value="9+" label="Core modules" />
          <StatCard value="3" label="Portal types" />
          <StatCard value="< 5 min" label="Setup time" />
          <StatCard value="100%" label="Data ownership" />
        </div>
      </section>

      {/* ── INTERACTIVE DEMO ── */}
      <section id="demo" className="py-20 px-4" style={{ background: "#F5F5F5" }}>
        <div className="max-w-2xl mx-auto text-center">
          <Reveal>
            <Badge
              className="mb-4 rounded-full px-3 py-1 text-xs font-semibold border-0"
              style={{ background: "#E6F4F1", color: TEAL }}
            >
              Try it now
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
              Physics in the browser.
            </h2>
            <p className="text-slate-500 mb-8">
              One of many interactive labs built into Aperti. Tap the battery, flip the switch.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <CircuitDemo />
          </Reveal>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-20 px-4" style={{ background: "white" }}>
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <Badge
                className="mb-4 rounded-full px-3 py-1 text-xs font-semibold border-0"
                style={{ background: "#E6F4F1", color: TEAL }}
              >
                Core Capabilities
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
                One platform. Every tool you need.
              </h2>
              <p className="text-slate-500 max-w-xl mx-auto">
                Stop juggling fragmented apps. Aperti brings your entire teaching workflow
                into one coherent, beautifully designed system.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <FeatureCard key={f.title} {...f} delay={i * 0.06} />
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 px-4" style={{ background: "#F5F5F5" }}>
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
                From chaos to clarity in minutes.
              </h2>
              <p className="text-slate-500">Three steps. Zero friction.</p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Set up your workspace",
                desc: "Add your subjects, import students, and configure your schedule. Takes less than 5 minutes.",
              },
              {
                step: "02",
                title: "Run your first class",
                desc: "Take attendance with a QR code, host a live session, assign homework — all from one dashboard.",
              },
              {
                step: "03",
                title: "Watch the insights flow",
                desc: "Aperti surfaces who's struggling, what topics need revisiting, and which students are excelling.",
              },
            ].map((item, i) => (
              <Reveal key={item.step} delay={i * 0.1}>
                <div className="rounded-2xl bg-white border border-slate-200 p-7">
                  <div
                    className="text-4xl font-extrabold mb-4"
                    style={{ color: "#E6F4F1", WebkitTextStroke: `2px ${TEAL}` }}
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

      {/* ── TESTIMONIALS ── */}
      <section className="py-20 px-4" style={{ background: "white" }}>
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <Badge
                className="mb-4 rounded-full px-3 py-1 text-xs font-semibold border-0"
                style={{ background: "#E6F4F1", color: TEAL }}
              >
                Early Feedback
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
                Teachers love the difference.
              </h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.1}>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="rounded-2xl border border-slate-200 bg-white p-7"
                >
                  <div className="flex mb-3">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-current" style={{ color: TEAL }} />
                    ))}
                  </div>
                  <p className="text-slate-700 text-sm leading-relaxed mb-5">"{t.text}"</p>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.role}</p>
                  </div>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-20 px-4" style={{ background: "#F5F5F5" }}>
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <Badge
                className="mb-4 rounded-full px-3 py-1 text-xs font-semibold border-0"
                style={{ background: "#E6F4F1", color: TEAL }}
              >
                Fair & Flexible
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
                Teacher plans that scale with you.
              </h2>
              <p className="text-slate-500 max-w-lg mx-auto">
                Pay per student, per month. Scale up or down with FlexSeats™ at any time.
                Volume discounts available for large centres.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {pricingPlans.map((plan) => (
              <PricingCard key={plan.name} {...plan} />
            ))}
          </div>

          <Reveal>
            <p className="text-center text-sm text-slate-400 mt-8">
              Student independent plans available separately. InstaPay accepted. FlexSeats™ lets you
              add or remove seats mid-cycle with pro-rated billing.{" "}
              <a href="#early-access" className="underline underline-offset-2" style={{ color: TEAL }}>
                Talk to us for custom pricing.
              </a>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── EARLY ACCESS ── */}
      <section id="early-access" className="py-20 px-4" style={{ background: "white" }}>
        <div className="max-w-7xl mx-auto text-center">
          <Reveal>
            <Badge
              className="mb-4 rounded-full px-3 py-1 text-xs font-semibold border-0"
              style={{ background: "#E6F4F1", color: TEAL }}
            >
              Teachers first
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
              Be among the first on Aperti.
            </h2>
            <p className="text-slate-500 mb-10 max-w-lg mx-auto">
              We're onboarding a select group of dedicated teachers. Tell us about your
              needs and we'll build your workspace together — personally.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <EarlyAccessForm />
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-200 py-10 px-4" style={{ background: "#F5F5F5" }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <p className="text-base font-extrabold text-slate-900">
                Aperti<span style={{ color: TEAL }}>™</span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Where every mind finds its rhythm.</p>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
              <a href="/terms" className="hover:text-slate-900 transition-colors">Terms</a>
              <a href="/privacy" className="hover:text-slate-900 transition-colors">Privacy</a>
              <a href="/contact" className="hover:text-slate-900 transition-colors">Contact</a>
              <a href="/sitemap" className="hover:text-slate-900 transition-colors">Sitemap</a>
              <a href="mailto:info@aperti.ai" className="hover:text-slate-900 transition-colors" style={{ color: TEAL }}>
                info@aperti.ai
              </a>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-slate-400">
            <span>© {new Date().getFullYear()} Aperti™. All rights reserved.</span>
            <span>Built for teachers who refuse to compromise.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
