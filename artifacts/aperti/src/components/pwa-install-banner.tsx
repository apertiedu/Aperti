import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Bell } from "lucide-react";
import { usePWA } from "@/hooks/use-pwa";
import { useToast } from "@/hooks/use-toast";

export default function PWAInstallBanner() {
  const { canInstall, triggerInstall, pushSupported, pushPermission, subscribeToPush } = usePWA();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [pushDismissed, setPushDismissed] = useState(() =>
    localStorage.getItem("aperti_push_dismissed") === "1"
  );

  const handleInstall = async () => {
    const ok = await triggerInstall();
    if (ok) toast({ title: "Aperti installed!", description: "Open it from your home screen." });
  };

  const handlePushEnable = async () => {
    const ok = await subscribeToPush();
    if (ok) {
      toast({ title: "Notifications enabled!", description: "You'll receive updates for assignments and grades." });
      setPushDismissed(true);
      localStorage.setItem("aperti_push_dismissed", "1");
    } else {
      toast({ title: "Permission denied", description: "Enable notifications in browser settings.", variant: "destructive" });
    }
  };

  const dismissPush = () => {
    setPushDismissed(true);
    localStorage.setItem("aperti_push_dismissed", "1");
  };

  return (
    <div className="fixed bottom-20 lg:bottom-5 right-4 z-40 space-y-2 pointer-events-none">
      {/* Install Banner */}
      <AnimatePresence>
        {canInstall && !dismissed && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="pointer-events-auto bg-card border border-border/60 rounded-2xl shadow-lg p-4 max-w-[300px] flex items-start gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <Download className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Install Aperti</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add to your home screen for the best mobile experience.
              </p>
              <div className="flex gap-2 mt-2.5">
                <button
                  onClick={handleInstall}
                  className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg min-h-[32px]"
                >
                  Install
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="px-3 py-1.5 text-muted-foreground text-xs rounded-lg hover:bg-muted min-h-[32px]"
                >
                  Later
                </button>
              </div>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="text-muted-foreground hover:text-foreground shrink-0 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Push Notification Banner */}
      <AnimatePresence>
        {pushSupported && pushPermission === "default" && !pushDismissed && !canInstall && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="pointer-events-auto bg-card border border-border/60 rounded-2xl shadow-lg p-4 max-w-[300px] flex items-start gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Stay in the loop</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Get notified for new assignments, grades, and announcements.
              </p>
              <div className="flex gap-2 mt-2.5">
                <button
                  onClick={handlePushEnable}
                  className="px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg min-h-[32px]"
                >
                  Enable
                </button>
                <button
                  onClick={dismissPush}
                  className="px-3 py-1.5 text-muted-foreground text-xs rounded-lg hover:bg-muted min-h-[32px]"
                >
                  No thanks
                </button>
              </div>
            </div>
            <button onClick={dismissPush} className="text-muted-foreground hover:text-foreground shrink-0 p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
