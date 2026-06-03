import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, Check, ArrowLeft, ArrowRight, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TEAL = "#0D9488";

const ROLES = [
  { id: "teacher", title: "Teacher / Tutor", description: "Create courses, manage students, assessments, and analytics.", emoji: "🎓" },
  { id: "student", title: "Student / Learner", description: "Access courses, assignments, revision tools, and AI tutoring.", emoji: "📚" },
  { id: "parent", title: "Parent / Guardian", description: "Monitor your child's progress, attendance, and reports.", emoji: "👨‍👩‍👧" },
];

const COUNTRIES = ["Egypt","Saudi Arabia","UAE","United Kingdom","United States","Canada","Australia","Germany","France","Other"];

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[!@#$%^&*]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const colors = ["#ef4444","#f97316","#eab308","#22c55e"];
  const labels = ["Weak","Fair","Good","Strong"];
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0,1,2,3].map(i => (
          <div key={i} className="h-1.5 flex-1 rounded-full transition-all duration-300"
            style={{ background: i < score ? colors[score-1] : "#e5e7eb" }} />
        ))}
      </div>
      <p className="text-xs font-medium" style={{ color: colors[score-1] }}>{labels[score-1]}</p>
    </div>
  );
}

export default function Register() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState("");
  const [form, setForm] = useState({ firstName:"", lastName:"", email:"", password:"", confirmPassword:"", country:"", phone:"" });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => { setError(""); setForm(p => ({ ...p, [k]: v })); };

  const validateStep2 = () => {
    if (!form.firstName.trim()) return "First name is required";
    if (!form.lastName.trim()) return "Last name is required";
    if (!form.email.includes("@")) return "Enter a valid email address";
    if (form.password.length < 8) return "Password must be at least 8 characters";
    if (form.password !== form.confirmPassword) return "Passwords do not match";
    return "";
  };

  const handleSubmit = async () => {
    if (!agreed) { setError("Please agree to the Terms of Service to continue"); return; }
    setError(""); setSubmitting(true);
    try {
      const res = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.toLowerCase().trim(), password: form.password, role, country: form.country, phone: form.phone }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Registration failed. Please try again."); return; }
      localStorage.setItem("aperti_token", data.token);
      window.location.href = "/onboarding";
    } catch { setError("Network error. Please check your connection and try again."); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#F5F5F5", fontFamily: "Inter, sans-serif" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-5" style={{ background: TEAL, filter: "blur(120px)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-5" style={{ background: TEAL, filter: "blur(80px)" }} />
      </div>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-100">
          <Link href="/" className="text-xl font-bold block mb-6" style={{ color: TEAL }}>Aperti.</Link>
          <div className="flex items-center gap-2 mb-5">
            {[1,2,3].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${step >= s ? "text-white" : "bg-gray-100 text-gray-400"}`}
                  style={step >= s ? { background: TEAL } : {}}>
                  {step > s ? <Check className="w-4 h-4" /> : s}
                </div>
                {s < 3 && <div className="h-px w-10 transition-all duration-300" style={{ background: step > s ? TEAL : "#e5e7eb" }} />}
              </div>
            ))}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {step === 1 && "Choose your role"}
            {step === 2 && "Create your account"}
            {step === 3 && "Almost there"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {step === 1 && "Tell us how you'll use Aperti."}
            {step === 2 && "Fill in your details to get started."}
            {step === 3 && "Review and agree to create your account."}
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-6 min-h-[320px]">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                {ROLES.map(r => (
                  <button key={r.id} onClick={() => setRole(r.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-start gap-4 ${role === r.id ? "border-teal-600" : "border-gray-200 hover:border-gray-300"}`}
                    style={role === r.id ? { background: "#f0fdfa" } : {}}>
                    <span className="text-2xl">{r.emoji}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{r.title}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{r.description}</p>
                    </div>
                    {role === r.id && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: TEAL }}>
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </motion.div>
            )}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-1.5 block">First name</Label>
                    <Input value={form.firstName} onChange={e => set("firstName", e.target.value)} placeholder="Jane" className="h-11 rounded-xl border-gray-200" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Last name</Label>
                    <Input value={form.lastName} onChange={e => set("lastName", e.target.value)} placeholder="Smith" className="h-11 rounded-xl border-gray-200" />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Email address</Label>
                  <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="jane@example.com" className="h-11 rounded-xl border-gray-200" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Password</Label>
                  <div className="relative">
                    <Input type={showPw ? "text" : "password"} value={form.password} onChange={e => set("password", e.target.value)} placeholder="At least 8 characters" className="h-11 rounded-xl border-gray-200 pr-10" />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <PasswordStrength password={form.password} />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1.5 block">Confirm password</Label>
                  <div className="relative">
                    <Input type={showConfirm ? "text" : "password"} value={form.confirmPassword} onChange={e => set("confirmPassword", e.target.value)} placeholder="Repeat password" className="h-11 rounded-xl border-gray-200 pr-10" />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {form.confirmPassword && form.password !== form.confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1 block">
                    <Globe className="w-3.5 h-3.5" /> Country
                  </Label>
                  <select value={form.country} onChange={e => set("country", e.target.value)}
                    className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm text-gray-900 focus:outline-none focus:border-teal-600 bg-white">
                    <option value="">Select country</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </motion.div>
            )}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                  <p className="text-sm font-semibold text-gray-700">Account summary</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-gray-500">Name</span><span className="font-medium">{form.firstName} {form.lastName}</span>
                    <span className="text-gray-500">Email</span><span className="font-medium truncate">{form.email}</span>
                    <span className="text-gray-500">Role</span><span className="font-medium capitalize">{role}</span>
                    {form.country && <><span className="text-gray-500">Country</span><span className="font-medium">{form.country}</span></>}
                  </div>
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <div onClick={() => setAgreed(!agreed)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-200 ${agreed ? "" : "border-gray-300 hover:border-teal-400"}`}
                    style={agreed ? { background: TEAL, borderColor: TEAL } : {}}>
                    {agreed && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm text-gray-600 leading-relaxed">
                    I agree to the{" "}
                    <Link href="/terms" className="font-medium hover:underline" style={{ color: TEAL }}>Terms of Service</Link>
                    {" "}and{" "}
                    <Link href="/privacy" className="font-medium hover:underline" style={{ color: TEAL }}>Privacy Policy</Link>
                  </span>
                </label>
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
                    <span>⚠️</span><span>{error}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-8 pb-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => step > 1 ? setStep(s => s - 1) : setLocation("/login")}
              className="text-gray-500 gap-1.5 hover:text-gray-700">
              <ArrowLeft className="w-4 h-4" />{step === 1 ? "Sign in" : "Back"}
            </Button>
            {step < 3 ? (
              <Button onClick={() => {
                if (step === 1) { if (!role) { setError("Please choose a role to continue"); return; } setError(""); setStep(2); }
                else if (step === 2) { const e = validateStep2(); if (e) { setError(e); return; } setError(""); setStep(3); }
              }} className="gap-1.5 rounded-xl" style={{ background: TEAL }}
                disabled={step === 1 && !role}>
                Continue <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting || !agreed}
                className="gap-1.5 rounded-xl min-w-[140px]" style={{ background: TEAL }}>
                {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Create account"}
              </Button>
            )}
          </div>
          {error && step < 3 && (
            <p className="text-xs text-red-500 mt-2 text-right">{error}</p>
          )}
        </div>
        <p className="text-center text-sm text-gray-500 pb-6">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold hover:underline" style={{ color: TEAL }}>Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
