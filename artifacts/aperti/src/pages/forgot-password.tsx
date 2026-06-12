import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { Mail, AlertCircle, CheckCircle2 } from "lucide-react";

const TEAL = "#0D9488";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const res = await fetch("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setSubmitted(true);
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
            {submitted ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-2"
              >
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "#E6F4F1" }}>
                    <CheckCircle2 className="h-7 w-7" style={{ color: TEAL }} />
                  </div>
                </div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">Check your inbox</h2>
                <p className="text-sm text-slate-500 mb-6">
                  If an account with <strong>{email}</strong> exists, we've sent a password reset link. It expires in 1 hour.
                </p>
                <p className="text-xs text-slate-400">Didn't get it? Check your spam folder or{" "}
                  <button
                    onClick={() => { setSubmitted(false); setEmail(""); }}
                    className="font-semibold hover:underline"
                    style={{ color: TEAL }}
                  >
                    try again
                  </button>.
                </p>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#E6F4F1" }}>
                    <Mail className="h-4 w-4" style={{ color: TEAL }} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 leading-tight">Forgot your password?</h2>
                    <p className="text-xs text-slate-500">We'll send a reset link to your email.</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-slate-700 text-sm font-medium">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoFocus
                      placeholder="you@example.com"
                      className="rounded-xl border-slate-200 focus-visible:ring-teal-600 h-10"
                    />
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
                    disabled={isSubmitting || !email}
                    className="w-full rounded-xl h-11 font-semibold text-white mt-2"
                    style={{ background: isSubmitting ? "#4DB6AC" : TEAL }}
                  >
                    {isSubmitting ? (
                      <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                        Sending…
                      </motion.span>
                    ) : (
                      "Send reset link"
                    )}
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Remember it?{" "}
          <Link href="/login" style={{ color: TEAL }} className="font-semibold hover:underline">
            Back to sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
