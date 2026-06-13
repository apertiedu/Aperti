import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import {
  ClipboardCheck, Search, Monitor, QrCode, Users, Pencil,
  Trash2, Shield, RefreshCw, Clock, Download,
} from "lucide-react";

type AuditRow = {
  id: number; student_id: number; lesson_id?: number;
  action: string; old_status?: string; new_status?: string;
  performed_by_name?: string; performed_by_role?: string;
  device_info?: string; scan_method?: string; notes?: string;
  created_at: string; student_name?: string; student_code?: string;
  lesson_number?: number; day_of_week?: string;
};

const ACTION_META: Record<string, { label: string; color: string; icon: any }> = {
  mark_present:   { label: "Marked Present",  color: "bg-emerald-100 text-emerald-700", icon: ClipboardCheck },
  mark_absent:    { label: "Marked Absent",   color: "bg-red-100 text-red-700",         icon: ClipboardCheck },
  mark_late:      { label: "Marked Late",     color: "bg-amber-100 text-amber-700",     icon: Clock },
  bulk_scan:      { label: "Bulk Scan",       color: "bg-blue-100 text-blue-700",       icon: Users },
  qr_scan:        { label: "QR Scan",         color: "bg-purple-100 text-purple-700",   icon: QrCode },
  edit:           { label: "Edited",          color: "bg-yellow-100 text-yellow-700",   icon: Pencil },
  delete:         { label: "Deleted",         color: "bg-rose-100 text-rose-700",       icon: Trash2 },
  api:            { label: "API Action",      color: "bg-gray-100 text-gray-600",       icon: Monitor },
};

const SCAN_ICONS: Record<string, any> = {
  manual: Pencil,
  qr: QrCode,
  bulk: Users,
  api: Monitor,
};

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return ts; }
}

export default function AttendanceAuditPage() {
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const { data, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ["attendance-audit", page, filterAction, filterMethod],
    queryFn: () => apiFetch(`/api/attendance-audit?limit=${pageSize}&offset=${page * pageSize}`).then(r => r.json()),
    staleTime: 30000,
  });

  const { data: summary } = useQuery<any>({
    queryKey: ["attendance-audit-summary"],
    queryFn: () => apiFetch("/api/attendance-audit/summary").then(r => r.json()),
    staleTime: 60000,
  });

  const rows: AuditRow[] = data?.rows ?? [];
  const total: number = data?.total ?? 0;
  const recent: AuditRow[] = summary?.recent ?? [];

  const filtered = rows.filter(r => {
    if (filterAction !== "all" && r.action !== filterAction) return false;
    if (filterMethod !== "all" && r.scan_method !== filterMethod) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.student_name?.toLowerCase().includes(q) ||
        r.student_code?.toLowerCase().includes(q) ||
        r.performed_by_name?.toLowerCase().includes(q) ||
        r.action?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const downloadCsv = () => {
    const header = "Date,Student,Code,Action,Old Status,New Status,Performed By,Role,Method,Lesson\n";
    const body = rows.map(r =>
      [formatTime(r.created_at), r.student_name, r.student_code, r.action, r.old_status, r.new_status, r.performed_by_name, r.performed_by_role, r.scan_method, `Lesson ${r.lesson_number} ${r.day_of_week}`].join(",")
    ).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "attendance-audit.csv"; a.click();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Attendance Audit Trail
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Full history of every attendance action — who, when, and how</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadCsv} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Entries", value: total },
          { label: "QR Scans", value: (summary?.byAction ?? []).filter((r: any) => r.scan_method === "qr").reduce((s: number, r: any) => s + parseInt(r.count), 0) },
          { label: "Manual Edits", value: (summary?.byAction ?? []).filter((r: any) => r.scan_method === "manual").reduce((s: number, r: any) => s + parseInt(r.count), 0) },
          { label: "Top Actor", value: (summary?.topActors ?? [])[0]?.performed_by_name?.split(" ")[0] ?? "—" },
        ].map(({ label, value }) => (
          <Card key={label} className="shadow-sm">
            <CardContent className="p-4">
              <p className="text-xl font-bold text-foreground">{isLoading ? "…" : value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student, actor…" className="pl-9 h-9 text-sm" />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="All actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {Object.entries(ACTION_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterMethod} onValueChange={setFilterMethod}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="All methods" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="qr">QR Code</SelectItem>
            <SelectItem value="bulk">Bulk</SelectItem>
            <SelectItem value="api">API</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-sm text-muted-foreground font-medium">
            {isLoading ? "Loading…" : `${filtered.length} of ${total} entries`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Shield className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No audit entries found</p>
              <p className="text-sm mt-1">Attendance actions will be logged here as they occur.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(row => {
                const meta = ACTION_META[row.action] ?? { label: row.action, color: "bg-gray-100 text-gray-600", icon: ClipboardCheck };
                const Icon = meta.icon;
                const ScanIcon = SCAN_ICONS[row.scan_method ?? "manual"] ?? Pencil;
                return (
                  <div key={row.id} className="flex items-start gap-3 p-3 hover:bg-muted/30 transition-colors">
                    <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${meta.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
                      <div>
                        <p className="text-sm font-medium text-foreground">{row.student_name ?? `Student #${row.student_id}`}</p>
                        <p className="text-xs text-muted-foreground">{row.student_code} · {row.day_of_week} Lesson {row.lesson_number}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                        <Badge className={`text-[10px] h-4 px-1.5 ${meta.color} border-0`}>{meta.label}</Badge>
                        {row.old_status && row.new_status && (
                          <span className="text-[10px] text-muted-foreground">{row.old_status} → {row.new_status}</span>
                        )}
                        {row.scan_method && <ScanIcon className="h-3 w-3 text-muted-foreground" />}
                      </div>
                      <p className="text-xs text-muted-foreground col-span-2">
                        By <span className="font-medium text-foreground">{row.performed_by_name ?? "System"}</span>
                        {row.performed_by_role && <span className="text-muted-foreground"> ({row.performed_by_role})</span>}
                        <span className="mx-1">·</span>{formatTime(row.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
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
