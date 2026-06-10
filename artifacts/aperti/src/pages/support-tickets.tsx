import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket, Plus, X, ChevronDown, ChevronUp, Send,
  Clock, CheckCircle, AlertCircle, User, Sparkles,
  Filter, BarChart2,
} from "lucide-react";
import { useAuth } from "@/context/auth";

const token = () => localStorage.getItem("aperti_token") ?? "";
const fetchJSON = (url: string) => fetch(url, { headers: { Authorization: `Bearer ${token()}` } }).then((r) => r.json());
const postJSON = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` }, body: JSON.stringify(body) }).then((r) => r.json());
const putJSON = (url: string, body: unknown) =>
  fetch(url, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` }, body: JSON.stringify(body) }).then((r) => r.json());

type SupportTicket = {
  id: number; user_id: number; user_name: string; subject: string; description: string;
  type: string; status: string; assigned_name: string | null; priority: string;
  ai_suggestions: string[]; response_count: number; created_at: string; updated_at: string;
};
type TicketResponse = {
  id: number; ticket_id: number; responder_id: number; responder_name: string;
  responder_role: string; message: string; created_at: string;
};

const STATUS_STYLES: Record<string, { cls: string; icon: React.ReactNode }> = {
  open: { cls: "bg-blue-100 text-blue-700", icon: <Clock className="w-3 h-3" /> },
  assigned: { cls: "bg-purple-100 text-purple-700", icon: <User className="w-3 h-3" /> },
  in_progress: { cls: "bg-amber-100 text-amber-700", icon: <AlertCircle className="w-3 h-3" /> },
  resolved: { cls: "bg-green-100 text-green-700", icon: <CheckCircle className="w-3 h-3" /> },
  closed: { cls: "bg-gray-100 text-gray-600", icon: <CheckCircle className="w-3 h-3" /> },
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-gray-100 text-gray-500",
  normal: "bg-blue-50 text-blue-600",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export default function SupportTickets() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isStaff = user?.role === "admin" || user?.role === "teacher";
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [replyText, setReplyText] = useState("");
  const [form, setForm] = useState({ subject: "", description: "", type: "technical", priority: "normal" });

  const { data: tickets = [], isLoading } = useQuery<SupportTicket[]>({
    queryKey: ["tickets"],
    queryFn: () => fetchJSON("/api/tickets"),
    refetchInterval: 15000,
  });

  const { data: ticketDetail } = useQuery({
    queryKey: ["ticket", selectedTicket?.id],
    queryFn: () => fetchJSON(`/api/tickets/${selectedTicket!.id}`),
    enabled: !!selectedTicket,
  });

  const responses: TicketResponse[] = ticketDetail?.responses ?? [];

  const createMutation = useMutation({
    mutationFn: () => postJSON("/api/tickets", form),
    onSuccess: (ticket) => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      setShowCreate(false);
      setSelectedTicket(ticket);
      setForm({ subject: "", description: "", type: "technical", priority: "normal" });
    },
  });

  const replyMutation = useMutation({
    mutationFn: () => postJSON(`/api/tickets/${selectedTicket!.id}/respond`, { message: replyText }),
    onSuccess: () => {
      setReplyText("");
      qc.invalidateQueries({ queryKey: ["ticket", selectedTicket?.id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => putJSON(`/api/tickets/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tickets"] }); qc.invalidateQueries({ queryKey: ["ticket", selectedTicket?.id] }); },
  });

  const filtered = tickets.filter((t) => filterStatus === "all" || t.status === filterStatus);

  return (
    <div className="h-[calc(100vh-64px)] flex bg-gray-50 font-[Inter,sans-serif]">
      {/* Ticket List */}
      <div className="w-80 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Ticket className="w-5 h-5 text-teal-600" /> Support
            </h1>
            <button onClick={() => setShowCreate(true)}
              className="p-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-1 flex-wrap">
            {["all", "open", "in_progress", "resolved"].map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors ${filterStatus === s ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No tickets</div>
          ) : (
            filtered.map((ticket) => {
              const ss = STATUS_STYLES[ticket.status] ?? STATUS_STYLES.open;
              return (
                <button key={ticket.id} onClick={() => setSelectedTicket(ticket)}
                  className={`w-full p-3 text-left border-b border-gray-50 hover:bg-gray-50 transition-colors ${selectedTicket?.id === ticket.id ? "bg-teal-50 border-l-2 border-l-teal-500" : ""}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 line-clamp-1">{ticket.subject}</span>
                    <span className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${ss.cls}`}>
                      {ss.icon} {ticket.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className={`px-1.5 py-0.5 rounded-full ${PRIORITY_STYLES[ticket.priority]}`}>{ticket.priority}</span>
                    <span className="capitalize">{ticket.type}</span>
                    {ticket.response_count > 0 && <span>{ticket.response_count} replies</span>}
                  </div>
                  {isStaff && <p className="text-xs text-gray-500 mt-0.5">{ticket.user_name}</p>}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Ticket Detail */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedTicket ? (
          <>
            <div className="bg-white border-b border-gray-100 px-6 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900 mb-1">{selectedTicket.subject}</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${(STATUS_STYLES[selectedTicket.status] ?? STATUS_STYLES.open).cls}`}>
                      {(STATUS_STYLES[selectedTicket.status] ?? STATUS_STYLES.open).icon}
                      {selectedTicket.status.replace("_", " ")}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_STYLES[selectedTicket.priority]}`}>{selectedTicket.priority}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{selectedTicket.type}</span>
                    {selectedTicket.assigned_name && (
                      <span className="text-xs text-gray-500">→ {selectedTicket.assigned_name}</span>
                    )}
                  </div>
                </div>
                {isStaff && selectedTicket.status !== "resolved" && (
                  <button onClick={() => statusMutation.mutate({ id: selectedTicket.id, status: "resolved" })}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                    <CheckCircle className="w-3.5 h-3.5" /> Mark Resolved
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Original description */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-xs font-semibold text-gray-600">{selectedTicket.user_name[0]}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-900">{selectedTicket.user_name}</span>
                    <span className="text-xs text-gray-400 ml-2">{new Date(selectedTicket.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{selectedTicket.description}</p>
              </div>

              {/* AI Suggestions */}
              {selectedTicket.ai_suggestions?.length > 0 && (
                <div className="bg-purple-50 rounded-2xl border border-purple-100 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-semibold text-purple-700">AI Self-Help Suggestions</span>
                  </div>
                  <ul className="space-y-1">
                    {selectedTicket.ai_suggestions.map((s, i) => (
                      <li key={i} className="text-xs text-purple-800 flex items-start gap-1.5">
                        <span className="text-purple-400 mt-0.5">•</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Responses */}
              {responses.map((r) => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className={`bg-white rounded-2xl border p-4 ${r.responder_role === "admin" || r.responder_role === "teacher" ? "border-teal-100" : "border-gray-100"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${r.responder_role === "admin" || r.responder_role === "teacher" ? "bg-teal-100" : "bg-gray-100"}`}>
                      <span className="text-xs font-semibold text-teal-700">{r.responder_name[0]}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-900">{r.responder_name}</span>
                      {(r.responder_role === "admin" || r.responder_role === "teacher") && (
                        <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full capitalize font-medium">{r.responder_role}</span>
                      )}
                      <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{r.message}</p>
                </motion.div>
              ))}
            </div>

            {/* Reply box */}
            {selectedTicket.status !== "closed" && (
              <div className="bg-white border-t border-gray-100 p-4">
                <div className="flex items-end gap-3">
                  <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a reply…"
                    rows={2}
                    className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 resize-none" />
                  <button onClick={() => { if (replyText.trim()) replyMutation.mutate(); }}
                    disabled={!replyText.trim() || replyMutation.isPending}
                    className="p-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Ticket className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a ticket to view details</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-gray-900">New Support Ticket</h3>
                <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Subject *</label>
                  <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="Brief description of the issue"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Description *</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe your issue in detail…"
                    rows={4}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Category</label>
                    <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30">
                      {["technical", "academic", "payment", "account", "exam"].map((t) => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Priority</label>
                    <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30">
                      {["low", "normal", "high", "urgent"].map((p) => (
                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="bg-purple-50 rounded-xl p-3 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-purple-700">AI will suggest self-help resources when you submit your ticket.</p>
                </div>
                <button onClick={() => createMutation.mutate()}
                  disabled={!form.subject || !form.description || createMutation.isPending}
                  className="w-full py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors">
                  Submit Ticket
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
