import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Search, Shield, Plus, X, Lock, ChevronRight, Eye } from "lucide-react";
import { fetchJSON, postJSON, deleteJSON } from "@/lib/api";
import { toast } from "sonner";

function UserAccessPanel({ userId, onClose }: { userId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["user-access", userId],
    queryFn: () => fetchJSON(`/api/admin/governance/users/${userId}/access`),
  });
  const { data: govRoles } = useQuery({ queryKey: ["gov-roles"], queryFn: () => fetchJSON("/api/admin/governance/roles") });
  const [addingRole, setAddingRole] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");

  const user = (data as any)?.user;
  const userRoles: any[] = (data as any)?.roles || [];
  const allRoles: any[] = (govRoles as any[]) || [];

  const addRoleMut = useMutation({
    mutationFn: (roleId: number) => postJSON(`/api/admin/governance/users/${userId}/roles`, { roleId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["user-access", userId] }); toast.success("Role assigned"); setAddingRole(false); },
    onError: () => toast.error("Failed to assign role"),
  });

  const removeRoleMut = useMutation({
    mutationFn: (assignId: number) => deleteJSON(`/api/admin/governance/users/${userId}/roles/${assignId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["user-access", userId] }); toast.success("Role removed"); },
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div>
            {isLoading ? (
              <div className="space-y-1 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-36" />
                <div className="h-3 bg-gray-100 rounded w-48" />
              </div>
            ) : (
              <>
                <p className="font-semibold text-gray-900">{user?.display_name || user?.username}</p>
                <p className="text-xs text-gray-500">{user?.email} · {user?.role}</p>
              </>
            )}
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X className="w-4 h-4" /></button>
      </div>

      <div className="p-5 space-y-5">
        {/* System role */}
        {user && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">System Role</p>
            <span className="px-3 py-1.5 bg-primary/8 text-primary rounded-lg text-sm font-medium border border-primary/15">{user.role}</span>
          </div>
        )}

        {/* Governance roles */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Governance Roles</p>
            <button onClick={() => setAddingRole(!addingRole)} className="text-xs text-primary hover:text-primary flex items-center gap-1">
              <Plus className="w-3 h-3" />Add
            </button>
          </div>

          {addingRole && (
            <div className="flex gap-2 mb-3">
              <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Select role...</option>
                {allRoles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button onClick={() => selectedRole && addRoleMut.mutate(parseInt(selectedRole))} className="px-3 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/80">Assign</button>
              <button onClick={() => setAddingRole(false)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">Cancel</button>
            </div>
          )}

          {userRoles.length === 0 ? (
            <p className="text-xs text-gray-400">No governance roles assigned</p>
          ) : (
            <div className="space-y-2">
              {userRoles.map((r: any) => (
                <div key={r.id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: r.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{r.role_name}</p>
                    {r.org_name && <p className="text-xs text-gray-400">{r.org_name}</p>}
                    {r.course_id && <p className="text-xs text-gray-400">Course #{r.course_id}</p>}
                  </div>
                  <button onClick={() => removeRoleMut.mutate(r.id)} className="p-1 hover:bg-red-50 rounded text-gray-300 hover:text-red-400 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UserAccessPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["gov-user-access-list", search, page],
    queryFn: () => fetchJSON(`/api/admin/governance/users/access?${search ? `search=${encodeURIComponent(search)}&` : ""}page=${page}&limit=40`),
  });

  const users: any[] = (data as any)?.users || [];
  const total: number = (data as any)?.total || 0;

  const ROLE_COLORS: Record<string, string> = {
    admin: "bg-red-100 text-red-700",
    teacher: "bg-primary/15 text-primary",
    student: "bg-blue-100 text-blue-700",
    parent: "bg-purple-100 text-purple-700",
    assistant: "bg-orange-100 text-orange-700",
    super_admin: "bg-pink-100 text-pink-700",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Access Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">View and manage per-user roles, effective permissions, and scope</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* User list */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search users..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-medium text-gray-500">{total} users</p>
            </div>
            {isLoading ? (
              <div className="space-y-3 animate-pulse py-2">{[1,2,3].map(i=><div key={i} className="h-12 bg-gray-100 rounded-xl" />)}</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-400">No users found</div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-[calc(100vh-320px)] overflow-y-auto">
                {users.map((u: any) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUser(selectedUser === u.id ? null : u.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left ${selectedUser === u.id ? "bg-primary/8" : ""}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-gray-500">{(u.display_name || u.username || "?")[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{u.display_name || u.username}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ROLE_COLORS[u.role] || "bg-gray-100 text-gray-600"}`}>{u.role}</span>
                        {u.gov_role_count > 0 && <span className="text-[10px] text-primary">+{u.gov_role_count} gov</span>}
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-gray-300 flex-shrink-0 transition-transform ${selectedUser === u.id ? "rotate-90 text-primary" : ""}`} />
                  </button>
                ))}
              </div>
            )}

            {total > 40 && (
              <div className="px-4 py-2 border-t border-gray-100 flex justify-between items-center bg-gray-50">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="text-xs text-gray-500 disabled:opacity-40 hover:text-gray-700">← Prev</button>
                <span className="text-xs text-gray-400">Page {page}</span>
                <button disabled={users.length < 40} onClick={() => setPage(p => p + 1)} className="text-xs text-gray-500 disabled:opacity-40 hover:text-gray-700">Next →</button>
              </div>
            )}
          </div>
        </div>

        {/* Access panel */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {selectedUser ? (
              <motion.div key={selectedUser} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
                <UserAccessPanel userId={selectedUser} onClose={() => setSelectedUser(null)} />
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 bg-white rounded-xl border border-gray-100">
                <Shield className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="font-medium text-gray-500">Select a user to manage their access</p>
                <p className="text-sm text-gray-400 mt-1">View roles, effective permissions, and scope</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
