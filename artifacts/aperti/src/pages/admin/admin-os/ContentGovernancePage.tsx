import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Edit2, Check, X, ExternalLink, Clock, Tag, User, Shield } from "lucide-react";



interface GovernanceEntry {
  id: number;
  page_url: string;
  page_name: string;
  owner_id: number | null;
  owner_name: string | null;
  owner_email: string | null;
  reviewer_id: number | null;
  reviewer_name: string | null;
  reviewer_email: string | null;
  approval_date: string | null;
  last_updated: string;
  version: string;
  notes: string | null;
}

function fetchJSON(url: string, opts?: RequestInit) {
  return fetch(url, {
    ...opts,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...opts?.headers },
  }).then(r => r.json());
}

function EditModal({ entry, onClose }: { entry: GovernanceEntry; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    version: entry.version ?? "1.0",
    approval_date: entry.approval_date ? entry.approval_date.slice(0, 10) : "",
    notes: entry.notes ?? "",
  });

  const save = useMutation({
    mutationFn: (data: typeof form) =>
      fetchJSON(`/api/admin/content-governance/${entry.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["content-governance"] }); onClose(); },
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-extrabold text-gray-900">{entry.page_name}</h3>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{entry.page_url}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Version</label>
            <input
              value={form.version}
              onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-gray-50/50"
              placeholder="e.g. 1.0, 2.1" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Last Reviewed / Approved Date</label>
            <input
              type="date"
              value={form.approval_date}
              onChange={e => setForm(f => ({ ...f, approval_date: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-gray-50/50" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-gray-50/50 resize-none"
              placeholder="Any notes about this page's content status..." />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => save.mutate(form)}
            disabled={save.isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 bg-primary text-primary-foreground">
            {save.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function statusBadge(entry: GovernanceEntry) {
  if (!entry.approval_date) return { label: "Never reviewed", color: "#EF4444", bg: "#FEF2F2" };
  const reviewedAt = new Date(entry.approval_date);
  const daysSince = Math.floor((Date.now() - reviewedAt.getTime()) / 86400000);
  if (daysSince < 30) return { label: "Current", color: "#22C55E", bg: "#F0FDF4" };
  if (daysSince < 90) return { label: `${daysSince}d ago`, color: "#F59E0B", bg: "#FFFBEB" };
  return { label: `${daysSince}d overdue`, color: "#EF4444", bg: "#FEF2F2" };
}

export default function ContentGovernancePage() {
  const [editing, setEditing] = useState<GovernanceEntry | null>(null);
  const [search, setSearch] = useState("");

  const { data: entries = [], isLoading } = useQuery<GovernanceEntry[]>({
    queryKey: ["content-governance"],
    queryFn: () => fetchJSON("/api/admin/content-governance"),
    staleTime: 60_000,
  });

  const filtered = entries.filter(e =>
    e.page_name.toLowerCase().includes(search.toLowerCase()) ||
    e.page_url.toLowerCase().includes(search.toLowerCase()),
  );

  const stats = {
    total: entries.length,
    reviewed: entries.filter(e => e.approval_date).length,
    current: entries.filter(e => {
      if (!e.approval_date) return false;
      return Math.floor((Date.now() - new Date(e.approval_date).getTime()) / 86400000) < 30;
    }).length,
    overdue: entries.filter(e => {
      if (!e.approval_date) return true;
      return Math.floor((Date.now() - new Date(e.approval_date).getTime()) / 86400000) > 90;
    }).length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/8">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Content Governance</h1>
            <p className="text-sm text-gray-500">Track review status and ownership of every public-facing page.</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Pages", value: stats.total, icon: FileText, color: "hsl(var(--primary))" },
          { label: "Reviewed", value: stats.reviewed, icon: Check, color: "#22C55E" },
          { label: "Current (< 30d)", value: stats.current, icon: Clock, color: "#3B82F6" },
          { label: "Needs Review", value: stats.overdue, icon: X, color: "#EF4444" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label} whileHover={{ y: -3 }}
              className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${s.color}15` }}>
                  <Icon className="h-4 w-4" style={{ color: s.color }} />
                </div>
              </div>
              <p className="text-2xl font-black text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">{s.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search pages…"
          className="w-full max-w-sm px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-gray-50/50" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 animate-pulse py-4">{[1,2,3].map(i=><div key={i} className="h-16 bg-gray-100 rounded-xl" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Page", "URL", "Version", "Owner", "Last Reviewed", "Status", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((entry) => {
                  const badge = statusBadge(entry);
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-primary/8">
                            <FileText className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <span className="font-semibold text-gray-900 text-xs">{entry.page_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <a href={entry.page_url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs font-mono text-gray-500 hover:text-gray-800 transition-colors">
                          {entry.page_url} <ExternalLink className="h-3 w-3 opacity-50" />
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/8 text-primary">
                          v{entry.version}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {entry.owner_name ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 bg-primary text-primary-foreground">
                              {entry.owner_name.charAt(0)}
                            </div>
                            <span className="text-xs text-gray-600">{entry.owner_name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300 flex items-center gap-1">
                            <User className="h-3 w-3" />Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {entry.approval_date
                          ? new Date(entry.approval_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: badge.bg, color: badge.color }}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setEditing(entry)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all">
                          <Edit2 className="h-3 w-3" />Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                      No pages found{search ? ` matching "${search}"` : ""}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notes section */}
      <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-gray-900">Review Policy</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-500">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: "#22C55E" }} />
            <span><strong className="text-gray-700">Current (green):</strong> Reviewed within the last 30 days. No action needed.</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: "#F59E0B" }} />
            <span><strong className="text-gray-700">Warning (amber):</strong> Reviewed 30–90 days ago. Schedule a review soon.</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: "#EF4444" }} />
            <span><strong className="text-gray-700">Overdue (red):</strong> Not reviewed in over 90 days or never reviewed. Requires immediate attention.</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {editing && <EditModal entry={editing} onClose={() => setEditing(null)} />}
      </AnimatePresence>
    </div>
  );
}
