import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Monitor, Smartphone, Tablet, Globe, LogOut, ShieldCheck, Clock,
  RefreshCw, AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = "/api";
const authH = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("aperti_token") || ""}`,
});

type DeviceSession = {
  id: number;
  deviceId: string;
  ip: string | null;
  userAgent: string | null;
  lastActiveAt: string;
  createdAt: string;
  isCurrent?: boolean;
};

function parseDevice(ua: string | null) {
  if (!ua) return { name: "Unknown Device", icon: Monitor };
  const lower = ua.toLowerCase();
  if (/iphone|android.*mobile|blackberry|windows phone/i.test(lower))
    return { name: "Mobile", icon: Smartphone };
  if (/ipad|tablet|kindle/i.test(lower))
    return { name: "Tablet", icon: Tablet };
  const browser = lower.includes("chrome")
    ? "Chrome"
    : lower.includes("firefox")
    ? "Firefox"
    : lower.includes("safari")
    ? "Safari"
    : lower.includes("edge")
    ? "Edge"
    : "Browser";
  const os = lower.includes("windows")
    ? "Windows"
    : lower.includes("mac")
    ? "macOS"
    : lower.includes("linux")
    ? "Linux"
    : "Desktop";
  return { name: `${browser} on ${os}`, icon: Monitor };
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function SessionsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [revokingId, setRevokingId] = useState<number | null>(null);

  const { data: sessions = [], isLoading, error, refetch } = useQuery<DeviceSession[]>({
    queryKey: ["device-sessions"],
    queryFn: async () => {
      const res = await fetch(`${API}/auth/devices`, { headers: authH() });
      const text = await res.text();
      try { return JSON.parse(text); } catch { return []; }
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const res = await fetch(`${API}/auth/devices/${encodeURIComponent(deviceId)}`, {
        method: "DELETE",
        headers: authH(),
      });
      if (!res.ok) throw new Error("Failed to revoke session");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["device-sessions"] });
      toast({ title: "Session revoked", description: "That device has been signed out." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not revoke session.", variant: "destructive" });
    },
    onSettled: () => setRevokingId(null),
  });

  const revokeAll = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/auth/devices`, {
        method: "DELETE",
        headers: authH(),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["device-sessions"] });
      toast({ title: "All sessions revoked", description: "All other devices have been signed out." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not revoke sessions.", variant: "destructive" });
    },
  });

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Active Sessions
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage where your account is currently signed in.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-2 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {sessions.length > 1 && (
              <button
                onClick={() => revokeAll.mutate()}
                disabled={revokeAll.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-destructive/30 text-destructive text-xs font-medium hover:bg-destructive/10 transition-colors disabled:opacity-50"
              >
                <LogOut className="w-3 h-3" />
                Sign out all others
              </button>
            )}
          </div>
        </div>

        {isLoading && (
          <div className="flex flex-col gap-3">
            {[1, 2].map(i => (
              <div key={i} className="bg-card border border-border/40 rounded-xl p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && !isLoading && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">Failed to load sessions. Please try again.</p>
          </div>
        )}

        {!isLoading && !error && sessions.length === 0 && (
          <div className="bg-card border border-border/40 rounded-xl p-8 text-center">
            <Monitor className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No active device sessions found.</p>
          </div>
        )}

        <AnimatePresence>
          <div className="space-y-3">
            {sessions.map((session, idx) => {
              const { name, icon: DeviceIcon } = parseDevice(session.userAgent);
              const isCurrent = session.isCurrent;
              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.22, delay: idx * 0.05 }}
                  className={`bg-card border rounded-xl p-4 flex items-center gap-4 ${
                    isCurrent ? "border-primary/30 bg-primary/[0.02]" : "border-border/40"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isCurrent ? "bg-primary/10" : "bg-muted"
                  }`}>
                    <DeviceIcon className={`w-5 h-5 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                      {isCurrent && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                          This device
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {session.ip && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Globe className="w-3 h-3" />
                          {session.ip}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {timeAgo(session.lastActiveAt)}
                      </span>
                    </div>
                  </div>

                  {!isCurrent && (
                    <button
                      onClick={() => {
                        setRevokingId(session.id);
                        revokeMutation.mutate(session.deviceId);
                      }}
                      disabled={revokingId === session.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-destructive border border-destructive/20 hover:bg-destructive/10 transition-colors disabled:opacity-50 shrink-0"
                    >
                      {revokingId === session.id ? (
                        <div className="w-3 h-3 border border-destructive/40 border-t-destructive rounded-full animate-spin" />
                      ) : (
                        <LogOut className="w-3 h-3" />
                      )}
                      Revoke
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>

        {!isLoading && sessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-4 p-4 bg-muted/40 border border-border/30 rounded-xl"
          >
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Security tip:</span> If you see a device you don't recognise,
              revoke it immediately and{" "}
              <a href="/settings" className="text-primary hover:underline">change your password</a>.
              Aperti limits accounts to 2 concurrent sessions.
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
