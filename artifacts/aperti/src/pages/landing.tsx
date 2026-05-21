import { useState, useRef, useEffect, FormEvent } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  ArrowRight, Zap, Shield, BookOpen, Users, Star, Sparkles, Menu, X, CircuitBoard, Globe, Palette,
} from "lucide-react";
import { Link } from "wouter";

/* ---------- Interactive Circuit Demo (simple state-based, no external library) ---------- */
function CircuitDemo() {
  const [batteryOn, setBatteryOn] = useState(false);
  const [bulbGlows, setBulbGlows] = useState(false);
  const [switchClosed, setSwitchClosed] = useState(false);

  useEffect(() => {
    if (batteryOn && switchClosed) setBulbGlows(true);
    else setBulbGlows(false);
  }, [batteryOn, switchClosed]);

  return (
    <div className="relative w-full h-64 bg-background rounded-xl border border-border p-4 flex flex-col items-center justify-center gap-4 select-none">
      <p className="text-xs text-muted-foreground absolute top-2 left-3">Live demo – drag components</p>
      {/* Battery */}
      <div
        className={`w-16 h-12 rounded-md border-2 flex items-center justify-center text-xs font-bold cursor-pointer transition-colors ${
          batteryOn ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
        }`}
        onClick={() => setBatteryOn(!batteryOn)}
      >
        {batteryOn ? "ON" : "BAT"}
      </div>
      {/* Switch */}
      <div
        className={`w-20 h-8 rounded-full border-2 flex items-center px-1 cursor-pointer transition-colors ${
          switchClosed ? "border-primary bg-primary/10" : "border-border bg-card"
        }`}
        onClick={() => setSwitchClosed(!switchClosed)}
      >
        <motion.div
          className="w-6 h-6 rounded-full bg-foreground shadow"
          animate={{ x: switchClosed ? 32 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        />
      </div>
      {/* Bulb */}
      <div className="flex flex-col items-center gap-1">
        <motion.div
          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${
            bulbGlows ? "border-primary bg-primary/20 shadow-[0_0_20px_hsl(var(--primary)/0.6)]" : "border-border bg-card"
          }`}
          animate={{ scale: bulbGlows ? 1.1 : 1 }}
        >
          <CircuitBoard className={`w-5 h-5 ${bulbGlows ? "text-primary" : "text-muted-foreground"}`} />
        </motion.div>
        <span className="text-xs text-muted-foreground">{bulbGlows ? "Glowing!" : "Off"}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">Tap battery, then flip the switch → bulb lights.</p>
    </div>
  );
}

/* ---------- Section wrapper with reveal animation ---------- */
function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.section
      ref={ref}
      className={`py-16 md:py-24 ${className}`}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {children}
    </motion.section>
  );
}

/* ---------- Feature card ---------- */
function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <motion.div whileHover={{ y: -4 }} className="card-hover p-6 rounded-xl border border-border bg-card">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{desc}</p>
    </motion.div>
  );
}

/* ---------- Pricing Card ---------- */
function PricingCard({
  name,
  price,
  period,
  features,
  cta,
  popular,
}: {
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  popular?: boolean;
}) {
  return (
    <Card className={`card-hover relative ${popular ? "border-primary shadow-md shadow-primary/10" : ""}`}>
      {popular && (
        <Badge className="absolute -top-2 right-4 bg-primary text-primary-foreground">Most Popular</Badge>
      )}
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <div className="mt-2">
          <span className="text-3xl font-bold">{price}</span>
          <span className="text-muted-foreground text-sm">/{period}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {features.map((f, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <Star className="h-4 w-4 text-primary flex-shrink-0" />
            {f}
          </div>
        ))}
        <Button className="w-full mt-4">{cta}</Button>
      </CardContent>
    </Card>
  );
}

/* ---------- Early Access Form ---------- */
function EarlyAccessForm() {
  const [submitted, setSubmitted] = useState(false);
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // TODO: send to API
    setSubmitted(true);
  };

  return (
    <div className="max-w-xl mx-auto">
      {submitted ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center p-8 border border-border rounded-xl bg-card"
        >
          <Sparkles className="h-10 w-10 mx-auto text-primary mb-3" />
          <h3 className="text-xl font-semibold">Thank you!</h3>
          <p className="text-muted-foreground">We’ll reach out soon to set up your personalised Aperti workspace.</p>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input required placeholder="Walid Hamza" />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input required type="email" placeholder="walid@example.com" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Estimated Students *</Label>
              <Input required type="number" placeholder="300" />
            </div>
            <div className="space-y-2">
              <Label>Subjects & Boards</Label>
              <Input placeholder="Math 0580 CAIE, Physics 0625" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Anything you’d like Aperti to do for you?</Label>
            <Textarea placeholder="Dream big..." />
          </div>
          <Button type="submit" className="w-full">
            Apply for Early Access
          </Button>
        </form>
      )}
    </div>
  );
}

/* ---------- Main Landing Page ---------- */
export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Aperti<span className="text-primary">.</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#pricing" className="hover:text-primary transition-colors">Pricing</a>
            <a href="#demo" className="hover:text-primary transition-colors">Demo</a>
            <a href="#early-access" className="hover:text-primary transition-colors">Apply</a>
            <Link href="/login"><Button variant="outline" size="sm">Sign in</Button></Link>
          </div>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="md:hidden border-t border-border px-4 py-4 flex flex-col gap-3 text-sm">
            <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <a href="#demo" onClick={() => setMobileMenuOpen(false)}>Demo</a>
            <a href="#early-access" onClick={() => setMobileMenuOpen(false)}>Apply</a>
            <Link href="/login"><Button variant="outline" size="sm" className="w-full">Sign in</Button></Link>
          </motion.div>
        )}
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-16 md:pt-36 md:pb-24 px-4 max-w-7xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <Badge className="mb-4" variant="secondary">Educational Operating System</Badge>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-4">
            Where every mind <br className="hidden sm:block" />
            <span className="text-primary">finds its rhythm.</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg md:text-xl">
            Aperti replaces every tool you juggle — Google Classroom, Zoom, Excel, Quizlet — with one unified,
            intelligent, and beautifully minimal platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
            <Link href="#early-access"><Button size="lg" className="gap-2">Get Early Access <ArrowRight className="h-4 w-4" /></Button></Link>
            <Link href="#demo"><Button variant="outline" size="lg">Watch Demo</Button></Link>
          </div>
        </motion.div>
      </section>

      {/* Interactive Demo */}
      <Section id="demo" className="bg-muted/40">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Badge variant="secondary" className="mb-2">Try it now</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Build a circuit in 10 seconds</h2>
          <p className="text-muted-foreground mb-6">No sign‑up. Just drag, tap, and see physics come alive.</p>
          <CircuitDemo />
        </div>
      </Section>

      {/* Features */}
      <Section id="features">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-2">Core Capabilities</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">Everything in one place</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard icon={<CalendarCheck className="h-5 w-5 text-primary" />} title="CheckIn™" desc="QR attendance, anti‑fraud, auto‑logs." />
            <FeatureCard icon={<BookOpen className="h-5 w-5 text-primary" />} title="PlanGrid™" desc="Smart timetable for online, centre, or hybrid." />
            <FeatureCard icon={<Zap className="h-5 w-5 text-primary" />} title="LiveClass™" desc="Zoom‑level virtual classroom with full host controls." />
            <FeatureCard icon={<Shield className="h-5 w-5 text-primary" />} title="ShieldCore™" desc="Anti‑cheat & behavioral proctoring." />
            <FeatureCard icon={<Users className="h-5 w-5 text-primary" />} title="SubmitFlow™" desc="Homework with auto‑grading & handwriting OCR." />
            <FeatureCard icon={<Globe className="h-5 w-5 text-primary" />} title="PaperVault™" desc="Free public past paper library." />
          </div>
        </div>
      </Section>

      {/* Pricing */}
      <Section id="pricing" className="bg-muted/40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-2">Fair & Flexible</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">Teacher Plans</h2>
            <p className="text-muted-foreground">Per student, per month — scale with FlexSeats™</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <PricingCard name="Starter" price="50 EGP" period="student/mo" features={["Core tools", "Attendance", "Timetable", "10 GB storage"]} cta="Apply now" />
            <PricingCard name="Professional" price="100 EGP" period="student/mo" features={["Full GradeFlow™", "LiveClass™ (50)", "InkSpace™", "50 GB"]} cta="Apply now" popular />
            <PricingCard name="Enterprise" price="150 EGP" period="student/mo" features={["LiveClass™ (200)", "TeamForge™", "Priority support", "100 GB"]} cta="Apply now" />
            <PricingCard name="Master" price="200 EGP" period="student/mo" features={["Unlimited everything", "Dedicated account manager", "White‑label"]} cta="Apply now" />
          </div>
          <p className="text-center text-sm text-muted-foreground mt-6">
            Volume discounts & FlexSeats™ available. Student independent plans also offered.{" "}
            <Link href="/pricing" className="text-primary underline underline-offset-2">Full details</Link>
          </p>
        </div>
      </Section>

      {/* Early Access */}
      <Section id="early-access">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <Badge variant="secondary" className="mb-2">Teachers first</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Be one of the first on Aperti</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            We’re onboarding a handful of dedicated teachers. Tell us about your needs and we’ll build your workspace together.
          </p>
          <EarlyAccessForm />
        </div>
      </Section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <span>© 2026 Aperti™ — Where every mind finds its rhythm.</span>
          <div className="flex gap-4">
            <a href="/terms" className="hover:text-foreground">Terms</a>
            <a href="/privacy" className="hover:text-foreground">Privacy</a>
            <a href="/contact" className="hover:text-foreground">Contact</a>
            <a href="mailto:info@aperti.ai" className="hover:text-foreground">info@aperti.ai</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
