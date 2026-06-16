import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, MessageSquare, ClipboardList, AlertTriangle,
  Ticket, UserPlus, RefreshCw, CheckCheck, Search,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { AppEmptyState, CelebrationBanner } from "@/components/app-empty-state";

type NotifItem = {
  id: number; type: string; category: string;
  title: string; subtitle?: string; created_at: string; is_read: boolean;
};

type InboxData = {
  items: NotifItem[];
  total: number;
  counts: Record<string, number>;
};

const TYPE_META: Record<string, { icon: any; color: string; label: string }> = {
  message:    { icon: MessageSquare, color: "text-teal-600 bg-teal-50",     label: "Messages" },
  submission: { icon: ClipboardList, color: "text-amber-600 bg-amber-50",   label: "Submissions" },
  alert:      { icon: AlertTriangle, color: "text-red-600 bg-red-50",       label: "Alerts" },
  ticket:     { icon: Ticket,        color: "text-purple-600 bg-purple-50", label: "Tickets" },
  enrollment: { icon: UserPlus,      color: "text-blue-600 bg-blue-50",     label: "Enrollment" },
};

const TYPE_HREFS: Record<string, string> = {
  message:    "/messages",
  submission: "/grade-flow",
  alert:      "/admin/founder/alerts",
  ticket:     "/admin/founder/support",
  enrollment: "/enrollment-timeline",
};

function formatRelative(ts: string) {
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch { return ""; }
}

function getDateGroup(ts: string): string {
  try {
    const now = new Date();
    const d = new Date(ts);
    const diffDays = Math.floor((now.setHours(0,0,0,0) - new Date(d).setHours(0,0,0,0)) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays <= 6) return "This week";
    if (diffDays <= 29) return "This month";
    return "Older";
  } catch { return "Older"; }
}

const GROUP_ORDER = ["Today", "Yesterday", "This week", "This month", "Older"];

export default function NotificationCenter() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [read, setRead] = useState<Set<number>>(new Set());

  const { data, isLoading, isFetching, refetch } = useQuery<InboxData>({
    queryKey: ["notifications-inbox"],
    queryFn: () => apiFetch("/api/notifications/inbox").then(r => r.json()),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const items = data?.items ?? [];
  const counts = data?.counts ?? {};
  const total = data?.total ?? 0;

  const filtered = items.filter(item => {
    if (filterType !== "all" && item.type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return item.title?.toLowerCase().includes(q) || item.subtitle?.toLowerCase().includes(q);
    }
    return true;
  });

  const unreadCount = items.filter(i => !i.is_read && !read.has(i.id)).length;

  const markRead = (id: number) => setRead(prev => new Set([...prev, id]));
  const markAllRead = () => setRead(new Set(items.map(i => i.id)));

  const tabs = [
    { key: "all",        label: "All",         count: total },
    ...Object.entries(TYPE_META).map(([key, m]) => ({ key, label: m.label, count: counts[key] ?? 0 })).filter(t => t.count > 0),
  ];

  const grouped = filtered.reduce<Record<string, NotifItem[]>>((acc, item) => {
    const g = getDateGroup(item.created_at);
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {});

  const groupKeys = GROUP_ORDER.filter(k => grouped[k]?.length);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Notification Center
            {unreadCount > 0 && (
              <Badge className="h-5 text-[10px] bg-primary text-white">{unreadCount}</Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All your activity in one place — messages, submissions, alerts, and more
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1.5 text-xs">
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterType(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filterType === tab.key
                ? "bg-primary text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[10px] px-1 rounded-full ${filterType === tab.key ? "bg-white/20" : "bg-background"}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notifications…" className="pl-9 h-9 text-sm" />
      </div>

      {/* Items grouped by date */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 && search ? (
        <AppEmptyState
          type="search-no-results"
          searchQuery={search}
          size="md"
        />
      ) : filtered.length === 0 ? (
        <AppEmptyState
          type={filterType === "all" ? "inbox-zero" : "notifications"}
          title={filterType === "all" ? "You're all caught up" : `No ${TYPE_META[filterType]?.label ?? filterType} notifications`}
          description={filterType === "all" ? "No new activity. New messages, submissions, and alerts will appear here automatically." : `You have no ${TYPE_META[filterType]?.label?.toLowerCase() ?? filterType} notifications right now.`}
          size="md"
        />
      ) : (
        <AnimatePresence initial={false}>
          <div className="space-y-6">
            {groupKeys.map(groupLabel => (
              <div key={groupLabel}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                  {groupLabel}
                </p>
                <div className="space-y-2">
                  {grouped[groupLabel].map(item => {
                    const meta = TYPE_META[item.type] ?? { icon: Bell, color: "text-gray-600 bg-gray-50", label: item.category };
                    const Icon = meta.icon;
                    const isUnread = !item.is_read && !read.has(item.id);
                    const href = TYPE_HREFS[item.type] ?? "/";
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        onClick={() => markRead(item.id)}
                      >
                        <a href={href}>
                          <Card className={`shadow-sm cursor-pointer hover:border-primary/30 transition-all ${isUnread ? "border-primary/20 bg-primary/[0.02]" : ""}`}>
                            <CardContent className="p-3 flex items-start gap-3">
                              <div className={`p-2 rounded-lg shrink-0 ${meta.color}`}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className={`text-sm ${isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/80"} leading-snug`}>
                                    {item.title}
                                  </p>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {isUnread && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">{formatRelative(item.created_at)}</span>
                                  </div>
                                </div>
                                {item.subtitle && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.subtitle}</p>
                                )}
                                <Badge variant="outline" className="mt-1 text-[10px] h-4 px-1">{meta.label}</Badge>
                              </div>
                            </CardContent>
                          </Card>
                        </a>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </AnimatePresence>
      )}

      {!isLoading && total === 0 && unreadCount === 0 && (
        <CelebrationBanner
          title="Notification history clear"
          description="As your activity grows — submissions, messages, alerts — they'll all be logged here in real time."
        />
      )}
    </div>
  );
}
