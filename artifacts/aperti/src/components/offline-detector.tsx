import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi } from "lucide-react";

export function OfflineDetector() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      const t = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(t);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {(!isOnline || showReconnected) && (
        <motion.div
          key={isOnline ? "online" : "offline"}
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center"
        >
          <div
            className={`flex items-center gap-2.5 mx-auto mt-3 px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg border backdrop-blur-sm ${
              isOnline
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-gray-900 border-gray-700 text-white"
            }`}
          >
            {isOnline ? (
              <>
                <Wifi className="h-4 w-4 text-emerald-500" />
                Back online — reconnected
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-gray-300" />
                You're offline — check your connection
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
