import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, CheckCheck, BookOpen, ClipboardList, MessageSquare, FileText, AlertTriangle, GraduationCap } from "lucide-react";

const TEAL = "#0D9488";
const authFetch = (url: string, opts?: RequestInit) =>
  fetch(url, { ...opts, headers: { Authorization: `Bearer ${localStorage.getItem("aperti_token") || ""}`, "Content-Type": "application/json", ...(opts?.headers || {}) } });

function typeIcon(type: string) {
  switch (type) {
    case "attendance": return <ClipboardList className="h-4 w-4 text-teal-500" />;
    case "grade": return <GraduationCap className="h-4 w-4 text-indigo-500" />;
    case "assignment": return <BookOpen className="h-4 w-4 text-amber-500" />;
    case "message": return <MessageSquare className="h-4 w-4 text-teal-500" />;
    case "report": return <FileText className="h-4 w-4 text-gray-500" />;
    case "alert": return <AlertTriangle className="h-4 w-4 text-red-500" />;
    default: return <Bell className="h-4 w-4 text-gray-400" />;
  }
}

function typeColor(type: string) {
  switch (type) {
    case "attendance": return "bg-teal-50";
    case "grade": return "bg-indigo-50";
    case "assignment": return "bg-amber-50";
    case "message": return "bg-teal-50";
    case "alert": return "bg-red-50";
    default: return "bg-gray-50";
  }
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default function ParentNotifications() {
  const qc = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<any[]>({
    queryKey: ["parent-notifications"],
    queryFn: () => authFetch("/api/parent/notifications").then(r => r.json()),
    refetchInterval: 30000,
  });

  const markRead = useMutation({
    mutationFn: (id: number) => authFetch(`/api/parent/notifications/${id}/read`, { method: "PUT" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parent-notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => authFetch("/api/parent/notifications/read-all", { method: "PUT" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parent-notifications"] }),
  });

  const unread = notifications.filter(n => !n.is_read);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center relative" style={{ background: "#FEF3C7" }}>
            <Bell className="h-5 w-5 text-amber-500" />
            {unread.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">{unread.length}</span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-500">{unread.length} unread</p>
          </div>
        </div>
        {unread.length > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs" onClick={() => markAllRead.mutate()}>
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </Button>
        )}
      </motion.div>

      {isLoading ? (
        <div className="space-y-2">{[0,1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="h-12 w-12 mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400 text-sm">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n, i) => (
            <motion.div key={n.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
              <div
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${n.is_read ? "border-gray-100 bg-white opacity-70" : "border-gray-200 bg-white shadow-sm"}`}
                onClick={() => !n.is_read && markRead.mutate(n.id)}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeColor(n.type)}`}>
                  {typeIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm ${n.is_read ? "font-medium text-gray-600" : "font-semibold text-gray-900"}`}>{n.title}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-gray-400">{timeAgo(n.created_at)}</span>
                      {!n.is_read && <div className="w-2 h-2 rounded-full" style={{ background: TEAL }} />}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
