import { apiFetch } from "@/lib/api";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, CheckCheck, Trash2, AlertTriangle, Info, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { format } from "date-fns";

type Notification = {
  id: number;
  title: string;
  message: string | null;
  type: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
};

const TYPE_ICON: Record<string, typeof Info> = {
  info:    Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  error:   XCircle,
};
const TYPE_COLOR: Record<string, string> = {
  info:    "text-blue-500",
  warning: "text-amber-500",
  success: "text-emerald-500",
  error:   "text-red-500",
};
const TYPE_BG: Record<string, string> = {
  error:   "bg-red-50 border-l-2 border-l-red-400",
  warning: "bg-amber-50 border-l-2 border-l-amber-400",
  success: "",
  info:    "",
};
const HIGH_PRIORITY = new Set(["error", "warning"]);

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const [notifRes, countRes] = await Promise.all([
        apiFetch("/api/notifications", { credentials: "include" }),
        apiFetch("/api/notifications/unread-count", { credentials: "include" }),
      ]);
      if (notifRes.ok) setNotifications(await notifRes.json());
      if (countRes.ok) { const d = await countRes.json(); setUnreadCount(d.count); }
    } catch { }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const markAllRead = async () => {
    await apiFetch("/api/notifications/read-all", { method: "POST" });
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const markRead = async (id: number) => {
    await apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const deleteNotif = async (id: number) => {
    await apiFetch(`/api/notifications/${id}`, { method: "DELETE" });
    const notif = notifications.find(n => n.id === id);
    if (notif && !notif.isRead) setUnreadCount(prev => Math.max(0, prev - 1));
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  /* Split into priority (error/warning) and digest (info/success) */
  const urgent   = notifications.filter(n => HIGH_PRIORITY.has(n.type));
  const digest   = notifications.filter(n => !HIGH_PRIORITY.has(n.type));
  const displayed = showAll ? notifications : (urgent.length > 0 ? [...urgent, ...digest.slice(0, 3)] : notifications.slice(0, 6));
  const urgentUnread = urgent.filter(n => !n.isRead).length;

  return (
    <div ref={ref} className="relative">
      <button
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        onClick={() => setOpen(o => !o)}
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 w-4 h-4 text-white text-[9px] font-bold rounded-full flex items-center justify-center ${urgentUnread > 0 ? "bg-red-500 animate-pulse" : "bg-red-500"}`}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-10 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">Notifications</h3>
                {urgentUnread > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                    <AlertTriangle className="w-2.5 h-2.5" /> {urgentUnread} urgent
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                  <CheckCheck className="h-3 w-3" /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                  <Bell className="h-8 w-8 opacity-20" />
                  <p>No notifications</p>
                </div>
              ) : (
                <>
                  {/* Priority section header */}
                  {urgent.length > 0 && (
                    <div className="px-4 pt-2 pb-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-red-500/70">Requires Attention</p>
                    </div>
                  )}

                  {displayed.map((n, idx) => {
                    const isFirstDigest = urgent.length > 0 && idx === urgent.length;
                    const Icon = TYPE_ICON[n.type] ?? Info;
                    return (
                      <div key={n.id}>
                        {isFirstDigest && (
                          <div className="px-4 pt-3 pb-1 border-t border-border/50">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Updates</p>
                          </div>
                        )}
                        <div
                          className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors group ${!n.isRead ? "bg-primary/5" : ""} ${TYPE_BG[n.type] || ""}`}
                        >
                          <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${TYPE_COLOR[n.type] ?? "text-muted-foreground"}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm leading-snug ${!n.isRead ? "font-semibold" : "font-normal"}`}>
                              {n.title}
                              {HIGH_PRIORITY.has(n.type) && !n.isRead && (
                                <span className="ml-1.5 inline-block w-1.5 h-1.5 bg-red-500 rounded-full align-middle" />
                              )}
                            </p>
                            {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>}
                            <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(n.createdAt), "dd MMM, HH:mm")}</p>
                          </div>
                          <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!n.isRead && (
                              <button onClick={() => markRead(n.id)} className="text-muted-foreground hover:text-primary transition-colors p-1 rounded" title="Mark read">
                                <Check className="h-3 w-3" />
                              </button>
                            )}
                            <button onClick={() => deleteNotif(n.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded" title="Delete">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Show more digest toggle */}
                  {!showAll && notifications.length > displayed.length && (
                    <button
                      onClick={() => setShowAll(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                      Show {notifications.length - displayed.length} more
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
