import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth";
import { useLocation, Link } from "wouter";
import { Eye, EyeOff, AlertCircle, ShieldCheck, RefreshCw, ArrowRight, Ban, Smartphone, Clock } from "lucide-react";


const TEAL_LIGHT = "hsl(var(--primary) / 0.1)";

function generateCaptcha() {
  const ops = ["+", "-"] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  const a = Math.floor(Math.random() * 9) + 1;
  const b = op === "-" ? Math.floor(Math.random() * a) + 1 : Math.floor(Math.random() * 9) + 1;
  return { a, b, op, answer: op === "+" ? a + b : a - b };
}

function FloatingOrb({ x, y, size, delay, duration }: { x: string; y: string; size: number; delay: number; duration: number }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{ left: x, top: y, width: size, height: size, background: `radial-gradient(circle, ${"hsl(var(--primary))"}22, transparent 70%)` }}
      animate={{ y: [0, -30, 0], x: [0, 15, 0], scale: [1, 1.1, 1] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function FloatField({
  id, label, type, value, onChange, placeholder, autoComplete, autoFocus, children, index, disabled,
}: {
  id: string; label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder: string;
  autoComplete?: string; autoFocus?: boolean; children?: React.ReactNode; index: number; disabled?: boolean;
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
          disabled={disabled}
          maxLength={type === "password" ? 500 : 200}
          className="w-full h-11 px-4 rounded-xl text-sm text-slate-900 bg-white outline-none transition-all duration-200 border disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            borderColor: disabled ? "#e2e8f0" : focused ? "hsl(var(--primary))" : filled ? "#94a3b8" : "#e2e8f0",
            boxShadow: focused && !disabled ? `0 0 0 3px ${"hsl(var(--primary))"}18` : "none",
          }}
        />
        {children}
        <motion.div
          className="absolute bottom-0 left-4 right-4 h-px rounded-full pointer-events-none"
          style={{ background: "hsl(var(--primary))" }}
          animate={{ scaleX: focused && !disabled ? 1 : 0, opacity: focused && !disabled ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          initial={{ scaleX: 0, opacity: 0 }}
        />
      </div>
    </motion.div>
  );
}

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

function SuspendedScreen() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="text-center py-4"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
        className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5"
      >
        <Ban className="w-8 h-8 text-red-500" />
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="text-lg font-bold text-slate-900 mb-2"
      >
        Account Suspended
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-sm text-slate-500 mb-6 leading-relaxed"
      >
        Your account has been suspended by an administrator.
        <br />
        You cannot sign in until the suspension is lifted.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-red-50 border border-red-100 rounded-xl p-4 text-left mb-6"
      >
        <p className="text-xs font-semibold text-red-700 mb-1">What to do next</p>
        <ul className="text-xs text-red-600 space-y-1 list-disc list-inside">
          <li>Contact your school or institution administrator</li>
          <li>Email <span className="font-mono">support@aperti.ai</span> with your username</li>
          <li>Include your account details and reason for appeal</li>
        </ul>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <Link
          href="/"
          className="text-sm font-medium hover:underline transition-colors"
          style={{ color: "hsl(var(--primary))" }}
        >
          ← Return to home
        </Link>
      </motion.div>
    </motion.div>
  );
}

function RateLimitedScreen({ secondsLeft }: { secondsLeft: number }) {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="text-center py-4"
    >
      <motion.div
        className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <Clock className="w-8 h-8 text-amber-500" />
      </motion.div>
      <h2 className="text-lg font-bold text-slate-900 mb-2">Too Many Attempts</h2>
      <p className="text-sm text-slate-500 mb-6 leading-relaxed">
        Sign-in has been temporarily locked due to too many failed attempts.
        <br />
        Please try again in:
      </p>
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 mb-6">
        <motion.div
          key={secondsLeft}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          className="text-3xl font-mono font-bold text-amber-600 tabular-nums"
        >
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </motion.div>
        <p className="text-xs text-amber-500 mt-1">minutes remaining</p>
      </div>
      <p className="text-xs text-slate-400">
        If you've forgotten your password,{" "}
        <Link href="/forgot-password" className="hover:underline" style={{ color: "hsl(var(--primary))" }}>
          reset it here
        </Link>
        .
      </p>
    </motion.div>
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
  const [suspended, setSuspended] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [rateLimitSecondsLeft, setRateLimitSecondsLeft] = useState(600);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthErr = params.get("error");
    if (oauthErr) {
      const MESSAGES: Record<string, string> = {
        google_not_configured: "Google sign-in is not available on this platform.",
        google_cancelled: "Google sign-in was cancelled.",
        invalid_state: "Sign-in session expired. Please try again.",
        google_token_failed: "Could not connect with Google. Please try again.",
        google_userinfo_failed: "Could not retrieve your Google profile. Please try again.",
        google_email_unverified: "Your Google email is not verified.",
        account_suspended: "Your account has been suspended.",
        google_error: "Google sign-in failed. Please try again.",
      };
      setError(MESSAGES[oauthErr] || "Sign-in error. Please try again.");
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  const captchaValid = useMemo(
    () => parseInt(captchaInput, 10) === captcha.answer,
    [captchaInput, captcha.answer]
  );

  const refreshCaptcha = () => { setCaptcha(generateCaptcha()); setCaptchaInput(""); };
  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 500); };

  useEffect(() => {
    if (!rateLimited) return;
    if (rateLimitSecondsLeft <= 0) { setRateLimited(false); setRateLimitSecondsLeft(600); return; }
    const timer = setTimeout(() => setRateLimitSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [rateLimited, rateLimitSecondsLeft]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (attempts > 0 && !captchaValid) {
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
      if (err.suspended) {
        setSuspended(true);
        return;
      }
      if (err.rateLimited) {
        setRateLimited(true);
        setRateLimitSecondsLeft(600);
        return;
      }
      setAttempts(a => a + 1);
      if (err.deviceLimitReached) {
        setError(err.message);
      } else {
        setError(err.message || "Invalid credentials. Please try again.");
        refreshCaptcha();
        triggerShake();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLocked = rateLimited || suspended;
  const canSubmit = !isSubmitting && !isLocked && username && password && (attempts === 0 || captchaInput);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #f0fdfa 0%, #f8fafc 50%, #f0f9ff 100%)", fontFamily: "Inter, sans-serif" }}
    >
      <FloatingOrb x="8%"  y="12%" size={320} delay={0}   duration={8} />
      <FloatingOrb x="65%" y="5%"  size={200} delay={1.5} duration={10} />
      <FloatingOrb x="75%" y="60%" size={280} delay={3}   duration={9} />
      <FloatingOrb x="5%"  y="65%" size={180} delay={2}   duration={11} />
      <FloatingOrb x="40%" y="80%" size={120} delay={0.8} duration={7} />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, ${"hsl(var(--primary))"}0a 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.05 }}
        className="w-full max-w-sm relative z-10"
      >
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          <Link href="/">
            <span className="text-2xl font-extrabold tracking-tight text-slate-900 cursor-pointer select-none">
              Aperti<motion.span
                style={{ color: suspended ? "#dc2626" : rateLimited ? "#d97706" : "hsl(var(--primary))" }}
                animate={{ opacity: [1, 0.6, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              >.</motion.span>
            </span>
          </Link>
          <p className="text-slate-400 text-sm mt-1">Where every mind finds its rhythm.</p>
        </motion.div>

        <motion.div
          className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white shadow-xl shadow-primary/10 p-8"
          style={{ borderColor: suspended ? "rgba(220,38,38,0.18)" : rateLimited ? "rgba(217,119,6,0.18)" : "rgba(0,121,107,0.12)" }}
          whileHover={{ boxShadow: "0 20px 60px rgba(0,121,107,0.10)" }}
          transition={{ duration: 0.3 }}
        >
          <AnimatePresence mode="wait">
            {suspended ? (
              <motion.div key="suspended" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <SuspendedScreen />
              </motion.div>
            ) : rateLimited ? (
              <motion.div key="ratelimited" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <RateLimitedScreen secondsLeft={rateLimitSecondsLeft} />
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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

                    {attempts > 0 && (
                    <motion.div
                      className="space-y-1.5"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="flex items-center justify-between">
                        <Label className="text-slate-600 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5" style={{ color: "hsl(var(--primary))" }} />
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
                          style={{ background: TEAL_LIGHT, color: "hsl(var(--primary))", letterSpacing: "0.12em" }}
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
                            borderColor: captchaInput ? (captchaValid ? "hsl(var(--primary))" : "#f87171") : "#e2e8f0",
                            boxShadow: captchaInput ? (captchaValid ? `0 0 0 3px ${"hsl(var(--primary))"}18` : "0 0 0 3px #f8717118") : "none",
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
                    )}

                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -8, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: "auto" }}
                          exit={{ opacity: 0, y: -4, height: 0 }}
                          transition={{ duration: 0.25 }}
                          className={`flex items-start gap-2 p-3 rounded-xl overflow-hidden border ${
                            error.includes("2 devices")
                              ? "bg-blue-50 border-blue-100"
                              : "bg-red-50 border-red-100"
                          }`}
                        >
                          {error.includes("2 devices")
                            ? <Smartphone className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                            : <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                          }
                          <div>
                            <p className={`text-sm ${error.includes("2 devices") ? "text-blue-700" : "text-red-600"}`}>
                              {error}
                            </p>
                            {error.includes("2 devices") && (
                              <p className="text-xs text-blue-500 mt-1">
                                Sign out on another device, then try again.
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.div
                      className="flex justify-end"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.35 }}
                    >
                      <Link href="/forgot-password" className="text-xs hover:underline transition-colors" style={{ color: "hsl(var(--primary))" }}>
                        Forgot password?
                      </Link>
                    </motion.div>

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
                          background: canSubmit ? "hsl(var(--primary))" : "#94a3b8",
                          cursor: canSubmit ? "pointer" : "not-allowed",
                        }}
                        whileHover={canSubmit ? { scale: 1.015, boxShadow: `0 8px 24px ${"hsl(var(--primary))"}40` } : {}}
                        whileTap={canSubmit ? { scale: 0.98 } : {}}
                        transition={{ duration: 0.15 }}
                      >
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
                      Multiple failed attempts. Please double-check your credentials or{" "}
                      <Link href="/forgot-password" className="underline" style={{ color: "hsl(var(--primary))" }}>reset your password</Link>.
                    </motion.p>
                  )}
                </AnimatePresence>
                <motion.div
                  className="mt-5"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45, duration: 0.4 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-slate-100" />
                    <span className="text-xs text-slate-400 shrink-0">or</span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>
                  <button
                    type="button"
                    onClick={() => { window.location.href = "/auth/google"; }}
                    title="Sign in with your Google account"
                    className="mt-3 w-full h-11 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 flex items-center justify-center gap-2.5 hover:bg-slate-50 active:scale-[0.98] transition-all duration-150 shadow-sm"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {!suspended && !rateLimited && (
          <>
            <motion.p
              className="mt-6 text-center text-sm text-slate-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              Don't have an account?{" "}
              <Link href="/register" className="font-semibold hover:underline" style={{ color: "hsl(var(--primary))" }}>
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
          </>
        )}
      </motion.div>
    </div>
  );
}
