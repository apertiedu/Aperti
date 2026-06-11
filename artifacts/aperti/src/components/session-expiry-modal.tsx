import { motion, AnimatePresence } from "framer-motion";
import { LogIn, Clock } from "lucide-react";

interface Props {
  open: boolean;
  onDismiss: () => void;
}

export default function SessionExpiryModal({ open, onDismiss }: Props) {
  const handleLogin = () => {
    onDismiss();
    window.location.href = "/";
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
            className="fixed inset-0 bg-black/40 backdrop-blur-[3px] z-[9995]"
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.93, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
            className="fixed inset-0 z-[9996] flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-border/50 max-w-sm w-full p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 22 }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "#FEF3C7" }}
              >
                <Clock className="w-8 h-8 text-amber-500" />
              </motion.div>

              <h2 className="text-xl font-bold text-gray-900 mb-2">Session Expired</h2>
              <p className="text-sm text-gray-500 mb-7 leading-relaxed">
                Your session has timed out for security. Please sign in again to continue — your work is safe.
              </p>

              <button
                onClick={handleLogin}
                className="w-full h-10 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: "#0D9488" }}
              >
                <LogIn className="w-4 h-4" />
                Sign in again
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
