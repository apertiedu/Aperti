import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Check, ArrowRight, Crown } from "lucide-react";
import { useLocation } from "wouter";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  resource?: string;
  message?: string;
  currentPlan?: string;
}

const HIGHLIGHT_PLANS = [
  {
    name: "Plus",
    priceEgp: 299,
    features: ["15 courses", "300 students", "AI tools", "2,000 questions", "50 revision packs"],
    color: "border-teal-400 bg-teal-50",
    badge: "Most Popular",
    badgeColor: "bg-teal-500",
  },
  {
    name: "Pro",
    priceEgp: 599,
    features: ["50 courses", "1,000 students", "Priority AI", "10,000 questions", "200 revision packs"],
    color: "border-purple-400 bg-purple-50",
    badge: "Best Value",
    badgeColor: "bg-purple-500",
  },
];

export default function UpgradeModal({ open, onClose, resource, message, currentPlan }: UpgradeModalProps) {
  const [, navigate] = useLocation();

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", damping: 20 }}
            className="relative z-10 bg-card rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
          >
            {/* Header gradient */}
            <div className="bg-gradient-to-r from-teal-500 to-emerald-500 px-6 pt-6 pb-8 text-white relative">
              <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/20 transition-colors">
                <X className="w-4 h-4" />
              </button>
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                <Crown className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold mb-1">Upgrade Your Plan</h2>
              {message ? (
                <p className="text-teal-100 text-sm">{message}</p>
              ) : resource ? (
                <p className="text-teal-100 text-sm">You've reached your <strong className="text-white">{resource.replace(/_/g, " ")}</strong> limit on your current plan.</p>
              ) : (
                <p className="text-teal-100 text-sm">Unlock more features, students and AI-powered tools.</p>
              )}
              {currentPlan && (
                <p className="text-teal-200 text-xs mt-2">Current plan: <span className="font-semibold text-white capitalize">{currentPlan}</span></p>
              )}
            </div>

            {/* Plans */}
            <div className="p-5 grid grid-cols-2 gap-3">
              {HIGHLIGHT_PLANS.map((plan) => (
                <div key={plan.name} className={`relative rounded-2xl border-2 p-4 ${plan.color}`}>
                  <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full ${plan.badgeColor}`}>
                    {plan.badge}
                  </span>
                  <h3 className="font-bold text-gray-900 text-base mt-1">{plan.name}</h3>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {plan.priceEgp.toLocaleString()}
                    <span className="text-xs font-normal text-gray-500 ml-1">EGP/mo</span>
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Check className="w-3 h-3 text-teal-500 shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => { onClose(); navigate(`/pricing`); }}
                    className="w-full mt-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-700 transition-colors"
                  >
                    Get {plan.name}
                  </button>
                </div>
              ))}
            </div>

            <div className="px-5 pb-5">
              <button
                onClick={() => { onClose(); navigate("/pricing"); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-teal-600 hover:text-teal-800 border border-teal-200 rounded-xl hover:bg-teal-50 transition-colors"
              >
                View all plans <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
