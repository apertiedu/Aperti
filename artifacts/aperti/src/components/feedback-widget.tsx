import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, X, Send, ThumbsUp } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface FeedbackWidgetProps {
  feature: string;
  trigger?: "auto" | "manual";
  delayMs?: number;
  onDismiss?: () => void;
}

const DISMISSED_KEY = "aperti_feedback_dismissed";

function getDismissed(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "{}"); } catch { return {}; }
}

function setDismissed(feature: string) {
  const d = getDismissed();
  d[feature] = Date.now();
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(d));
}

function shouldShow(feature: string): boolean {
  const d = getDismissed();
  const last = d[feature];
  if (!last) return true;
  return Date.now() - last > 7 * 24 * 60 * 60 * 1000;
}

export default function FeedbackWidget({ feature, trigger = "auto", delayMs = 3000, onDismiss }: FeedbackWidgetProps) {
  const [visible, setVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showComment, setShowComment] = useState(false);

  useEffect(() => {
    if (trigger === "auto" && shouldShow(feature)) {
      const t = setTimeout(() => setVisible(true), delayMs);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [feature, trigger, delayMs]);

  const handleDismiss = () => {
    setDismissed(feature);
    setVisible(false);
    onDismiss?.();
  };

  const handleRate = (r: number) => {
    setRating(r);
    if (r <= 3) setShowComment(true);
  };

  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature, rating, comment: comment || undefined }),
      });
      setSubmitted(true);
      setDismissed(feature);
      setTimeout(() => { setVisible(false); onDismiss?.(); }, 2000);
    } catch {
      setVisible(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (trigger === "manual") {
    if (!visible && trigger === "manual") {
      return null;
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          className="fixed bottom-6 right-6 z-50 w-72 bg-card rounded-2xl border border-border shadow-xl shadow-black/10 p-5"
        >
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-2"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-3"
                >
                  <ThumbsUp className="w-5 h-5 text-teal-600" />
                </motion.div>
                <p className="text-sm font-semibold text-foreground">Thanks for the feedback!</p>
                <p className="text-xs text-muted-foreground mt-1">Your input helps improve Aperti.</p>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <p className="text-sm font-semibold text-foreground mb-1">How's this feature?</p>
                <p className="text-xs text-muted-foreground mb-3 capitalize">{feature.replace(/-/g, " ")}</p>

                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleRate(i)}
                      onMouseEnter={() => setHovered(i)}
                      onMouseLeave={() => setHovered(0)}
                      className="p-0.5"
                    >
                      <Star
                        className={`w-6 h-6 transition-colors ${
                          i <= (hovered || rating) ? "fill-amber-400 text-amber-400" : "text-slate-200"
                        }`}
                      />
                    </motion.button>
                  ))}
                </div>

                <AnimatePresence>
                  {showComment && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-3 overflow-hidden"
                    >
                      <textarea
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        placeholder="Tell us what could be better…"
                        rows={2}
                        className="w-full text-xs rounded-lg border border-border bg-muted/40 px-3 py-2 outline-none focus:border-teal-400 resize-none transition-colors"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-2">
                  {rating > 0 && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50"
                      style={{ background: "#0D9488" }}
                    >
                      <Send className="w-3 h-3" />
                      {submitting ? "Sending…" : "Submit"}
                    </motion.button>
                  )}
                  <button
                    onClick={handleDismiss}
                    className="h-8 px-3 rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Skip
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useFeedback(feature: string) {
  const [show, setShow] = useState(false);
  const trigger = () => { if (shouldShow(feature)) setShow(true); };
  return {
    show,
    trigger,
    FeedbackComponent: show
      ? () => <FeedbackWidget feature={feature} trigger="manual" onDismiss={() => setShow(false)} />
      : () => null,
  };
}
