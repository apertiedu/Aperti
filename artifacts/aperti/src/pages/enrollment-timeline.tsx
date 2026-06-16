import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import {
  Users, Search, BookOpen, ArrowRightLeft, UserPlus,
  UserMinus, RefreshCw, Download, History,
} from "lucide-react";
import { AppEmptyState } from "@/components/app-empty-state";

type TimelineRow = {
  id: number; student_id: number; action: string;
  entity_type?: string; entity_id?: number; entity_name?: string;
  previous_value?: string; new_value?: string;
  performed_by_name?: string; notes?: string;
  created_at: string; student_name?: string; student_code?: string;
};

const ACTION_META: Record<string, { label: string; color: string; icon: any }> = {
  enrolled:         { label: "Enrolled",         color: "bg-emerald-100 text-emerald-700", icon: UserPlus },
  withdrawn:        { label: "Withdrawn",        color: "bg-red-100 text-red-700",         icon: UserMinus },
  transferred:      { label: "Transferred",      color: "bg-blue-100 text-blue-700",       icon: ArrowRightLeft },
  suspended:        { label: "Suspended",        color: "bg-amber-100 text-amber-700",     icon: UserMinus },
  "re-enrolled":    { label: "Re-enrolled",      color: "bg-primary/15 text-primary",       icon: UserPlus },
  lesson_changed:   { label: "Lesson Changed",   color: "bg-purple-100 text-purple-700",   icon: ArrowRightLeft },
  subject_added:    { label: "Subject Added",    color: "bg-sky-100 text-sky-700",         icon: BookOpen },
  subject_removed:  { label: "Subject Removed",  color: "bg-orange-100 text-orange-700",   icon: BookOpen },
};

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return ts; }
}

function formatDate(ts: string) {
  try {
    return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return ts; }
}

export default function EnrollmentTimelinePage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [studentId, setStudentId] = useState("");
  const pageSize = 30;

  const { data, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ["enrollment-timeline", page, studentId],
    queryFn: () => apiFetch(`/api/enrollment-timeline?limit=${pageSize}&offset=${page * pageSize}${studentId ? `&studentId=${studentId}` : ""}`).then(r => r.json()),
    staleTime: 30000,
  });

  const rows: TimelineRow[] = data?.rows ?? [];
  const total: number = data?.total ?? 0;

  const filtered = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.student_name?.toLowerCase().includes(q) ||
      r.student_code?.toLowerCase().includes(q) ||
      r.action?.toLowerCase().includes(q) ||
      r.entity_name?.toLowerCase().includes(q)
    );
  });

  const downloadCsv = () => {
    const header = "Date,Student,Code,Action,Entity Type,Entity Name,Previous,New Value,Performed By\n";
    const body = rows.map(r =>
      [formatTime(r.created_at), r.student_name, r.student_code, r.action, r.entity_type, r.entity_name, r.previous_value, r.new_value, r.performed_by_name].join(",")
    ).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "enrollment-timeline.csv"; a.click();
  };

  const groupedByDate = filtered.reduce((acc, row) => {
    const date = formatDate(row.created_at);
    if (!acc[date]) acc[date] = [];
    acc[date].push(row);
    return acc;
  }, {} as Record<string, TimelineRow[]>);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <History className="h-6 w-6 text-primary" /> Enrollment Timeline
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Every enrollment change, transfer, and status update in chronological order</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadCsv} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student or action…" className="pl-9 h-9 text-sm" />
        </div>
        <Input value={studentId} onChange={e => { setStudentId(e.target.value); setPage(0); }} placeholder="Filter by student ID" className="w-44 h-9 text-sm" />
      </div>

      {/* Summary strip */}
      <div className="flex gap-4 flex-wrap text-sm text-muted-foreground">
        <span>{isLoading ? "…" : total} total changes</span>
        <span>· {Object.keys(groupedByDate).length} active days</span>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="shadow-sm border-dashed border-2">
          <CardContent className="py-2">
            <AppEmptyState type="enrollments" title="No enrollment changes found" description="Enrollment events will appear here as students are added, moved, or removed." size="md" />
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedByDate).map(([date, dateRows]) => (
          <div key={date}>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold text-muted-foreground px-2 py-0.5 bg-muted rounded-full">{date}</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-2 pl-4 border-l-2 border-primary/20 ml-2">
              {dateRows.map(row => {
                const meta = ACTION_META[row.action] ?? { label: row.action, color: "bg-gray-100 text-gray-600", icon: Users };
                const Icon = meta.icon;
                return (
                  <Card key={row.id} className="shadow-sm relative">
                    <div className="absolute -left-5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                    <CardContent className="p-3 flex items-start gap-3">
                      <div className={`p-1.5 rounded-lg shrink-0 ${meta.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{row.student_name ?? `Student #${row.student_id}`}</p>
                          <Badge className={`text-[10px] h-4 px-1.5 border-0 ${meta.color}`}>{meta.label}</Badge>
                          {row.entity_name && (
                            <span className="text-xs text-muted-foreground">· {row.entity_type}: {row.entity_name}</span>
                          )}
                        </div>
                        {(row.previous_value || row.new_value) && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {row.previous_value && <span className="line-through mr-1">{row.previous_value}</span>}
                            {row.new_value && <span className="text-foreground font-medium">{row.new_value}</span>}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          By <span className="font-medium text-foreground">{row.performed_by_name ?? "System"}</span>
                          <span className="mx-1">·</span>
                          {new Date(row.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {row.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{row.notes}</p>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}

      {total > pageSize && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page + 1} of {Math.ceil(total / pageSize)}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * pageSize >= total}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
