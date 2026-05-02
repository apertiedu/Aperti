import { useState, useEffect, useRef } from "react";
import { Bell, Check, CheckCheck, Trash2, AlertTriangle, Info, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  error: XCircle,
};
const TYPE_COLOR: Record<string, string> = {
  info: "text-blue-500",
  warning: "text-amber-500",
  success: "text-emerald-500",
  error: "text-red-500",
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const [notifRes, countRes] = await Promise.all([
        fetch("/api/notifications", { credentials: "include" }),
        fetch("/api/notifications/unread-count", { credentials: "include" }),
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
    await fetch("/api/notifications/read-all", { method: "POST", credentials: "include" });
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const markRead = async (id: number) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH", credentials: "include" });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const deleteNotif = async (id: number) => {
    await fetch(`/api/notifications/${id}`, { method: "DELETE", credentials: "include" });
    const notif = notifications.find(n => n.id === id);
    if (notif && !notif.isRead) setUnreadCount(prev => Math.max(0, prev - 1));
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div ref={ref} className="relative">
      <button
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        onClick={() => setOpen(o => !o)}
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-sm">Notifications</h3>
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
              notifications.map(n => {
                const Icon = TYPE_ICON[n.type] ?? Info;
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors group ${!n.isRead ? "bg-primary/5" : ""}`}
                  >
                    <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${TYPE_COLOR[n.type] ?? "text-muted-foreground"}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.isRead ? "font-medium" : "font-normal"}`}>{n.title}</p>
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
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
