import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { UserCog, Plus, Check, X, Clock, Trash2, Shield } from "lucide-react";
import { fetchJSON, postJSON, putJSON, deleteJSON } from "@/lib/api";
import { toast } from "sonner";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
};

const ALL_PERMS = [
  "attendance:manage", "students:view", "homework:view", "homework:grade",
  "lessons:view", "resources:view", "gradebook:view",
];

export default function AssistantsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ teacherId: "", assistantId: "", notes: "", permissions: [] as string[] });

  const { data: assistants, isLoading } = useQuery({
    queryKey: ["gov-assistants", statusFilter],
    queryFn: () => fetchJSON(`/api/admin/governance/assistants${statusFilter ? `?status=${statusFilter}` : ""}`),
  });

  const list: any[] = (assistants as any[]) || [];

  const createMut = useMutation({
    mutationFn: (data: any) => postJSON("/api/admin/governance/assistants", { ...data, teacherId: parseInt(data.teacherId), assistantId: data.assistantId ? parseInt(data.assistantId) : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-assistants"] }); toast.success("Invitation created"); setShowCreate(false); setForm({ teacherId: "", assistantId: "", notes: "", permissions: [] }); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status, notes }: any) => putJSON(`/api/admin/governance/assistants/${id}`, { status, notes }),
    onSuccess: (_, v) => { qc.invalidateQueries({ queryKey: ["gov-assistants"] }); toast.success(`Invitation ${v.status}`); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteJSON(`/api/admin/governance/assistants/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-assistants"] }); toast.success("Deleted"); },
  });

  const pending = list.filter(a => a.status === "pending").length;
  const approved = list.filter(a => a.status === "approved").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assistant Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage assistant assignments, permissions, and approval workflows</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:opacity-90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />New Invitation
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total", value: list.length, icon: UserCog, color: "text-primary bg-primary/8" },
          { label: "Pending", value: pending, icon: Clock, color: "text-yellow-600 bg-yellow-50" },
          { label: "Approved", value: approved, icon: Check, color: "text-green-600 bg-green-50" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color.split(" ")[1]}`}>
              <Icon className={`w-5 h-5 ${color.split(" ")[0]}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="font-semibold text-gray-900 text-sm">Create Assistant Invitation</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600">Teacher ID *</label>
                <input type="number" value={form.teacherId} onChange={e => setForm({ ...form, teacherId: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Assistant User ID</label>
                <input type="number" value={form.assistantId} onChange={e => setForm({ ...form, assistantId: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-gray-600">Notes</label>
                <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-gray-600 block mb-2">Permissions to grant</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_PERMS.map(p => (
                    <button key={p} onClick={() => {
                      const has = form.permissions.includes(p);
                      setForm({ ...form, permissions: has ? form.permissions.filter(x => x !== p) : [...form.permissions, p] });
                    }} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${form.permissions.includes(p) ? "bg-primary text-primary-foreground border-primary" : "bg-white text-gray-600 border-gray-200 hover:border-primary/40"}`}>
                      {form.permissions.includes(p) && <Check className="w-3 h-3" />}{p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => createMut.mutate(form)} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90">Create</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex gap-2">
        {["", "pending", "approved", "rejected"].map(s => (
          <button key={s || "all"} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse py-2">{[1,2,3].map(i=><div key={i} className="h-16 bg-gray-100 rounded-xl" />)}</div>
      ) : list.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <UserCog className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No assistant invitations yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((a: any) => (
            <motion.div key={a.id} layout className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[a.status] || "bg-gray-100 text-gray-600"}`}>{a.status}</span>
                    <p className="text-sm font-semibold text-gray-900">
                      {a.assistant_name || a.assistant_username || "Pending acceptance"}
                    </p>
                    <span className="text-xs text-gray-400">→</span>
                    <p className="text-sm text-gray-600">Teacher: {a.teacher_name || a.teacher_username}</p>
                  </div>
                  {a.notes && <p className="text-xs text-gray-500 mt-1.5">{a.notes}</p>}
                  {a.permissions?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {a.permissions.map((p: string) => (
                        <span key={p} className="flex items-center gap-1 px-2 py-0.5 bg-primary/8 text-primary rounded text-[11px] font-medium">
                          <Shield className="w-2.5 h-2.5" />{p}
                        </span>
                      ))}
                    </div>
                  )}
                  {a.reviewer_username && (
                    <p className="text-xs text-gray-400 mt-1.5">Reviewed by {a.reviewer_username} · {a.reviewed_at ? new Date(a.reviewed_at).toLocaleDateString() : ""}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {a.status === "pending" && (
                    <>
                      <button onClick={() => updateMut.mutate({ id: a.id, status: "approved" })} className="p-1.5 hover:bg-green-50 rounded-lg text-gray-400 hover:text-green-600 transition-colors" title="Approve"><Check className="w-4 h-4" /></button>
                      <button onClick={() => updateMut.mutate({ id: a.id, status: "rejected" })} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors" title="Reject"><X className="w-4 h-4" /></button>
                    </>
                  )}
                  <button onClick={() => { if (window.confirm("Delete this invitation?")) deleteMut.mutate(a.id); }} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
