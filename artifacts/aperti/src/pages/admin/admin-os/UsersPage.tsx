import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Download, Shield, UserX, UserCheck, Eye, Key, LogOut, MoreHorizontal, ChevronLeft, ChevronRight, CheckSquare, Square, X as XIcon, AlertTriangle } from "lucide-react";
import { fetchJSON, postJSON, putJSON } from "@/lib/api";
import { toast } from "sonner";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  teacher: "bg-teal-100 text-teal-700",
  student: "bg-blue-100 text-blue-700",
  parent: "bg-purple-100 text-purple-700",
  assistant: "bg-orange-100 text-orange-700",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  suspended: "bg-red-100 text-red-700",
  pending: "bg-yellow-100 text-yellow-700",
  archived: "bg-gray-100 text-gray-500",
};

function UserDetailPanel({ user, onClose, onAction }: any) {
  if (!user) return null;
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}
      className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl border-l border-gray-200 z-50 overflow-y-auto"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">User Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 text-xl font-bold">
            {user.displayName?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user.displayName || user.username}</p>
            <p className="text-xs text-gray-500">@{user.username}</p>
            <div className="flex gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] || "bg-gray-100 text-gray-600"}`}>{user.role}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[user.status] || "bg-gray-100 text-gray-600"}`}>{user.status}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {[
            ["Email", user.email || "—"],
            ["Phone", user.phone || "—"],
            ["Country", user.country || "—"],
            ["Last Login", user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"],
            ["Created", new Date(user.createdAt).toLocaleDateString()],
            ["ID", `#${user.id}`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span className="text-gray-500">{k}</span>
              <span className="text-gray-900 font-medium">{v}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Actions</p>
          {user.status === "active" ? (
            <button onClick={() => onAction("suspend", user.id)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
              <UserX className="w-4 h-4" /> Suspend Account
            </button>
          ) : (
            <button onClick={() => onAction("restore", user.id)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-600 border border-green-200 rounded-lg hover:bg-green-50 transition-colors">
              <UserCheck className="w-4 h-4" /> Restore Account
            </button>
          )}
          <button onClick={() => onAction("reset-password", user.id)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors">
            <Key className="w-4 h-4" /> Reset Password
          </button>
          <button onClick={() => onAction("force-logout", user.id)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <LogOut className="w-4 h-4" /> Force Logout
          </button>
          <button onClick={() => onAction("impersonate", user.id)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors">
            <Eye className="w-4 h-4" /> Impersonate User
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);
  const [resetPwdTarget, setResetPwdTarget] = useState<number | null>(null);
  const [resetPwdValue, setResetPwdValue] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", displayName: "", email: "", role: "teacher" });
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, role, status, page],
    queryFn: () => fetchJSON(`/api/admin/users?search=${search}&role=${role}&status=${status}&page=${page}&limit=20`),
    placeholderData: (prev: any) => prev,
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-user-stats"],
    queryFn: () => fetchJSON("/api/admin/users/stats/overview"),
  });

  const mutate = useMutation({
    mutationFn: async ({ action, id, body }: any) => {
      if (action === "suspend") return putJSON(`/api/admin/users/${id}/suspend`, {});
      if (action === "restore") return putJSON(`/api/admin/users/${id}/restore`, {});
      if (action === "force-logout") return postJSON(`/api/admin/users/${id}/force-logout`, {});
      if (action === "reset-password") {
        return;
      }
      if (action === "impersonate") {
        const res: any = await postJSON(`/api/admin/users/${id}/impersonate`, {});
        if (res.token) {
          localStorage.setItem("aperti_impersonate_token", res.token);
          localStorage.setItem("aperti_role_override", res.user.role);
          toast.success(`Impersonating ${res.user.displayName} — reload to switch view`);
          setTimeout(() => window.location.reload(), 1000);
        }
        return;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user-stats"] });
      toast.success(`Action "${vars.action}" completed`);
      setSelected(null);
    },
    onError: () => toast.error("Action failed"),
  });

  const createMutation = useMutation({
    mutationFn: () => postJSON("/api/admin/users", newUser),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User created");
      setShowCreate(false);
      setNewUser({ username: "", password: "", displayName: "", email: "", role: "teacher" });
    },
    onError: () => toast.error("Failed to create user"),
  });

  const users: any[] = (data as any)?.users || [];
  const total: number = (data as any)?.total || 0;
  const totalPages = Math.ceil(total / 20);
  const allPageIds = users.map(u => u.id);
  const allChecked = allPageIds.length > 0 && allPageIds.every(id => checkedIds.has(id));
  const someChecked = !allChecked && allPageIds.some(id => checkedIds.has(id));

  const toggleAll = () => {
    if (allChecked) setCheckedIds(prev => { const n = new Set(prev); allPageIds.forEach(id => n.delete(id)); return n; });
    else setCheckedIds(prev => new Set([...prev, ...allPageIds]));
  };
  const toggleOne = (id: number) =>
    setCheckedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const bulkMutate = useMutation({
    mutationFn: async ({ action, ids }: { action: string; ids: number[] }) => {
      if (action === "export") {
        const params = ids.map(id => `ids=${id}`).join("&");
        window.open(`/api/admin/users/export/csv?${params}`, "_blank");
        return;
      }
      await Promise.all(ids.map(id =>
        action === "suspend" ? putJSON(`/api/admin/users/${id}/suspend`, {}) :
        action === "restore" ? putJSON(`/api/admin/users/${id}/restore`, {}) : null
      ));
    },
    onSuccess: (_, { action }) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user-stats"] });
      toast.success(`Bulk ${action} applied to ${checkedIds.size} user(s)`);
      setCheckedIds(new Set());
    },
    onError: () => toast.error("Bulk action failed"),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500">{total.toLocaleString()} total users</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/admin/users/export/csv" className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">
            <Download className="w-4 h-4" /> Export All
          </a>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {checkedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl"
          >
            <CheckSquare className="w-4 h-4 text-teal-600 shrink-0" />
            <span className="text-sm font-semibold text-teal-700">{checkedIds.size} user{checkedIds.size > 1 ? "s" : ""} selected</span>
            <div className="flex gap-2 ml-2 flex-wrap">
              <button onClick={() => bulkMutate.mutate({ action: "suspend", ids: [...checkedIds] })} disabled={bulkMutate.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50">
                <UserX className="w-3.5 h-3.5" /> Suspend
              </button>
              <button onClick={() => bulkMutate.mutate({ action: "restore", ids: [...checkedIds] })} disabled={bulkMutate.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-600 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50">
                <UserCheck className="w-3.5 h-3.5" /> Restore
              </button>
              <button onClick={() => bulkMutate.mutate({ action: "export", ids: [...checkedIds] })} disabled={bulkMutate.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            </div>
            <button onClick={() => setCheckedIds(new Set())} className="ml-auto p-1.5 hover:bg-teal-100 rounded-lg transition-colors text-teal-500">
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: "Total", value: stats.total, color: "text-gray-900" },
            { label: "Active", value: stats.active, color: "text-green-600" },
            { label: "Teachers", value: stats.teachers, color: "text-teal-600" },
            { label: "Students", value: stats.students, color: "text-blue-600" },
            { label: "Admins", value: stats.admins, color: "text-red-600" },
            { label: "Suspended", value: stats.suspended, color: "text-orange-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search users…" className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 bg-white" />
        </div>
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 bg-white text-gray-700">
          <option value="">All Roles</option>
          {["admin", "teacher", "student", "parent", "assistant"].map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 bg-white text-gray-700">
          <option value="">All Status</option>
          {["active", "suspended", "pending", "archived"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 w-8">
                  <button onClick={toggleAll} className="text-gray-400 hover:text-gray-600 transition-colors">
                    {allChecked ? <CheckSquare className="w-4 h-4 text-teal-600" /> : someChecked ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">User</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Last Login</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Joined</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No users found</td></tr>
              ) : users.map((u: any) => (
                <tr key={u.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${checkedIds.has(u.id) ? "bg-teal-50/50" : ""}`}>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleOne(u.id)} className="text-gray-300 hover:text-teal-500 transition-colors">
                      {checkedIds.has(u.id) ? <CheckSquare className="w-4 h-4 text-teal-600" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 text-xs font-bold flex-shrink-0">
                        {(u.displayName || u.username)?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{u.displayName || u.username}</p>
                        <p className="text-xs text-gray-400">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] || "bg-gray-100 text-gray-600"}`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[u.status] || "bg-gray-100 text-gray-600"}`}>{u.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{u.email || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setSelected(u)} className="text-gray-400 hover:text-teal-600 transition-colors p-1 rounded-lg hover:bg-teal-50">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">Page {page} of {totalPages} · {total} total</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User detail panel */}
      {selected && (
        <UserDetailPanel
          user={selected}
          onClose={() => setSelected(null)}
          onAction={(action: string, id: number) => {
            if (action === "reset-password") { setResetPwdTarget(id); setResetPwdValue(""); }
            else mutate.mutate({ action, id });
          }}
        />
      )}

      {/* Reset password dialog */}
      {resetPwdTarget !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Reset Password</h2>
            <p className="text-sm text-gray-500 mb-5">Enter a new password for this account.</p>
            <input
              type="password"
              autoFocus
              value={resetPwdValue}
              onChange={(e) => setResetPwdValue(e.target.value)}
              placeholder="New password…"
              maxLength={128}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 mb-5"
            />
            <div className="flex gap-3">
              <button onClick={() => { setResetPwdTarget(null); setResetPwdValue(""); }} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">Cancel</button>
              <button
                disabled={!resetPwdValue.trim() || resetPwdValue.trim().length < 6}
                onClick={async () => {
                  try {
                    await postJSON(`/api/admin/users/${resetPwdTarget}/reset-password`, { newPassword: resetPwdValue.trim() });
                    toast.success("Password reset successfully");
                  } catch {
                    toast.error("Failed to reset password");
                  } finally {
                    setResetPwdTarget(null);
                    setResetPwdValue("");
                  }
                }}
                className="flex-1 px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-40"
              >
                Reset Password
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Create user modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Create New User</h2>
            <div className="space-y-4">
              {[
                { key: "username", label: "Username", type: "text", required: true },
                { key: "password", label: "Password", type: "password", required: true },
                { key: "displayName", label: "Display Name", type: "text" },
                { key: "email", label: "Email", type: "email" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label} {f.required && <span className="text-red-500">*</span>}</label>
                  <input
                    type={f.type}
                    value={(newUser as any)[f.key]}
                    onChange={(e) => setNewUser(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={newUser.role} onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400">
                  {["admin", "teacher", "student", "parent", "assistant"].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="flex-1 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50">
                {createMutation.isPending ? "Creating…" : "Create User"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
