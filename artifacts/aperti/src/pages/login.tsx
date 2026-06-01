import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth";
import { useLocation, Link } from "wouter";
import { Eye, EyeOff, AlertCircle, ShieldCheck, RefreshCw } from "lucide-react";

const TEAL = "#00796B";

function generateCaptcha() {
  const ops = ["+", "-"] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  const a = Math.floor(Math.random() * 9) + 1;
  const b = op === "-" ? Math.floor(Math.random() * a) + 1 : Math.floor(Math.random() * 9) + 1;
  return { a, b, op, answer: op === "+" ? a + b : a - b };
}

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captcha, setCaptcha] = useState(generateCaptcha);
  const [captchaInput, setCaptchaInput] = useState("");
  const [attempts, setAttempts] = useState(0);

  const captchaValid = useMemo(
    () => parseInt(captchaInput, 10) === captcha.answer,
    [captchaInput, captcha.answer]
  );

  const refreshCaptcha = () => {
    setCaptcha(generateCaptcha());
    setCaptchaInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!captchaValid) {
      setError("Please solve the security check correctly.");
      refreshCaptcha();
      return;
    }

    setIsSubmitting(true);
    try {
      await login(username.trim(), password);
      setLocation("/");
    } catch (err: any) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setError(err.message || "Invalid credentials. Please try again.");
      refreshCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "#F5F5F5", fontFamily: "Inter, sans-serif" }}
    >
      {/* Background subtle pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-5"
          style={{ background: TEAL, filter: "blur(120px)" }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-5"
          style={{ background: TEAL, filter: "blur(80px)" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring" as const, stiffness: 200, damping: 22 }}
        className="w-full max-w-sm relative"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 cursor-pointer">
              Aperti<span style={{ color: TEAL }}>.</span>
            </h1>
          </Link>
          <p className="text-slate-500 text-sm mt-1">Where every mind finds its rhythm.</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Sign in to your workspace</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-slate-700 text-sm font-medium">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
                autoFocus
                placeholder="Enter your username"
                className="rounded-xl border-slate-200 focus-visible:ring-teal-600 h-10"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-700 text-sm font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
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
            </div>

            {/* CAPTCHA */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-slate-700 text-sm font-medium flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" style={{ color: TEAL }} />
                  Security check
                </Label>
                <button
                  type="button"
                  onClick={refreshCaptcha}
                  className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="h-3 w-3" /> New
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="flex-shrink-0 rounded-xl px-4 py-2 text-sm font-mono font-bold select-none"
                  style={{ background: "#E6F4F1", color: TEAL, letterSpacing: "0.1em" }}
                >
                  {captcha.a} {captcha.op} {captcha.b} = ?
                </div>
                <Input
                  type="number"
                  value={captchaInput}
                  onChange={e => setCaptchaInput(e.target.value)}
                  placeholder="Answer"
                  required
                  className="rounded-xl border-slate-200 focus-visible:ring-teal-600 h-10 w-24"
                />
                {captchaInput && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`text-lg ${captchaValid ? "text-teal-600" : "text-red-400"}`}
                  >
                    {captchaValid ? "✓" : "✗"}
                  </motion.span>
                )}
              </div>
            </div>

            {/* Error */}
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

            {/* Submit */}
            <Button
              type="submit"
              disabled={isSubmitting || !username || !password || !captchaInput}
              className="w-full rounded-xl h-11 font-semibold text-white mt-2"
              style={{ background: isSubmitting ? "#4DB6AC" : TEAL }}
            >
              {isSubmitting ? (
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  Signing in…
                </motion.span>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          {attempts >= 3 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 text-center text-xs text-amber-600"
            >
              Multiple failed attempts detected. Please check your credentials.
            </motion.p>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-slate-400">
          Need access?{" "}
          <a href="mailto:info@aperti.ai" style={{ color: TEAL }} className="font-medium hover:underline">
            Contact your administrator
          </a>
        </p>
        <p className="mt-2 text-center text-xs text-slate-300">
          <Link href="/" className="hover:text-slate-500 transition-colors">← Back to home</Link>
        </p>
      </motion.div>
    </div>
  );
}
