import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Search, Filter, Check, X, Trash2, Plus, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchJSON, postJSON, putJSON, deleteJSON } from "@/lib/api";
import { toast } from "sonner";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  rejected: "bg-red-100 text-red-600",
  removed: "bg-gray-100 text-gray-500",
  approved: "bg-primary/15 text-primary",
};

function EnrollmentRow({ enrollment: e, onApprove, onReject, onRemove }: any) {
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-900">{e.student_name || e.student_username}</p>
          <p className="text-xs text-gray-400">{e.student_email}</p>
        </div>
      </td>
      <td className="px-4 py-3">
        <div>
          <p className="text-sm text-gray-700">{e.course_name || `Course #${e.course_id}`}</p>
          {e.teacher_name && <p className="text-xs text-gray-400">by {e.teacher_name}</p>}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[e.status] || "bg-gray-100 text-gray-600"}`}>{e.status}</span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">
        {e.approved_at ? new Date(e.approved_at).toLocaleDateString() : new Date(e.created_at).toLocaleDateString()}
        {e.approver_name && <p>by {e.approver_name}</p>}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {e.status === "pending" && (
            <>
              <button onClick={() => onApprove(e.id)} className="p-1.5 hover:bg-green-50 rounded-lg text-gray-400 hover:text-green-600 transition-colors" title="Approve"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => onReject(e.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors" title="Reject"><X className="w-3.5 h-3.5" /></button>
            </>
          )}
          <button onClick={() => { if (window.confirm("Remove this enrollment?")) onRemove(e.id); }} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </td>
    </tr>
  );
}

export default function EnrollmentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [conflicts, setConflicts] = useState<any[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [createForm, setCreateForm] = useState({ studentId: "", courseId: "", courseName: "", teacherId: "", notes: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["gov-enrollments", statusFilter, page],
    queryFn: () => fetchJSON(`/api/admin/governance/enrollments?${statusFilter ? `status=${statusFilter}&` : ""}page=${page}&limit=30`),
  });

  const enrollments: any[] = (data as any)?.enrollments || [];
  const total: number = (data as any)?.total || 0;
  const totalPages = Math.ceil(total / 30);

  const approveMut = useMutation({
    mutationFn: (id: number) => putJSON(`/api/admin/governance/enrollments/${id}`, { status: "approved" }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["gov-enrollments"] });
      const enr = enrollments.find((e: any) => e.id === id);
      toast.success(enr ? `✓ ${enr.student_name || "Student"} enrolled in ${enr.course_name || "course"}` : "Enrollment approved");
    },
  });

  const rejectMut = useMutation({
    mutationFn: (id: number) => putJSON(`/api/admin/governance/enrollments/${id}`, { status: "rejected" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-enrollments"] }); toast.success("Enrollment rejected"); },
  });

  const removeMut = useMutation({
    mutationFn: (id: number) => deleteJSON(`/api/admin/governance/enrollments/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-enrollments"] }); toast.success("Enrollment removed"); },
  });

  const createMut = useMutation({
    mutationFn: (data: any) => postJSON("/api/admin/governance/enrollments", { ...data, studentId: parseInt(data.studentId), courseId: parseInt(data.courseId), teacherId: data.teacherId ? parseInt(data.teacherId) : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-enrollments"] }); toast.success("Enrollment created"); setShowCreate(false); setCreateForm({ studentId: "", courseId: "", courseName: "", teacherId: "", notes: "" }); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  async function runScan() {
    setScanning(true);
    try {
      const result = await postJSON("/api/admin/governance/enrollments/conflict-scan", {});
      setConflicts((result as any).conflicts || []);
      toast.success(`Scan complete — ${(result as any).total} issue(s) found`);
    } catch {
      toast.error("Scan failed");
    } finally {
      setScanning(false);
    }
  }

  const filtered = search ? enrollments.filter(e =>
    (e.student_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (e.student_username || "").toLowerCase().includes(search.toLowerCase()) ||
    (e.course_name || "").toLowerCase().includes(search.toLowerCase())
  ) : enrollments;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enrollment Governance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage and audit all platform enrollments</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runScan} disabled={scanning} className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50 text-gray-600 transition-colors">
            <RefreshCw className={`w-4 h-4 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Scanning..." : "Conflict Scan"}
          </button>
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors shadow-sm">
            <Plus className="w-4 h-4" />Enroll Student
          </button>
        </div>
      </div>

      {/* Conflict Results */}
      <AnimatePresence>
        {conflicts !== null && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-white rounded-xl border border-yellow-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-yellow-50 border-b border-yellow-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <p className="font-semibold text-yellow-800 text-sm">{conflicts.length} conflict(s) detected</p>
              </div>
              <button onClick={() => setConflicts(null)} className="text-yellow-500 hover:text-yellow-700"><X className="w-4 h-4" /></button>
            </div>
            {conflicts.length === 0 ? (
              <div className="px-5 py-4 text-sm text-green-600 flex items-center gap-2"><Check className="w-4 h-4" />All enrollments are clean</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {conflicts.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3">
                    <span className={`mt-0.5 px-2 py-0.5 rounded text-xs font-medium ${c.severity === "high" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{c.severity}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{c.type.replace(/_/g, " ")}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="font-semibold text-gray-900 text-sm">Create Enrollment</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600">Student ID *</label>
                <input type="number" value={createForm.studentId} onChange={e => setCreateForm({ ...createForm, studentId: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Course ID *</label>
                <input type="number" value={createForm.courseId} onChange={e => setCreateForm({ ...createForm, courseId: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Course Name</label>
                <input value={createForm.courseName} onChange={e => setCreateForm({ ...createForm, courseName: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Teacher ID</label>
                <input type="number" value={createForm.teacherId} onChange={e => setCreateForm({ ...createForm, teacherId: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-gray-600">Notes</label>
                <input value={createForm.notes} onChange={e => setCreateForm({ ...createForm, notes: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => createMut.mutate(createForm)} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/80">Create</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student or course..." className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {["", "active", "pending", "rejected", "removed"].map(s => (
            <button key={s || "all"} onClick={() => { setStatusFilter(s); setPage(1); }} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === s ? "bg-primary text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">{total} enrollments</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Student", "Course", "Status", "Date", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array(5).fill(0).map((_,i)=><tr key={i}>{Array(5).fill(0).map((_,j)=><td key={j} className="px-4 py-3"><div className="h-3 bg-gray-100 rounded animate-pulse" /></td>)}</tr>)
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-sm text-gray-400">No enrollments found</td></tr>
              ) : (
                filtered.map((e: any) => (
                  <EnrollmentRow key={e.id} enrollment={e}
                    onApprove={(id: number) => approveMut.mutate(id)}
                    onReject={(id: number) => rejectMut.mutate(id)}
                    onRemove={(id: number) => removeMut.mutate(id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
