import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquareWarning, X, Send, CheckCircle2, AlertCircle, ChevronDown } from "lucide-react";
import { useAuth } from "@/context/auth";
import { useLocation } from "wouter";

const CATEGORIES = [
  "UI / Display bug",
  "Feature not working",
  "Data not loading",
  "Slow performance",
  "Login / Auth issue",
  "Missing content",
  "Other",
] as const;

const API = "/api";

export default function ReportProblemModal() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  const reset = () => {
    setCategory(CATEGORIES[0]);
    setDescription("");
    setStatus("idle");
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(reset, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch(`${API}/problem-reports`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          description: description.trim(),
          pageUrl: location,
          userAgent: navigator.userAgent,
        }),
      });
      if (!res.ok) throw new Error("submit failed");
      setStatus("success");
      setTimeout(handleClose, 2400);
    } catch {
      setStatus("error");
    }
  };

  if (!user) return null;

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[9980]"
              onClick={handleClose}
            />
            <motion.div
              key="modal"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-[340px] bg-card rounded-2xl shadow-2xl border border-border/50 z-[9990] overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                    <MessageSquareWarning className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">Report a Problem</span>
                </div>
                <button
                  onClick={handleClose}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <AnimatePresence mode="wait">
                {status === "success" ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="px-5 py-8 text-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                      className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3"
                    >
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                    </motion.div>
                    <p className="text-sm font-semibold text-foreground mb-1">Report submitted!</p>
                    <p className="text-xs text-muted-foreground">
                      Thank you. We'll review it and get back to you if needed.
                    </p>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onSubmit={handleSubmit}
                    className="p-5 space-y-4"
                  >
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Category
                      </label>
                      <div className="relative">
                        <select
                          value={category}
                          onChange={e => setCategory(e.target.value as typeof category)}
                          className="w-full h-9 pl-3 pr-8 rounded-lg border border-border/60 bg-background text-sm text-foreground appearance-none outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all"
                        >
                          {CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Description
                      </label>
                      <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Describe what happened and what you expected to see…"
                        rows={4}
                        maxLength={1000}
                        className="w-full px-3 py-2.5 rounded-lg border border-border/60 bg-background text-sm text-foreground resize-none outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-all placeholder:text-muted-foreground/50"
                      />
                      <p className="text-[10px] text-muted-foreground text-right">{description.length}/1000</p>
                    </div>

                    <div className="bg-muted/40 rounded-lg px-3 py-2 border border-border/30">
                      <p className="text-[10px] text-muted-foreground">
                        <span className="font-medium">Page:</span>{" "}
                        <span className="font-mono">{location}</span>
                      </p>
                    </div>

                    {status === "error" && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                        <p className="text-xs text-destructive">Failed to submit. Please try again.</p>
                      </div>
                    )}

                    <motion.button
                      type="submit"
                      disabled={!description.trim() || status === "sending"}
                      whileHover={description.trim() ? { scale: 1.01 } : {}}
                      whileTap={description.trim() ? { scale: 0.99 } : {}}
                      className="w-full h-9 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold bg-primary text-primary-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                    >
                      {status === "sending" ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          Send Report
                        </>
                      )}
                    </motion.button>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`fixed bottom-16 right-4 md:bottom-4 md:right-20 z-[9970] w-9 h-9 rounded-full shadow-lg flex items-center justify-center transition-colors ${open ? "bg-primary" : "bg-amber-500"}`}
        title="Report a problem"
        aria-label="Report a problem"
      >
        <MessageSquareWarning className="w-4 h-4 text-white" />
      </motion.button>
    </>
  );
}
