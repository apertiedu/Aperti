import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone, Plus, X, Calendar, Users, CheckCircle,
  Clock, Trash2, Edit2, Bell, BellOff, Filter,
} from "lucide-react";
import { useAuth } from "@/context/auth";

const token = () => localStorage.getItem("aperti_token") ?? "";
const fetchJSON = (url: string) => fetch(url, { headers: { Authorization: `Bearer ${token()}` } }).then((r) => r.json());
const postJSON = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` }, body: JSON.stringify(body) }).then((r) => r.json());
const putJSON = (url: string, body: unknown) =>
  fetch(url, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` }, body: JSON.stringify(body) }).then((r) => r.json());
const deleteReq = (url: string) =>
  fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${token()}` } }).then((r) => r.json());

type Announcement = {
  id: number; sender_id: number; sender_name: string; audience_type: string;
  audience_ids: number[]; title: string; body: string;
  scheduled_at: string | null; delivered_at: string | null; status: string;
  is_read: boolean; created_at: string;
};

const AUDIENCE_COLORS: Record<string, string> = {
  class: "bg-blue-100 text-blue-700",
  course: "bg-teal-100 text-teal-700",
  parent: "bg-purple-100 text-purple-700",
  all: "bg-amber-100 text-amber-700",
};

export default function Announcements() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isTeacher = user?.role === "teacher" || user?.role === "admin";

  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [form, setForm] = useState({ title: "", body: "", audience_type: "class", scheduled_at: "" });

  const { data: announcements = [], isLoading } = useQuery<Announcement[]>({
    queryKey: ["announcements"],
    queryFn: () => fetchJSON("/api/announcements"),
    refetchInterval: 30000,
  });

  const createMutation = useMutation({
    mutationFn: () => postJSON("/api/announcements", {
      title: form.title, body: form.body,
      audience_type: form.audience_type,
      scheduled_at: form.scheduled_at || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements"] });
      setShowCreate(false);
      setForm({ title: "", body: "", audience_type: "class", scheduled_at: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteReq(`/api/announcements/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });

  const readMutation = useMutation({
    mutationFn: (id: number) => postJSON(`/api/announcements/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });

  const filtered = announcements.filter((a) => filterStatus === "all" || a.status === filterStatus);

  return (
    <div className="max-w-4xl mx-auto p-6 font-[Inter,sans-serif]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Announcements</h1>
            <p className="text-sm text-gray-500">
              {isTeacher ? "Manage your announcements" : "Stay up to date"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {["all", "delivered", "scheduled", "draft"].map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${filterStatus === s ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          {isTeacher && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-sm rounded-xl hover:bg-teal-700 transition-colors">
              <Plus className="w-4 h-4" /> New
            </button>
          )}
        </div>
      </div>

      {/* Unread badge */}
      {!isTeacher && announcements.filter((a) => !a.is_read).length > 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-2">
          <Bell className="w-4 h-4" />
          {announcements.filter((a) => !a.is_read).length} unread announcement(s)
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="text-center text-gray-400 py-12">Loading announcements…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No announcements</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ann) => (
            <motion.div key={ann.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-2xl shadow-sm border p-5 ${!ann.is_read && !isTeacher ? "border-l-4 border-l-teal-500" : "border-gray-100"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AUDIENCE_COLORS[ann.audience_type] ?? AUDIENCE_COLORS.class}`}>
                      {ann.audience_type}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ann.status === "delivered" ? "bg-green-100 text-green-700" : ann.status === "scheduled" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                      {ann.status}
                    </span>
                    {!ann.is_read && !isTeacher && (
                      <span className="text-xs bg-teal-600 text-white px-2 py-0.5 rounded-full">New</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{ann.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{ann.body}</p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {ann.sender_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(ann.created_at).toLocaleDateString()}
                    </span>
                    {ann.scheduled_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Scheduled: {new Date(ann.scheduled_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!isTeacher && !ann.is_read && (
                    <button onClick={() => readMutation.mutate(ann.id)}
                      className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors" title="Mark as read">
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                  {isTeacher && ann.sender_id === user?.id && (
                    <button onClick={() => deleteMutation.mutate(ann.id)}
                      className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-gray-900">Create Announcement</h3>
                <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Title *</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Announcement title"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Message *</label>
                  <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                    placeholder="Write your announcement…"
                    rows={4}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Audience</label>
                    <select value={form.audience_type} onChange={(e) => setForm({ ...form, audience_type: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30">
                      <option value="class">Class</option>
                      <option value="course">Course</option>
                      <option value="parent">Parents</option>
                      <option value="all">Everyone</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Schedule (optional)</label>
                    <input type="datetime-local" value={form.scheduled_at}
                      onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                  </div>
                </div>
                <button onClick={() => createMutation.mutate()}
                  disabled={!form.title || !form.body || createMutation.isPending}
                  className="w-full py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors">
                  {form.scheduled_at ? "Schedule Announcement" : "Publish Now"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
