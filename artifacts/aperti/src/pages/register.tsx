import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, Check, ArrowLeft, ArrowRight, Globe, User, GraduationCap, Users } from "lucide-react";
import { Label } from "@/components/ui/label";


const ROLES = [
  { id: "teacher", title: "Teacher / Tutor", description: "Create courses, manage students, assessments, and analytics.", icon: GraduationCap, gradient: "from-primary to-cyan-50" },
  { id: "student", title: "Student / Learner", description: "Access courses, assignments, revision tools, and AI tutoring.", icon: User, gradient: "from-primary to-emerald-50" },
  { id: "parent", title: "Parent / Guardian", description: "Monitor your child's progress, attendance, and reports.", icon: Users, gradient: "from-primary to-sky-50" },
];

const COUNTRIES = ["Egypt","Saudi Arabia","UAE","United Kingdom","United States","Canada","Australia","Germany","France","Other"];

/* ── Password strength ──────────────────────────────────────────────────────── */
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = [password.length >= 8, /[A-Z]/.test(password), /\d/.test(password), /[!@#$%^&*]/.test(password)];
  const score = checks.filter(Boolean).length;
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e"];
  const labels = ["Weak", "Fair", "Good", "Strong"];
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[0,1,2,3].map(i => (
          <motion.div key={i} className="h-1 flex-1 rounded-full"
            animate={{ background: i < score ? colors[score - 1] : "#e5e7eb" }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.p key={score} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
          className="text-xs font-medium" style={{ color: colors[score - 1] }}>
          {labels[score - 1]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/* ── Floating background orb ────────────────────────────────────────────────── */
function Orb({ x, y, size, delay, duration }: { x: string; y: string; size: number; delay: number; duration: number }) {
  return (
    <motion.div className="absolute rounded-full pointer-events-none"
      style={{ left: x, top: y, width: size, height: size, background: `radial-gradient(circle, ${"hsl(var(--primary))"}1a, transparent 70%)` }}
      animate={{ y: [0, -25, 0], x: [0, 12, 0], scale: [1, 1.08, 1] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/* ── Animated text input ────────────────────────────────────────────────────── */
function Field({ label, type = "text", value, onChange, placeholder, children, error }: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder: string; children?: React.ReactNode; error?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="w-full h-11 px-4 rounded-xl text-sm text-slate-900 bg-white outline-none transition-all duration-200 border"
          style={{
            borderColor: error ? "#f87171" : focused ? "hsl(var(--primary))" : value ? "#94a3b8" : "#e2e8f0",
            boxShadow: focused ? `0 0 0 3px ${error ? "#f8717118" : "hsl(var(--primary))" + "18"}` : "none",
          }}
        />
        {children}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} className="text-xs text-red-500">{error}</motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Step indicator ─────────────────────────────────────────────────────────── */
function StepBar({ step }: { step: number }) {
  const labels = ["Role", "Details", "Confirm"];
  return (
    <div className="flex items-center gap-0">
      {labels.map((label, i) => {
        const s = i + 1;
        const done = step > s;
        const active = step === s;
        return (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <motion.div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                animate={{
                  background: done || active ? "hsl(var(--primary))" : "#e5e7eb",
                  color: done || active ? "#fff" : "#94a3b8",
                  scale: active ? 1.1 : 1,
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <AnimatePresence mode="wait">
                  {done ? (
                    <motion.span key="check" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
                      <Check className="w-4 h-4" />
                    </motion.span>
                  ) : (
                    <motion.span key={s} initial={{ scale: 0 }} animate={{ scale: 1 }}>{s}</motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
              <span className="text-[10px] font-medium" style={{ color: active ? "hsl(var(--primary))" : "#94a3b8" }}>{label}</span>
            </div>
            {s < 3 && (
              <div className="w-10 h-px mx-2 mb-4 rounded-full overflow-hidden bg-gray-200">
                <motion.div className="h-full rounded-full" style={{ background: "hsl(var(--primary))" }}
                  animate={{ width: step > s ? "100%" : "0%" }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────────── */
export default function Register() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [role, setRole] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", username: "", email: "", password: "", confirmPassword: "", country: "" });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const set = (k: string, v: string) => { setError(""); setForm(p => ({ ...p, [k]: v })); };

  const validateStep2 = () => {
    if (!form.firstName.trim()) return "First name is required";
    if (!form.lastName.trim()) return "Last name is required";
    if (!form.username.trim()) return "Username is required";
    if (!/^[a-z0-9_]{3,20}$/.test(form.username.trim())) return "Username must be 3–20 characters (letters, numbers, underscores only)";
    if (!form.email.includes("@")) return "Enter a valid email address";
    if (form.password.length < 8) return "Password must be at least 8 characters";
    if (form.password !== form.confirmPassword) return "Passwords do not match";
    return "";
  };

  const goTo = (s: number) => { setDirection(s > step ? 1 : -1); setStep(s); setError(""); };

  const handleNext = () => {
    if (step === 1) { if (!role) { setError("Please choose a role to continue"); return; } goTo(2); }
    else if (step === 2) { const e = validateStep2(); if (e) { setError(e); return; } goTo(3); }
  };

  const handleSubmit = async () => {
    if (!agreed) { setError("Please agree to the Terms of Service to continue"); return; }
    setError(""); setSubmitting(true);
    try {
      const res = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName: form.firstName.trim(), lastName: form.lastName.trim(),
          username: form.username.trim().toLowerCase(),
          email: form.email.toLowerCase().trim(), password: form.password, role, country: form.country,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Registration failed. Please try again."); return; }
      setSuccess(true);
      setTimeout(() => { window.location.href = "/"; }, 900);
    } catch { setError("Network error. Please check your connection and try again."); }
    finally { setSubmitting(false); }
  };

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 48 : -48, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -48 : 48, opacity: 0 }),
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #f0fdfa 0%, #f8fafc 50%, #f0f9ff 100%)", fontFamily: "Inter, sans-serif" }}
    >
      {/* Background orbs */}
      <Orb x="5%"  y="10%" size={350} delay={0}   duration={9} />
      <Orb x="70%" y="5%"  size={220} delay={1.5} duration={11} />
      <Orb x="80%" y="65%" size={260} delay={2.5} duration={8} />
      <Orb x="2%"  y="70%" size={160} delay={1}   duration={10} />

      {/* Grid dots */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: `radial-gradient(circle, ${"hsl(var(--primary))"}0a 1px, transparent 1px)`, backgroundSize: "28px 28px" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 36, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 26 }}
        className="relative z-10 w-full max-w-lg"
      >
        {/* Card */}
        <div
          className="bg-white/85 backdrop-blur-xl rounded-2xl border shadow-xl shadow-primary/10 overflow-hidden"
          style={{ borderColor: "rgba(0,121,107,0.12)" }}
        >
          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: "#f0fdfa" }}>
            <Link href="/" className="text-xl font-extrabold block mb-5 select-none" style={{ color: "hsl(var(--primary))" }}>
              Aperti<span className="opacity-60">.</span>
            </Link>
            <StepBar step={step} />
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="mt-5"
              >
                <h1 className="text-2xl font-bold text-gray-900">
                  {step === 1 && "Choose your role"}
                  {step === 2 && "Create your account"}
                  {step === 3 && "Almost there"}
                </h1>
                <p className="text-gray-400 text-sm mt-1">
                  {step === 1 && "Tell us how you'll use Aperti."}
                  {step === 2 && "Fill in your details to get started."}
                  {step === 3 && "Review and confirm your account."}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Body */}
          <div className="px-8 py-6 min-h-[340px] overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              {step === 1 && (
                <motion.div key="s1" custom={direction} variants={slideVariants}
                  initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-3"
                >
                  {ROLES.map((r, i) => {
                    const Icon = r.icon;
                    const selected = role === r.id;
                    return (
                      <motion.button
                        key={r.id}
                        onClick={() => { setRole(r.id); setError(""); }}
                        className={`w-full text-left p-4 rounded-xl border-2 flex items-start gap-4 transition-colors`}
                        style={{
                          borderColor: selected ? "hsl(var(--primary))" : "#e5e7eb",
                          background: selected ? TEAL_LIGHT : "#fafafa",
                        }}
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        whileHover={{ scale: 1.01, boxShadow: selected ? `0 4px 20px ${"hsl(var(--primary))"}22` : "0 2px 12px rgba(0,0,0,0.06)" }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: selected ? "hsl(var(--primary))" : "#e5e7eb" }}>
                          <Icon className="w-5 h-5" style={{ color: selected ? "#fff" : "#64748b" }} />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 text-sm">{r.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{r.description}</p>
                        </div>
                        <AnimatePresence>
                          {selected && (
                            <motion.div
                              initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}
                              transition={{ type: "spring", stiffness: 400, damping: 20 }}
                              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ background: "hsl(var(--primary))" }}
                            >
                              <Check className="w-3.5 h-3.5 text-white" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="s2" custom={direction} variants={slideVariants}
                  initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="First name" value={form.firstName} onChange={v => set("firstName", v)} placeholder="Jane" />
                    <Field label="Last name" value={form.lastName} onChange={v => set("lastName", v)} placeholder="Smith" />
                  </div>
                  <Field label="Username" value={form.username} onChange={v => set("username", v.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="e.g. jane_smith" />
                  <Field label="Email address" type="email" value={form.email} onChange={v => set("email", v)} placeholder="jane@example.com" />
                  <div>
                    <Field label="Password" type={showPw ? "text" : "password"} value={form.password} onChange={v => set("password", v)} placeholder="At least 8 characters">
                      <button type="button" onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </Field>
                    <PasswordStrength password={form.password} />
                  </div>
                  <Field
                    label="Confirm password"
                    type={showConfirm ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={v => set("confirmPassword", v)}
                    placeholder="Repeat password"
                    error={form.confirmPassword && form.password !== form.confirmPassword ? "Passwords do not match" : ""}
                  >
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </Field>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Globe className="w-3 h-3" /> Country
                    </label>
                    <select value={form.country} onChange={e => set("country", e.target.value)}
                      className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm text-gray-900 focus:outline-none bg-white transition-all duration-200"
                      style={{ borderColor: form.country ? "#94a3b8" : "#e2e8f0" }}
                      onFocus={e => (e.target.style.boxShadow = `0 0 0 3px ${"hsl(var(--primary))"}18`, e.target.style.borderColor = "hsl(var(--primary))")}
                      onBlur={e => (e.target.style.boxShadow = "none", e.target.style.borderColor = form.country ? "#94a3b8" : "#e2e8f0")}
                    >
                      <option value="">Select country</option>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="s3" custom={direction} variants={slideVariants}
                  initial="enter" animate="center" exit="exit"
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-5"
                >
                  {/* Summary card */}
                  <motion.div
                    className="rounded-xl p-4 border space-y-3"
                    style={{ background: TEAL_LIGHT, borderColor: `${"hsl(var(--primary))"}22` }}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "hsl(var(--primary))" }}>Account summary</p>
                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                      {[
                        ["Name", `${form.firstName} ${form.lastName}`],
                        ["Username", `@${form.username}`],
                        ["Email", form.email],
                        ["Role", role],
                        ...(form.country ? [["Country", form.country]] : []),
                      ].map(([k, v], i) => (
                        <motion.div key={k} className="contents"
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.15 + i * 0.06 }}>
                          <span className="text-gray-400">{k}</span>
                          <span className="font-semibold text-gray-800 truncate">{v}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Agreement */}
                  <motion.label
                    className="flex items-start gap-3 cursor-pointer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <motion.div
                      onClick={() => setAgreed(!agreed)}
                      className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-200"
                      style={agreed ? { background: "hsl(var(--primary))", borderColor: "hsl(var(--primary))" } : { borderColor: "#d1d5db" }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <AnimatePresence>
                        {agreed && (
                          <motion.span key="ck" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
                            <Check className="w-3 h-3 text-white" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.div>
                    <span className="text-sm text-gray-500 leading-relaxed">
                      I agree to the{" "}
                      <Link href="/terms" className="font-semibold hover:underline" style={{ color: "hsl(var(--primary))" }}>Terms of Service</Link>
                      {" "}and{" "}
                      <Link href="/privacy" className="font-semibold hover:underline" style={{ color: "hsl(var(--primary))" }}>Privacy Policy</Link>
                    </span>
                  </motion.label>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 overflow-hidden"
                      >
                        <span>⚠️</span><span>{error}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-8 pb-6 space-y-3">
            <AnimatePresence>
              {error && step < 3 && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-xs text-red-500 text-right overflow-hidden">{error}</motion.p>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between">
              <motion.button
                onClick={() => step > 1 ? goTo(step - 1) : setLocation("/login")}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors font-medium px-3 py-2 rounded-xl hover:bg-gray-50"
                whileTap={{ scale: 0.97 }}
              >
                <ArrowLeft className="w-4 h-4" />{step === 1 ? "Sign in" : "Back"}
              </motion.button>

              {step < 3 ? (
                <motion.button
                  onClick={handleNext}
                  className="flex items-center gap-1.5 text-sm font-semibold text-white px-5 py-2.5 rounded-xl relative overflow-hidden"
                  style={{ background: "hsl(var(--primary))" }}
                  whileHover={{ scale: 1.03, boxShadow: `0 6px 20px ${"hsl(var(--primary))"}40` }}
                  whileTap={{ scale: 0.97 }}
                >
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)" }}
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "linear", repeatDelay: 0.8 }}
                  />
                  Continue <ArrowRight className="w-4 h-4" />
                </motion.button>
              ) : (
                <motion.button
                  onClick={handleSubmit}
                  disabled={submitting || !agreed}
                  className="flex items-center gap-2 text-sm font-semibold text-white px-6 py-2.5 rounded-xl min-w-[150px] justify-center relative overflow-hidden"
                  style={{ background: agreed ? "hsl(var(--primary))" : "#94a3b8", cursor: agreed ? "pointer" : "not-allowed" }}
                  whileHover={agreed ? { scale: 1.03, boxShadow: `0 6px 20px ${"hsl(var(--primary))"}40` } : {}}
                  whileTap={agreed ? { scale: 0.97 } : {}}
                >
                  <AnimatePresence mode="wait">
                    {success ? (
                      <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                        <Check className="w-4 h-4" /> Account created!
                      </motion.span>
                    ) : submitting ? (
                      <motion.span key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Creating…
                      </motion.span>
                    ) : (
                      <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Create account</motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              )}
            </div>
          </div>

          <p className="text-center text-sm text-gray-400 pb-6">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold hover:underline" style={{ color: "hsl(var(--primary))" }}>Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
