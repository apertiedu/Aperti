import { motion } from "framer-motion";
import { ShieldOff, Home, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function AccessDenied() {
  const [, navigate] = useLocation();

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: "linear-gradient(135deg, #f0fdfa 0%, #f8fafc 50%, #fef2f2 100%)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="w-full max-w-md text-center"
      >
        <motion.div
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
          className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg"
          style={{ background: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)" }}
        >
          <ShieldOff className="w-10 h-10 text-red-500" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="text-2xl font-extrabold text-slate-900 mb-2 tracking-tight"
        >
          Access Denied
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="text-slate-500 text-sm leading-relaxed mb-8"
        >
          You don't have permission to view this page.
          <br />
          It may be restricted to a different role or require elevated access.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/80 backdrop-blur-sm border border-red-100 rounded-2xl p-5 mb-8 text-left"
        >
          <p className="text-xs font-semibold text-red-700 mb-2">What you can do</p>
          <ul className="text-xs text-slate-500 space-y-1.5 list-disc list-inside">
            <li>Return to your dashboard and continue from there</li>
            <li>Contact your administrator if you believe this is an error</li>
            <li>Ensure you are signed in with the correct account</li>
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36 }}
          className="flex gap-3 justify-center"
        >
          <motion.button
            onClick={() => navigate(-1 as any)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:border-slate-300 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Go back
          </motion.button>
          <Link href="/">
            <motion.span
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium shadow-sm cursor-pointer"
              style={{ background: "#0D9488" }}
            >
              <Home className="w-4 h-4" />
              Go to dashboard
            </motion.span>
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="mt-8 text-xs text-slate-400"
        >
          Error code: <span className="font-mono">403 ACCESS_DENIED</span>
        </motion.p>
      </motion.div>
    </div>
  );
}
