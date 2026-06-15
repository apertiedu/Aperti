import { useState, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, GraduationCap, CheckCircle2, ArrowLeft, User, Mail, Lock, School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TEAL = "#0D9488";
const TEAL_LIGHT = "#E6F4F1";

interface Teacher {
  id: number;
  display_name: string;
  username: string;
}

export default function StudentRegister() {
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    teacherId: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const { data: teachers } = useQuery<Teacher[]>({
    queryKey: ["public-teachers"],
    queryFn: async () => {
      const res = await fetch("/auth/public-teachers");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (!form.teacherId) { setError("Please select your teacher"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/auth/student-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName,
          username: form.username.toLowerCase().trim(),
          email: form.email.toLowerCase().trim(),
          password: form.password,
          teacherId: parseInt(form.teacherId),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Registration failed"); return; }
      setSuccess(true);
    } catch { setError("Network error. Please try again."); }
    finally { setSubmitting(false); }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F5F5F5" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card rounded-2xl shadow-sm border border-border p-10 max-w-md w-full text-center mx-4"
        >
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: TEAL_LIGHT }}>
            <CheckCircle2 className="h-8 w-8" style={{ color: TEAL }} />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Registration Submitted!</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            Your account is now <strong>pending approval</strong> from your teacher. You will be able to log in once they approve your request.
          </p>
          <Link href="/login">
            <Button className="w-full h-11 rounded-xl" style={{ background: TEAL }}>
              Back to Sign In
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#F5F5F5" }}>
      {/* Left side */}
      <div className="hidden lg:flex flex-col justify-center px-12 flex-1 max-w-lg" style={{ background: TEAL }}>
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <Link href="/">
            <div className="flex items-center gap-2 mb-12 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <GraduationCap className="h-4 w-4 text-white" />
              </div>
              <span className="text-white font-extrabold text-lg">Aperti<span className="opacity-60">.</span></span>
            </div>
          </Link>
          <h2 className="text-3xl font-extrabold text-white mb-4 leading-tight">
            Join your teacher's<br />workspace today.
          </h2>
          <p className="text-white/70 text-sm leading-relaxed mb-8">
            Register as a student, select your teacher, and start learning with on-demand courses, AI mentoring, and smart flashcards.
          </p>
          <div className="space-y-3">
            {["Live interactive lessons", "AI-powered mentor", "Smart flashcards & quizzes", "Real-time attendance tracking"].map((f, i) => (
              <motion.div key={f} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.08 }}
                className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-3 w-3 text-white" />
                </div>
                <span className="text-white/90 text-sm">{f}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right side — Form */}
      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Link href="/login">
            <button className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-8 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
            </button>
          </Link>

          <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
            <div className="mb-7">
              <h1 className="text-2xl font-extrabold text-gray-900">Create your account</h1>
              <p className="text-sm text-gray-400 mt-1">Student registration — pending teacher approval</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                  <Input className="pl-9 h-11 rounded-xl border-gray-200" placeholder="Your full name" required maxLength={150}
                    value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600">Username</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm">@</span>
                  <Input className="pl-8 h-11 rounded-xl border-gray-200" placeholder="username" required maxLength={80}
                    value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600">Email (optional)</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                  <Input type="email" className="pl-9 h-11 rounded-xl border-gray-200" placeholder="you@example.com"
                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600">Select Teacher</Label>
                <div className="relative">
                  <School className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                  <select required value={form.teacherId}
                    onChange={e => setForm(f => ({ ...f, teacherId: e.target.value }))}
                    className="w-full pl-9 pr-4 h-11 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                    <option value="">— Select your teacher —</option>
                    {(teachers || []).map(t => (
                      <option key={t.id} value={t.id}>{t.display_name || t.username}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-600">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
                    <Input type={showPw ? "text" : "password"} className="pl-9 pr-9 h-11 rounded-xl border-gray-200"
                      placeholder="••••••••" required minLength={6} maxLength={500}
                      value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300"
                      onClick={() => setShowPw(s => !s)}>
                      {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-600">Confirm</Label>
                  <Input type="password" className="h-11 rounded-xl border-gray-200"
                    placeholder="••••••••" required maxLength={500}
                    value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} />
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <Button type="submit" className="w-full h-11 rounded-xl font-semibold mt-2" style={{ background: TEAL }}
                disabled={submitting}>
                {submitting ? "Creating account…" : "Create Account"}
              </Button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-5">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold hover:underline" style={{ color: TEAL }}>Sign in</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
