import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle, Clock, XCircle, ChevronDown, ChevronUp, RefreshCw, Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";

const api = (path: string, opts?: RequestInit) =>
  fetch(path, { ...opts, credentials: "include", headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) } });

const STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  open:        { label: "Open",        cls: "bg-yellow-100 text-yellow-700", icon: AlertTriangle },
  in_progress: { label: "In Progress", cls: "bg-blue-100 text-blue-700",    icon: Clock },
  resolved:    { label: "Resolved",    cls: "bg-green-100 text-green-700",  icon: CheckCircle },
  closed:      { label: "Closed",      cls: "bg-gray-100 text-gray-500",    icon: XCircle },
};

const CATEGORY_COLORS: Record<string, string> = {
  "UI/UX":      "bg-purple-100 text-purple-700",
  "Performance":"bg-orange-100 text-orange-700",
  "Data":       "bg-blue-100 text-blue-700",
  "Auth":       "bg-red-100 text-red-700",
  "Payment":    "bg-emerald-100 text-emerald-700",
  "Other":      "bg-gray-100 text-gray-600",
};

function ReportRow({ report, onUpdate }: { report: any; onUpdate: (id: number, data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(report.admin_notes || "");
  const [status, setStatus] = useState(report.status);
  const [saving, setSaving] = useState(false);

  const StatusIcon = STATUS_META[report.status]?.icon ?? AlertTriangle;

  const save = async () => {
    setSaving(true);
    await onUpdate(report.id, { status, adminNotes: notes });
    setSaving(false);
  };

  const timeAgo = (date: string) => {
    const diff = (Date.now() - new Date(date).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50/50 transition-colors"
      >
        <div className={`p-1.5 rounded-lg ${STATUS_META[report.status]?.cls || "bg-gray-100 text-gray-500"}`}>
          <StatusIcon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-gray-900 truncate">#{report.id} — {report.description?.slice(0, 80)}{report.description?.length > 80 ? "…" : ""}</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>{report.display_name || report.username || "Anonymous"}</span>
            <span>·</span>
            <span className={`px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[report.category] || CATEGORY_COLORS.Other}`}>{report.category}</span>
            <span>·</span>
            <span>{timeAgo(report.created_at)}</span>
            {report.page_url && <><span>·</span><span className="truncate max-w-[120px]">{report.page_url}</span></>}
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_META[report.status]?.cls || "bg-gray-100"}`}>
          {STATUS_META[report.status]?.label || report.status}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-0 border-t border-gray-100 space-y-4">
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Full Description</p>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 leading-relaxed">{report.description}</div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Reporter</p>
                    <p className="text-sm text-gray-700">{report.display_name || report.username || "Anonymous"} <span className="text-gray-400">({report.user_role || "—"})</span></p>
                  </div>
                  {report.page_url && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Page URL</p>
                      <p className="text-sm text-primary break-all">{report.page_url}</p>
                    </div>
                  )}
                  {report.user_agent && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">User Agent</p>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        {/mobile/i.test(report.user_agent) ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                        <span className="truncate">{report.user_agent?.slice(0, 80)}</span>
                      </div>
                    </div>
                  )}
                  {report.resolved_at && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Resolved At</p>
                      <p className="text-sm text-gray-600">{new Date(report.resolved_at).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Update Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary/60 bg-white"
                  >
                    {Object.entries(STATUS_META).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Admin Notes</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Add internal notes…"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary/60 resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Save Changes
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ProblemReportsPage() {
  const [statusFilter, setStatusFilter] = useState("open");
  const qc = useQueryClient();

  const { data: reports = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["admin-problem-reports"],
    queryFn: () => api("/api/admin/problem-reports").then(r => r.json()),
    refetchInterval: 30000,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api(`/api/admin/problem-reports/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-problem-reports"] }); toast.success("Report updated"); },
    onError: () => toast.error("Update failed"),
  });

  const filtered = (reports as any[]).filter(r => statusFilter === "all" || r.status === statusFilter);

  const counts = (reports as any[]).reduce((acc: Record<string, number>, r: any) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Problem Reports</h1>
          <p className="text-sm text-gray-500">User-reported bugs, issues, and feedback</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { key: "open",        label: "Open",        color: "text-yellow-600", bg: "bg-yellow-50" },
          { key: "in_progress", label: "In Progress", color: "text-blue-600",   bg: "bg-blue-50"   },
          { key: "resolved",    label: "Resolved",    color: "text-green-600",  bg: "bg-green-50"  },
          { key: "closed",      label: "Closed",      color: "text-gray-500",   bg: "bg-gray-50"   },
        ].map(s => (
          <div key={s.key} className={`${s.bg} rounded-xl p-4 text-center border border-transparent`}>
            <p className={`text-2xl font-bold ${s.color}`}>{counts[s.key] || 0}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { key: "all",        label: "All" },
          { key: "open",       label: "Open" },
          { key: "in_progress",label: "In Progress" },
          { key: "resolved",   label: "Resolved" },
          { key: "closed",     label: "Closed" },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${statusFilter === f.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {f.label} {f.key !== "all" && counts[f.key] ? `(${counts[f.key]})` : ""}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No reports found</p>
          <p className="text-xs mt-1">Reports submitted by users will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((report: any) => (
            <ReportRow
              key={report.id}
              report={report}
              onUpdate={(id, data) => updateMut.mutate({ id, data })}
            />
          ))}
          <p className="text-xs text-gray-400 text-center pt-2">{filtered.length} report{filtered.length !== 1 ? "s" : ""} shown</p>
        </div>
      )}
    </div>
  );
}
