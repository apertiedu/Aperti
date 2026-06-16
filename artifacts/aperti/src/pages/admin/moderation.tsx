import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, AlertTriangle, CheckCircle, X, Clock, Search,
  Eye, Trash2, Ban, Plus, BarChart2, TrendingUp, Filter,
  MessageSquare, Hash, Users,
} from "lucide-react";

const fetchJSON = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => r.json());
const postJSON = (url: string, body: unknown) =>
  fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
const putJSON = (url: string, body: unknown) =>
  fetch(url, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
const deleteReq = (url: string) =>
  fetch(url, { method: "DELETE", credentials: "include" }).then((r) => r.json());

type Report = {
  id: number; reported_by_name: string; content_type: string; content_id: number;
  reason: string; status: string; action: string | null; resolver_name: string | null;
  created_at: string;
};
type BlockedWord = { id: number; word: string; severity: string; created_at: string };
type ModerationStats = {
  total_reports: number; pending: number; resolved: number; avg_response_hours: number;
  by_type: Array<{ content_type: string; count: number }>;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  reviewing: "bg-blue-100 text-blue-700",
  resolved: "bg-green-100 text-green-700",
  dismissed: "bg-gray-100 text-gray-500",
};

const SEVERITY_STYLES: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};

export default function AdminModeration() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"reports" | "blocklist" | "analytics">("reports");
  const [filterStatus, setFilterStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [newWord, setNewWord] = useState("");
  const [newSeverity, setNewSeverity] = useState("medium");
  const [actionModal, setActionModal] = useState<Report | null>(null);
  const [actionChoice, setActionChoice] = useState("warn");

  const { data: reports = [], isLoading: reportsLoading } = useQuery<Report[]>({
    queryKey: ["moderation-reports", filterStatus],
    queryFn: () => fetchJSON(`/api/moderation/reports?status=${filterStatus}`),
    refetchInterval: 15000,
  });

  const { data: blocklist = [], isLoading: blockLoading } = useQuery<BlockedWord[]>({
    queryKey: ["blocklist"],
    queryFn: () => fetchJSON("/api/moderation/blocklist"),
    enabled: activeTab === "blocklist",
  });

  const { data: stats } = useQuery<ModerationStats>({
    queryKey: ["moderation-stats"],
    queryFn: () => fetchJSON("/api/moderation/stats"),
    enabled: activeTab === "analytics",
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      putJSON(`/api/moderation/reports/${id}`, { action, status: action === "dismiss" ? "dismissed" : "resolved" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["moderation-reports"] }); setActionModal(null); },
  });

  const addWordMutation = useMutation({
    mutationFn: () => postJSON("/api/moderation/blocklist", { word: newWord, severity: newSeverity }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["blocklist"] }); setNewWord(""); },
  });

  const removeWordMutation = useMutation({
    mutationFn: (id: number) => deleteReq(`/api/moderation/blocklist/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocklist"] }),
  });

  const filtered = reports.filter((r) =>
    !search || r.reason.toLowerCase().includes(search.toLowerCase()) ||
    r.reported_by_name.toLowerCase().includes(search.toLowerCase()) ||
    r.content_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto p-6 font-[Inter,sans-serif]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Moderation Center</h1>
          <p className="text-sm text-gray-500">Review flagged content, manage blocked words, and track trends</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {(["reports", "blocklist", "analytics"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${activeTab === t ? "bg-card text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "reports" ? "Flagged Reports" : t === "blocklist" ? "Blocked Words" : "Analytics"}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* REPORTS TAB */}
        {activeTab === "reports" && (
          <motion.div key="reports" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search reports…"
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/30" />
              </div>
              <div className="flex gap-1">
                {["pending", "reviewing", "resolved", "dismissed"].map((s) => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 text-xs rounded-full transition-colors capitalize ${filterStatus === s ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {reportsLoading ? (
              <div className="text-center py-16 text-gray-400">Loading reports…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No {filterStatus} reports</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((r) => (
                  <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-2xl border border-border shadow-sm p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {r.status === "pending" ? <Clock className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                            {r.status}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{r.content_type}</span>
                          <span className="text-xs text-gray-400">#{r.content_id}</span>
                        </div>
                        <p className="text-sm text-gray-800 font-medium mb-1 truncate">{r.reason}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span>Reported by {r.reported_by_name}</span>
                          <span>{new Date(r.created_at).toLocaleDateString()}</span>
                          {r.resolver_name && <span>→ {r.resolver_name}</span>}
                        </div>
                      </div>
                      {r.status === "pending" && (
                        <button onClick={() => setActionModal(r)}
                          className="flex-shrink-0 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5" /> Review
                        </button>
                      )}
                      {r.action && (
                        <span className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-lg capitalize">{r.action}</span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* BLOCKLIST TAB */}
        {activeTab === "blocklist" && (
          <motion.div key="blocklist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="bg-card rounded-2xl border border-border shadow-sm p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Add Blocked Word</h3>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Word or phrase</label>
                  <input value={newWord} onChange={(e) => setNewWord(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && newWord.trim()) addWordMutation.mutate(); }}
                    placeholder="Enter blocked word…"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/30" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Severity</label>
                  <select value={newSeverity} onChange={(e) => setNewSeverity(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <button onClick={() => { if (newWord.trim()) addWordMutation.mutate(); }}
                  disabled={!newWord.trim() || addWordMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>

            {blockLoading ? (
              <div className="space-y-3 animate-pulse py-2">{[1,2,3].map(i=><div key={i} className="h-12 bg-gray-100 rounded-xl" />)}</div>
            ) : blocklist.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Ban className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No blocked words yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {blocklist.map((w) => (
                  <div key={w.id} className="bg-card rounded-xl border border-border p-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{w.word}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${SEVERITY_STYLES[w.severity] ?? SEVERITY_STYLES.medium}`}>{w.severity}</span>
                    </div>
                    <button onClick={() => removeWordMutation.mutate(w.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === "analytics" && (
          <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Total Reports", value: stats?.total_reports ?? 0, icon: <AlertTriangle className="w-5 h-5" />, color: "text-amber-600 bg-amber-50" },
                { label: "Pending", value: stats?.pending ?? 0, icon: <Clock className="w-5 h-5" />, color: "text-blue-600 bg-blue-50" },
                { label: "Resolved", value: stats?.resolved ?? 0, icon: <CheckCircle className="w-5 h-5" />, color: "text-green-600 bg-green-50" },
                { label: "Avg Response", value: `${Math.round(stats?.avg_response_hours ?? 0)}h`, icon: <TrendingUp className="w-5 h-5" />, color: "text-primary bg-primary/8" },
              ].map((card) => (
                <div key={card.label} className="bg-card rounded-2xl border border-border shadow-sm p-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>
                    {card.icon}
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
                </div>
              ))}
            </div>

            {stats?.by_type && stats.by_type.length > 0 && (
              <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-gray-500" /> Reports by Content Type
                </h3>
                <div className="space-y-3">
                  {stats.by_type.map((item) => {
                    const max = Math.max(...stats.by_type.map((x) => x.count));
                    const pct = Math.round((item.count / max) * 100);
                    return (
                      <div key={item.content_type}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600 capitalize">{item.content_type}</span>
                          <span className="font-medium text-gray-900">{item.count}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                            className="h-full bg-red-400 rounded-full" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Modal */}
      <AnimatePresence>
        {actionModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-card rounded-2xl shadow-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Review Report #{actionModal.id}</h3>
                <button onClick={() => setActionModal(null)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm text-gray-700">
                <strong>Content type:</strong> {actionModal.content_type} #{actionModal.content_id}<br />
                <strong>Reason:</strong> {actionModal.reason}<br />
                <strong>Reported by:</strong> {actionModal.reported_by_name}
              </div>
              <div className="mb-4">
                <label className="text-xs font-medium text-gray-600 mb-2 block">Action to take</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "warn", label: "Warn User", icon: <AlertTriangle className="w-4 h-4" /> },
                    { key: "remove", label: "Remove Content", icon: <Trash2 className="w-4 h-4" /> },
                    { key: "ban", label: "Ban User", icon: <Ban className="w-4 h-4" /> },
                    { key: "dismiss", label: "Dismiss Report", icon: <X className="w-4 h-4" /> },
                  ].map((a) => (
                    <button key={a.key} onClick={() => setActionChoice(a.key)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm border transition-colors ${actionChoice === a.key ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                      {a.icon} {a.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setActionModal(null)}
                  className="flex-1 py-2.5 text-sm bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
                <button onClick={() => actionMutation.mutate({ id: actionModal.id, action: actionChoice })}
                  disabled={actionMutation.isPending}
                  className="flex-1 py-2.5 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors">
                  Apply Action
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
