import { motion } from "framer-motion";
import { Link } from "wouter";
import { Home, ArrowLeft, RefreshCw, AlertTriangle, Bug } from "lucide-react";
import { useState } from "react";


export default function ServerError() {
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  const handleReport = async () => {
    setReporting(true);
    try {
      await fetch("/api/problem-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "User-reported 500 error from error page", route: window.location.href, type: "server_error" }),
      });
    } catch {}
    setReported(true);
    setReporting(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden select-none"
      style={{ background: "white" }}
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <pattern id="se-dots" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="hsl(var(--primary))" opacity="0.06" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#se-dots)" />
        </svg>
        <div className="absolute rounded-full blur-3xl" style={{ width: 400, height: 400, background: "#EF4444", opacity: 0.04, top: "-15%", right: "-8%" }} />
        <div className="absolute rounded-full blur-3xl" style={{ width: 300, height: 300, background: "hsl(var(--primary))", opacity: 0.03, bottom: "-10%", left: "-8%" }} />
      </div>

      <div className="relative z-10 text-center px-6 max-w-md mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10"
        >
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg"
            style={{ background: "linear-gradient(135deg, #fee2e2, #fecaca)" }}
          >
            <AlertTriangle className="w-12 h-12 text-red-500" />
          </div>
          <div className="text-[80px] font-black leading-none tracking-tighter" style={{ color: "transparent", WebkitTextStroke: `2px #EF4444`, opacity: 0.7 }}>
            500
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-400 leading-relaxed mb-8">
            We've logged this error automatically. Our team will investigate. You can help by submitting a report.
          </p>
        </motion.div>

        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 shadow-sm bg-primary"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
          <Link href="/">
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all active:scale-95">
              <Home className="h-4 w-4" />
              Go Home
            </button>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          {reported ? (
            <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
              ✓ Report submitted — thank you for helping us improve Aperti.
            </p>
          ) : (
            <button
              onClick={handleReport}
              disabled={reporting}
              className="flex items-center gap-2 mx-auto text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <Bug className="h-3.5 w-3.5" />
              {reporting ? "Submitting report…" : "Report this problem"}
            </button>
          )}
        </motion.div>

        <motion.div className="mt-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
          <Link href="/">
            <span className="text-lg font-extrabold cursor-pointer tracking-tight" style={{ color: "#121212" }}>
              Aperti<span className="text-primary">.</span>
            </span>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
