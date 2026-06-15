import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, ChevronRight } from "lucide-react";

const CURRENT_BUILD = "27";
const STORAGE_KEY = "aperti_seen_build";

const UPDATES = [
  { emoji: "🧠", title: "Smarter Teacher Dashboard", desc: "Attendance drops, at-risk patterns, and upcoming exams now surface as plain-English action items — no more digging through numbers." },
  { emoji: "🎯", title: "Student Focus Today", desc: "Students see a prioritised \"what to do now\" panel on their dashboard — urgent homework, weak topics, and today's sessions in one glance." },
  { emoji: "🏆", title: "Student Success Center", desc: "A new unified page at /success shows overall progress, weak topics from Echo, upcoming assessments, and one-click practice links." },
  { emoji: "🔍", title: "Recently Searched", desc: "The command palette (⌘K) now remembers your last five searches for instant recall." },
  { emoji: "🚀", title: "Launch Certification", desc: "All 12 critical systems are green — Aperti is fully certified and ready for production." },
  { emoji: "✨", title: "Polish Pass", desc: "Improved spacing, contrast, micro-animations, and empty states across every major page." },
];

export default function WhatsNewModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (seen !== CURRENT_BUILD) {
      const t = setTimeout(() => setOpen(true), 1200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, CURRENT_BUILD);
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={dismiss}
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
          >
            <div className="bg-card rounded-2xl shadow-2xl max-w-lg w-full pointer-events-auto overflow-hidden">
              {/* Header */}
              <div className="relative bg-gradient-to-br from-teal-500 to-teal-700 p-6 text-white overflow-hidden">
                <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full" />
                <div className="absolute -right-2 bottom-0 w-24 h-24 bg-white/5 rounded-full" />
                <button
                  onClick={dismiss}
                  className="absolute top-3 right-3 p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="relative">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Sparkles className="w-4 h-4 text-teal-200" />
                    <span className="text-teal-200 text-xs font-bold uppercase tracking-widest">Phase 27</span>
                  </div>
                  <h2 className="text-2xl font-black leading-tight">What's New in Aperti</h2>
                  <p className="text-teal-100 text-sm mt-1 font-medium">Premium refinements, smarter insights & more delight</p>
                </div>
              </div>

              {/* Updates list */}
              <div className="p-5 space-y-3.5 max-h-72 overflow-y-auto">
                {UPDATES.map((u, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                    className="flex items-start gap-3"
                  >
                    <span className="text-xl shrink-0 mt-0.5">{u.emoji}</span>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{u.title}</p>
                      <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{u.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-100 p-4 flex items-center justify-between bg-gray-50">
                <p className="text-xs text-gray-400">Aperti · Build 27 · {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>
                <button
                  onClick={dismiss}
                  className="flex items-center gap-1.5 bg-teal-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-teal-700 transition-colors"
                >
                  Got it <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
