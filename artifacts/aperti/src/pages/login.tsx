import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth";
import { useLocation, Link } from "wouter";
import { Eye, EyeOff, AlertCircle, ShieldCheck, RefreshCw, ArrowRight } from "lucide-react";

const TEAL = "#00796B";
const TEAL_LIGHT = "#E6F4F1";

function generateCaptcha() {
  const ops = ["+", "-"] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  const a = Math.floor(Math.random() * 9) + 1;
  const b = op === "-" ? Math.floor(Math.random() * a) + 1 : Math.floor(Math.random() * 9) + 1;
  return { a, b, op, answer: op === "+" ? a + b : a - b };
}

/* ── Floating orb ───────────────────────────────────────────────────────────── */
function FloatingOrb({ x, y, size, delay, duration }: { x: string; y: string; size: number; delay: number; duration: number }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{ left: x, top: y, width: size, height: size, background: `radial-gradient(circle, ${TEAL}22, transparent 70%)` }}
      animate={{ y: [0, -30, 0], x: [0, 15, 0], scale: [1, 1.1, 1] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/* ── Animated input wrapper ─────────────────────────────────────────────────── */
function FloatField({
  id, label, type, value, onChange, placeholder, autoComplete, autoFocus, children, index,
}: {
  id: string; label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder: string;
  autoComplete?: string; autoFocus?: boolean; children?: React.ReactNode; index: number;
}) {
  const [focused, setFocused] = useState(false);
  const filled = value.length > 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-1.5"
    >
      <Label htmlFor={id} className="text-slate-600 text-xs font-semibold uppercase tracking-wider">{label}</Label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className="w-full h-11 px-4 rounded-xl text-sm text-slate-900 bg-white outline-none transition-all duration-200 border"
          style={{
            borderColor: focused ? TEAL : filled ? "#94a3b8" : "#e2e8f0",
            boxShadow: focused ? `0 0 0 3px ${TEAL}18` : "none",
          }}
        />
        {children}
        {/* focus bar */}
        <motion.div
          className="absolute bottom-0 left-4 right-4 h-px rounded-full pointer-events-none"
          style={{ background: TEAL }}
          animate={{ scaleX: focused ? 1 : 0, opacity: focused ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          initial={{ scaleX: 0, opacity: 0 }}
        />
      </div>
    </motion.div>
  );
}

/* ── Shake wrapper ──────────────────────────────────────────────────────────── */
function Shake({ trigger, children }: { trigger: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      animate={trigger ? { x: [-6, 6, -4, 4, -2, 2, 0] } : {}}
      transition={{ duration: 0.4 }}
    >
      {children}
    </motion.div>
  );
}

/* ── Spinning dots loader ───────────────────────────────────────────────────── */
function Spinner() {
  return (
    <span className="flex items-center gap-1.5">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-white block"
          animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.7, delay: i * 0.12, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captcha, setCaptcha] = useState(generateCaptcha);
  const [captchaInput, setCaptchaInput] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [success, setSuccess] = useState(false);

  const captchaValid = useMemo(
    () => parseInt(captchaInput, 10) === captcha.answer,
    [captchaInput, captcha.answer]
  );

  const refreshCaptcha = () => { setCaptcha(generateCaptcha()); setCaptchaInput(""); };

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 500); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!captchaValid) {
      setError("Please solve the security check correctly.");
      refreshCaptcha();
      triggerShake();
      return;
    }
    setIsSubmitting(true);
    try {
      const loggedInUser = await login(username.trim(), password);
      setSuccess(true);
      const dest =
        loggedInUser.role === "admin" || loggedInUser.role === "assistant" ? "/admin/command" : "/";
      setTimeout(() => setLocation(dest), 600);
    } catch (err: any) {
      setAttempts(a => a + 1);
      setError(err.message || "Invalid credentials. Please try again.");
      refreshCaptcha();
      triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = !isSubmitting && username && password && captchaInput;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #f0fdfa 0%, #f8fafc 50%, #f0f9ff 100%)", fontFamily: "Inter, sans-serif" }}
    >
      {/* Animated background orbs */}
      <FloatingOrb x="8%"  y="12%" size={320} delay={0}   duration={8} />
      <FloatingOrb x="65%" y="5%"  size={200} delay={1.5} duration={10} />
      <FloatingOrb x="75%" y="60%" size={280} delay={3}   duration={9} />
      <FloatingOrb x="5%"  y="65%" size={180} delay={2}   duration={11} />
      <FloatingOrb x="40%" y="80%" size={120} delay={0.8} duration={7} />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, ${TEAL}0a 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.05 }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          <Link href="/">
            <span className="text-2xl font-extrabold tracking-tight text-slate-900 cursor-pointer select-none">
              Aperti<motion.span
                style={{ color: TEAL }}
                animate={{ opacity: [1, 0.6, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              >.</motion.span>
            </span>
          </Link>
          <p className="text-slate-400 text-sm mt-1">Where every mind finds its rhythm.</p>
        </motion.div>

        {/* Card */}
        <motion.div
          className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white shadow-xl shadow-teal-900/5 p-8"
          style={{ borderColor: "rgba(0,121,107,0.12)" }}
          whileHover={{ boxShadow: "0 20px 60px rgba(0,121,107,0.10)" }}
          transition={{ duration: 0.3 }}
        >
          <motion.h2
            className="text-lg font-bold text-slate-900 mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Sign in to your workspace
          </motion.h2>

          <Shake trigger={shake}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FloatField id="username" label="Username" type="text" value={username} onChange={setUsername}
                placeholder="Enter your username" autoComplete="username" autoFocus index={0} />

              <FloatField id="password" label="Password" type={showPassword ? "text" : "password"} value={password}
                onChange={setPassword} placeholder="Enter your password" autoComplete="current-password" index={1}>
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </FloatField>

              {/* CAPTCHA */}
              <motion.div
                className="space-y-1.5"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.26, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-center justify-between">
                  <Label className="text-slate-600 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" style={{ color: TEAL }} />
                    Security check
                  </Label>
                  <motion.button
                    type="button"
                    onClick={refreshCaptcha}
                    whileTap={{ rotate: 180 }}
                    transition={{ duration: 0.3 }}
                    className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" /> New
                  </motion.button>
                </div>
                <div className="flex items-center gap-3">
                  <motion.div
                    key={`${captcha.a}${captcha.op}${captcha.b}`}
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="flex-shrink-0 rounded-xl px-4 py-2.5 text-sm font-mono font-bold select-none"
                    style={{ background: TEAL_LIGHT, color: TEAL, letterSpacing: "0.12em" }}
                  >
                    {captcha.a} {captcha.op} {captcha.b} = ?
                  </motion.div>
                  <input
                    type="number"
                    value={captchaInput}
                    onChange={e => setCaptchaInput(e.target.value)}
                    placeholder="?"
                    className="h-11 w-20 text-center rounded-xl border text-sm font-semibold outline-none transition-all duration-200"
                    style={{
                      borderColor: captchaInput ? (captchaValid ? TEAL : "#f87171") : "#e2e8f0",
                      boxShadow: captchaInput ? (captchaValid ? `0 0 0 3px ${TEAL}18` : "0 0 0 3px #f8717118") : "none",
                    }}
                  />
                  <AnimatePresence mode="wait">
                    {captchaInput && (
                      <motion.span
                        key={captchaValid ? "ok" : "no"}
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        className="text-xl select-none"
                      >
                        {captchaValid ? "✅" : "❌"}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -4, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 overflow-hidden"
                  >
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-600">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                className="flex justify-end"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                <Link href="/forgot-password" className="text-xs hover:underline transition-colors" style={{ color: TEAL }}>
                  Forgot password?
                </Link>
              </motion.div>

              {/* Submit button */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.4 }}
              >
                <motion.button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full h-11 rounded-xl font-semibold text-white text-sm relative overflow-hidden flex items-center justify-center gap-2"
                  style={{
                    background: canSubmit ? TEAL : "#94a3b8",
                    cursor: canSubmit ? "pointer" : "not-allowed",
                  }}
                  whileHover={canSubmit ? { scale: 1.015, boxShadow: `0 8px 24px ${TEAL}40` } : {}}
                  whileTap={canSubmit ? { scale: 0.98 } : {}}
                  transition={{ duration: 0.15 }}
                >
                  {/* shimmer */}
                  {canSubmit && !isSubmitting && (
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)" }}
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
                    />
                  )}
                  <AnimatePresence mode="wait">
                    {success ? (
                      <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-lg">✓</motion.span>
                    ) : isSubmitting ? (
                      <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Spinner /></motion.span>
                    ) : (
                      <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                        Sign in <ArrowRight className="w-4 h-4" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </motion.div>
            </form>
          </Shake>

          <AnimatePresence>
            {attempts >= 3 && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 text-center text-xs text-amber-600"
              >
                Multiple failed attempts. Please double-check your credentials.
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer link */}
        <motion.p
          className="mt-6 text-center text-sm text-slate-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Don't have an account?{" "}
          <Link href="/register" className="font-semibold hover:underline" style={{ color: TEAL }}>
            Create one free
          </Link>
        </motion.p>
        <motion.p
          className="mt-2 text-center text-xs text-slate-300"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
        >
          <Link href="/" className="hover:text-slate-500 transition-colors">← Back to home</Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
