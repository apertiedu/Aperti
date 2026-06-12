import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, AlertCircle, CheckCircle2, KeyRound } from "lucide-react";

const TEAL = "#0D9488";

export default function ResetPassword() {
  const [location] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) setError("No reset token found. Please request a new reset link.");
  }, [token]);

  const strength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "#ef4444", "#f59e0b", "#3b82f6", TEAL][strength];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "#F5F5F5", fontFamily: "Inter, sans-serif" }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-5" style={{ background: TEAL, filter: "blur(120px)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-5" style={{ background: TEAL, filter: "blur(80px)" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring" as const, stiffness: 200, damping: 22 }}
        className="w-full max-w-sm relative"
      >
        <div className="text-center mb-8">
          <Link href="/">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 cursor-pointer">
              Aperti<span style={{ color: TEAL }}>.</span>
            </h1>
          </Link>
          <p className="text-slate-500 text-sm mt-1">Where every mind finds its rhythm.</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-2"
              >
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "#E6F4F1" }}>
                    <CheckCircle2 className="h-7 w-7" style={{ color: TEAL }} />
                  </div>
                </div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">Password updated!</h2>
                <p className="text-sm text-slate-500 mb-6">Your password has been changed. You can now sign in with your new password.</p>
                <Link href="/login">
                  <Button className="w-full rounded-xl h-11 font-semibold text-white" style={{ background: TEAL }}>
                    Sign in
                  </Button>
                </Link>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#E6F4F1" }}>
                    <KeyRound className="h-4 w-4" style={{ color: TEAL }} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 leading-tight">Choose a new password</h2>
                    <p className="text-xs text-slate-500">Must be at least 8 characters.</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-slate-700 text-sm font-medium">New password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        autoFocus
                        placeholder="At least 8 characters"
                        className="rounded-xl border-slate-200 focus-visible:ring-teal-600 h-10 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {password && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1.5">
                        <div className="flex gap-1 mb-1">
                          {[1, 2, 3, 4].map(i => (
                            <div
                              key={i}
                              className="h-1 flex-1 rounded-full transition-colors duration-300"
                              style={{ background: i <= strength ? strengthColor : "#e2e8f0" }}
                            />
                          ))}
                        </div>
                        <p className="text-xs" style={{ color: strengthColor }}>{strengthLabel}</p>
                      </motion.div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm" className="text-slate-700 text-sm font-medium">Confirm password</Label>
                    <Input
                      id="confirm"
                      type={showPassword ? "text" : "password"}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                      placeholder="Re-enter your password"
                      className="rounded-xl border-slate-200 focus-visible:ring-teal-600 h-10"
                    />
                    {confirm && password !== confirm && (
                      <p className="text-xs text-red-500">Passwords don't match</p>
                    )}
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100"
                      >
                        <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-red-600">{error}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Button
                    type="submit"
                    disabled={isSubmitting || !password || !confirm || !token}
                    className="w-full rounded-xl h-11 font-semibold text-white mt-2"
                    style={{ background: isSubmitting ? "#4DB6AC" : TEAL }}
                  >
                    {isSubmitting ? (
                      <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                        Updating…
                      </motion.span>
                    ) : (
                      "Update password"
                    )}
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-6 text-center text-xs text-slate-300">
          <Link href="/login" className="hover:text-slate-500 transition-colors">← Back to sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
