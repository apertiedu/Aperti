import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi } from "lucide-react";

export function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOffline = () => { setIsOnline(false); setWasOffline(true); };
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [wasOffline]);

  return (
    <AnimatePresence>
      {(!isOnline || showReconnected) && (
        <motion.div
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed top-0 left-0 right-0 z-[9998] flex items-center justify-center gap-2 py-2 text-xs font-semibold text-white"
          style={{ background: isOnline ? "#0D9488" : "#dc2626" }}
        >
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5" />
              Back online — reconnected
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              No internet connection — some features may be unavailable
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
