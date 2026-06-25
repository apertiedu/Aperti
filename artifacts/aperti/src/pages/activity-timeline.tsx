import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity, Search, Filter, RefreshCw,
  UserPlus, ClipboardCheck, BookOpen, FileText,
  UserCheck, Upload, Award, Shield,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { AppEmptyState } from "@/components/app-empty-state";

const ACTION_META: Record<string, { icon: any; color: string; label: string }> = {
  enrollment_requested:   { icon: UserPlus,      color: "text-blue-600 bg-blue-50",    label: "Enrollment" },
  enrollment_approved:    { icon: UserCheck,     color: "text-emerald-600 bg-emerald-50", label: "Enrollment" },
  enrollment_rejected:    { icon: UserPlus,      color: "text-red-600 bg-red-50",      label: "Enrollment" },
  enrollment_cancelled:   { icon: UserPlus,      color: "text-gray-600 bg-gray-50",    label: "Enrollment" },
  enrollment_suspended:   { icon: UserPlus,      color: "text-orange-600 bg-orange-50",label: "Enrollment" },
  grade_approved:         { icon: ClipboardCheck,color: "text-emerald-600 bg-emerald-50", label: "Grading" },
  exam_created:           { icon: FileText,      color: "text-purple-600 bg-purple-50",label: "Exam" },
  material_uploaded:      { icon: Upload,        color: "text-sky-600 bg-sky-50",      label: "Material" },
  course_created:         { icon: BookOpen,      color: "text-primary bg-primary/10",  label: "Course" },
  course_updated:         { icon: BookOpen,      color: "text-primary bg-primary/10",  label: "Course" },
  assistant_assigned:     { icon: UserCheck,     color: "text-teal-600 bg-teal-50",    label: "Assistant" },
  login:                  { icon: Shield,        color: "text-gray-600 bg-gray-50",    label: "Auth" },
};

function getActionMeta(action: string) {
  for (const [key, meta] of Object.entries(ACTION_META)) {
    if (action.startsWith(key) || action === key) return { ...meta, matchedKey: key };
  }
  return { icon: Activity, color: "text-muted-foreground bg-muted", label: action, matchedKey: action };
}

function formatDateGroup(ts: string): string {
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

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return ts; }
}

type LogEntry = {
  id: number;
  action: string;
  entity_type?: string;
  entity_id?: number;
  entity_name?: string;
  description?: string;
  actor_name?: string;
  actor_role?: string;
  metadata?: any;
  created_at: string;
};

const GROUP_ORDER = ["Today", "Yesterday", "This week", "This month", "Older"];
const ENTITY_TYPES = ["enrollment", "course", "exam", "grade", "material", "assistant", "student"];

export default function ActivityTimeline() {
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 40;

  const params = new URLSearchParams();
  if (entityType !== "all") params.set("entity_type", entityType);
  params.set("limit", String(pageSize));
  params.set("offset", String(page * pageSize));

  const { data, isLoading, isFetching, refetch } = useQuery<{ logs: LogEntry[]; total: number }>({
    queryKey: ["activity-timeline", entityType, page],
    queryFn: () => apiFetch(`/api/teacher-ops/activity?${params}`).then(r => r.json()),
    staleTime: 30000,
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;

  const filtered = search
    ? logs.filter(l =>
        (l.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (l.actor_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (l.entity_name ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const grouped = filtered.reduce<Record<string, LogEntry[]>>((acc, log) => {
    const g = formatDateGroup(log.created_at);
    if (!acc[g]) acc[g] = [];
    acc[g].push(log);
    return acc;
  }, {});

  const groupKeys = GROUP_ORDER.filter(k => grouped[k]?.length);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Activity Timeline
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Immutable, timestamped record of all platform activity in your workspace
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search activity…"
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={entityType} onValueChange={v => { setEntityType(v); setPage(0); }}>
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {ENTITY_TYPES.map(t => (
              <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground shrink-0">{total} total</p>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <AppEmptyState
          type={search ? "search-no-results" : "empty"}
          searchQuery={search}
          title="No activity logged yet"
          description="Actions like enrollments, grading, and course changes will appear here."
          size="md"
        />
      ) : (
        <div className="space-y-8">
          {groupKeys.map(groupLabel => (
            <div key={groupLabel}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 px-1">
                {groupLabel}
              </p>
              <div className="relative pl-4 border-l-2 border-border space-y-1">
                {grouped[groupLabel].map((log, idx) => {
                  const meta = getActionMeta(log.action);
                  const Icon = meta.icon;
                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="relative flex items-start gap-3 py-2"
                    >
                      <div className={`absolute -left-5 w-2 h-2 rounded-full border-2 border-background ${
                        log.action.includes("approved") || log.action.includes("grade_approved")
                          ? "bg-emerald-500"
                          : log.action.includes("rejected") || log.action.includes("cancelled")
                            ? "bg-red-500"
                            : "bg-primary"
                      } mt-3`} />

                      <div className={`p-1.5 rounded-lg shrink-0 ${meta.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm text-foreground/90 leading-snug">
                              {log.description || `${log.actor_name || "Someone"} performed ${log.action}`}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {log.actor_role && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1 capitalize">
                                  {log.actor_role}
                                </Badge>
                              )}
                              {log.entity_type && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1 capitalize">
                                  {log.entity_type}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                            {formatTime(log.created_at)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
