import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Plus, Check, ChevronUp, ChevronDown, X, Edit2, Trash2,
  Users, Lock, GripVertical, Eye, Settings2, Save,
} from "lucide-react";
import { fetchJSON, postJSON, putJSON, deleteJSON } from "@/lib/api";
import { toast } from "sonner";

const VISIBILITY_STATES = ["released", "beta", "coming_soon", "internal", "disabled"];
const STATE_STYLES: Record<string, string> = {
  released: "bg-green-100 text-green-700",
  beta: "bg-blue-100 text-blue-700",
  coming_soon: "bg-yellow-100 text-yellow-700",
  internal: "bg-purple-100 text-purple-700",
  disabled: "bg-gray-100 text-gray-500",
};

const ROLE_COLORS = ["hsl(var(--primary))", "#2563EB", "#7C3AED", "#DC2626", "#D97706", "#059669", "#DB2777"];

function RoleCard({ role, onEdit, onDelete, onViewPerms }: any) {
  return (
    <motion.div layout className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderLeft: `4px solid ${role.color}` }}>
        <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 text-sm truncate">{role.name}</p>
            {role.is_system && <span className="px-1.5 py-0.5 bg-primary/8 text-primary rounded text-[10px] font-medium">System</span>}
            <span className="ml-auto text-xs text-gray-400">L{role.hierarchy_level}</span>
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">{role.description || "No description"}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Lock className="w-3 h-3" />{role.permission_count} perms</span>
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{role.user_count} users</span>
            {role.parent_name && <span className="text-primary">↑ {role.parent_name}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <button onClick={() => onViewPerms(role)} className="p-1.5 hover:bg-primary/8 rounded-lg text-gray-400 hover:text-primary transition-colors" title="View permissions"><Eye className="w-3.5 h-3.5" /></button>
          <button onClick={() => onEdit(role)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
          {!role.is_system && <button onClick={() => onDelete(role.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>}
        </div>
      </div>
    </motion.div>
  );
}

function RoleForm({ initial, onSubmit, onCancel }: any) {
  const { data: allRoles } = useQuery({ queryKey: ["gov-roles"], queryFn: () => fetchJSON("/api/admin/governance/roles") });
  const [form, setForm] = useState(initial || { name: "", description: "", hierarchyLevel: 10, parentRoleId: "", color: "hsl(var(--primary))", isSystem: false });
  const roles: any[] = (allRoles as any[]) || [];

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="font-semibold text-gray-900 text-sm">{initial ? "Edit Role" : "New Role"}</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600">Role Name *</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="e.g. Content Moderator" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Hierarchy Level</label>
          <input type="number" value={form.hierarchyLevel} onChange={e => setForm({ ...form, hierarchyLevel: parseInt(e.target.value) })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-gray-600">Description</label>
          <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="What this role can do" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Parent Role</label>
          <select value={form.parentRoleId} onChange={e => setForm({ ...form, parentRoleId: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="">None</option>
            {roles.filter((r: any) => r.id !== initial?.id).map((r: any) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Color</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-10 h-9 rounded-lg border border-gray-200 cursor-pointer" />
            <div className="flex gap-1.5">{ROLE_COLORS.map(c => <button key={c} onClick={() => setForm({ ...form, color: c })} className={`w-6 h-6 rounded-full border-2 ${form.color === c ? "border-gray-600" : "border-transparent"}`} style={{ background: c }} />)}</div>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
        <button onClick={() => onSubmit(form)} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors flex items-center gap-2"><Save className="w-3.5 h-3.5" />Save Role</button>
      </div>
    </div>
  );
}

function PermissionsPanel({ role, onClose }: any) {
  const qc = useQueryClient();
  const { data: rolePerms, isLoading } = useQuery({
    queryKey: ["role-perms", role.id],
    queryFn: () => fetchJSON(`/api/admin/governance/roles/${role.id}/permissions`),
  });
  const { data: allPerms } = useQuery({ queryKey: ["gov-all-perms"], queryFn: () => fetchJSON("/api/admin/governance/permissions") });
  const { data: effective } = useQuery({ queryKey: ["role-effective", role.id], queryFn: () => fetchJSON(`/api/admin/governance/roles/${role.id}/effective`) });
  const [addingPerm, setAddingPerm] = useState(false);
  const [selectedPerm, setSelectedPerm] = useState("");

  const assignMut = useMutation({
    mutationFn: (permId: number) => postJSON(`/api/admin/governance/roles/${role.id}/permissions`, { permissionId: permId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["role-perms", role.id] }); qc.invalidateQueries({ queryKey: ["role-effective", role.id] }); toast.success("Permission assigned"); setAddingPerm(false); },
    onError: () => toast.error("Failed to assign"),
  });

  const removeMut = useMutation({
    mutationFn: (permId: number) => deleteJSON(`/api/admin/governance/roles/${role.id}/permissions/${permId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["role-perms", role.id] }); qc.invalidateQueries({ queryKey: ["role-effective", role.id] }); toast.success("Permission removed"); },
  });

  const perms: any[] = (rolePerms as any[]) || [];
  const all: any[] = (allPerms as any[]) || [];
  const eff: any[] = (effective as any[]) || [];
  const assignedIds = new Set(perms.map((p: any) => p.id));
  const available = all.filter((p: any) => !assignedIds.has(p.id));

  const byResource = perms.reduce((acc: any, p: any) => {
    if (!acc[p.resource]) acc[p.resource] = [];
    acc[p.resource].push(p);
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: role.color + "20" }}>
            <Shield className="w-4 h-4" style={{ color: role.color }} />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{role.name}</p>
            <p className="text-xs text-gray-500">{perms.length} direct · {eff.length} effective permissions</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X className="w-4 h-4" /></button>
      </div>

      <div className="p-5 space-y-4">
        {/* Direct permissions */}
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg" />)}
          </div>
        ) : (
          Object.keys(byResource).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No permissions assigned yet</p>
          ) : (
            Object.entries(byResource).map(([resource, rperms]: any) => (
              <div key={resource}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{resource}</p>
                <div className="flex flex-wrap gap-2">
                  {rperms.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-1.5 bg-primary/8 border border-primary/15 rounded-lg px-2.5 py-1 text-xs text-primary font-medium">
                      <span>{p.action}</span>
                      {p.scope_override && <span className="text-primary">({p.scope_override})</span>}
                      <button onClick={() => removeMut.mutate(p.id)} className="ml-1 text-primary hover:text-red-500"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )
        )}

        {/* Inherited effective permissions */}
        {eff.length > perms.length && (
          <div>
            <p className="text-xs font-medium text-gray-400 mb-2">Inherited from parent roles ({eff.length - perms.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {eff.filter((e: any) => !assignedIds.has(e.id)).map((e: any, i: number) => (
                <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[11px]">{e.resource}:{e.action}</span>
              ))}
            </div>
          </div>
        )}

        {/* Add permission */}
        {addingPerm ? (
          <div className="flex gap-2">
            <select value={selectedPerm} onChange={e => setSelectedPerm(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Select permission...</option>
              {available.map((p: any) => (
                <option key={p.id} value={p.id}>{p.resource}:{p.action}</option>
              ))}
            </select>
            <button onClick={() => selectedPerm && assignMut.mutate(parseInt(selectedPerm))} className="px-3 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/80 transition-colors">Assign</button>
            <button onClick={() => setAddingPerm(false)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setAddingPerm(true)} className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-primary/50 hover:text-primary transition-colors">
            <Plus className="w-4 h-4" />Assign Permission
          </button>
        )}
      </div>
    </div>
  );
}

function PermMatrixTab() {
  const { data: roles } = useQuery({ queryKey: ["gov-roles"], queryFn: () => fetchJSON("/api/admin/governance/roles") });
  const { data: perms } = useQuery({ queryKey: ["gov-all-perms"], queryFn: () => fetchJSON("/api/admin/governance/permissions") });
  const qc = useQueryClient();

  const roleList: any[] = (roles as any[]) || [];
  const permList: any[] = (perms as any[]) || [];

  const { data: allAssignments } = useQuery({
    queryKey: ["gov-all-assignments"],
    queryFn: async () => {
      const results = await Promise.all(roleList.map(r => fetchJSON(`/api/admin/governance/roles/${r.id}/permissions`)));
      const map: Record<string, Set<number>> = {};
      roleList.forEach((r, i) => { map[r.id] = new Set((results[i] as any[]).map((p: any) => p.id)); });
      return map;
    },
    enabled: roleList.length > 0,
  });

  const assignments = allAssignments || {};

  const toggleMut = useMutation({
    mutationFn: async ({ roleId, permId, has }: any) => {
      if (has) return deleteJSON(`/api/admin/governance/roles/${roleId}/permissions/${permId}`);
      return postJSON(`/api/admin/governance/roles/${roleId}/permissions`, { permissionId: permId });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-all-assignments"] }); toast.success("Updated"); },
  });

  const byResource = permList.reduce((acc: any, p: any) => {
    if (!acc[p.resource]) acc[p.resource] = [];
    acc[p.resource].push(p);
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900">Permission Matrix</p>
          <p className="text-xs text-gray-500 mt-0.5">Click checkboxes to assign or remove permissions per role</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-semibold text-gray-600 min-w-48">Permission</th>
              {roleList.map((r: any) => (
                <th key={r.id} className="text-center px-3 py-3 font-semibold min-w-28">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-3 h-3 rounded-full" style={{ background: r.color }} />
                    <span className="text-xs text-gray-600">{r.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(byResource).map(([resource, rperms]: any) => (
              <>
                <tr key={resource} className="bg-gray-50/50">
                  <td colSpan={roleList.length + 1} className="px-4 py-1.5">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{resource}</span>
                  </td>
                </tr>
                {rperms.map((perm: any) => (
                  <tr key={perm.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 pl-8">
                      <span className="text-xs text-gray-600 font-mono">{perm.action}</span>
                      {perm.scope !== "self" && <span className="ml-1.5 text-[10px] text-gray-400">({perm.scope})</span>}
                    </td>
                    {roleList.map((role: any) => {
                      const has = assignments[role.id]?.has(perm.id);
                      return (
                        <td key={role.id} className="text-center px-3 py-2">
                          <button
                            onClick={() => toggleMut.mutate({ roleId: role.id, permId: perm.id, has })}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-all ${has ? "bg-primary border-primary" : "border-gray-200 hover:border-primary/50"}`}
                          >
                            {has && <Check className="w-3 h-3 text-white" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
        {permList.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-400">No permissions yet — create some to populate the matrix</div>
        )}
      </div>
    </div>
  );
}

function PermissionsTab() {
  const qc = useQueryClient();
  const { data: perms } = useQuery({ queryKey: ["gov-all-perms"], queryFn: () => fetchJSON("/api/admin/governance/permissions") });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ resource: "", action: "", scope: "self", description: "" });

  const createMut = useMutation({
    mutationFn: (data: any) => postJSON("/api/admin/governance/permissions", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-all-perms"] }); toast.success("Permission created"); setShowCreate(false); setForm({ resource: "", action: "", scope: "self", description: "" }); },
    onError: () => toast.error("Failed to create"),
  });

  const permList: any[] = (perms as any[]) || [];
  const byResource = permList.reduce((acc: any, p: any) => {
    if (!acc[p.resource]) acc[p.resource] = [];
    acc[p.resource].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{permList.length} permissions defined</p>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-3 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/80 transition-colors">
          <Plus className="w-4 h-4" />New Permission
        </button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Resource</label>
                <input value={form.resource} onChange={e => setForm({ ...form, resource: e.target.value })} placeholder="e.g. courses" className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Action</label>
                <input value={form.action} onChange={e => setForm({ ...form, action: e.target.value })} placeholder="e.g. view" className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Scope</label>
                <select value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {["self", "organization", "global", "owned"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => createMut.mutate(form)} className="px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/80">Create</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {Object.entries(byResource).map(([resource, rperms]: any) => (
        <div key={resource} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{resource}</p>
          </div>
          <div className="divide-y divide-gray-50">
            {rperms.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <code className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">{p.resource}:{p.action}</code>
                <span className="text-xs text-primary bg-primary/8 px-1.5 py-0.5 rounded">{p.scope}</span>
                {p.description && <span className="text-xs text-gray-400 flex-1">{p.description}</span>}
                <span className="text-xs text-gray-400 ml-auto">{p.role_count} roles</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const TABS = ["Roles", "Permissions", "Matrix"];

export default function RolesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("Roles");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [viewingPerms, setViewingPerms] = useState<any>(null);

  const { data: roles, isLoading } = useQuery({
    queryKey: ["gov-roles"],
    queryFn: () => fetchJSON("/api/admin/governance/roles"),
  });
  const { data: stats } = useQuery({ queryKey: ["gov-stats"], queryFn: () => fetchJSON("/api/admin/governance/stats") });

  const roleList: any[] = (roles as any[]) || [];
  const s: any = stats || {};

  const createMut = useMutation({
    mutationFn: (data: any) => postJSON("/api/admin/governance/roles", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-roles"] }); qc.invalidateQueries({ queryKey: ["gov-stats"] }); toast.success("Role created"); setShowCreate(false); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => putJSON(`/api/admin/governance/roles/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-roles"] }); toast.success("Role updated"); setEditing(null); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteJSON(`/api/admin/governance/roles/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-roles"] }); toast.success("Role deleted"); },
    onError: (e: any) => toast.error(e.message || "Cannot delete"),
  });

  const sortedRoles = [...roleList].sort((a, b) => a.hierarchy_level - b.hierarchy_level);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Role & Permission Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage role hierarchy, permissions, and access governance</p>
        </div>
        <button onClick={() => { setShowCreate(true); setEditing(null); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/80 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />New Role
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Roles", value: s.roles || roleList.length, icon: Shield, color: "primary" },
          { label: "Permissions", value: s.permissions || 0, icon: Lock, color: "blue" },
          { label: "Role Assignments", value: (s.enrollments || []).length, icon: Users, color: "purple" },
          { label: "Open Conflicts", value: (s.conflicts || []).filter((c: any) => c.status === "open").reduce((a: number, c: any) => a + c.count, 0), icon: Settings2, color: "red" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-${color}-50 flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-5 h-5 text-${color}-600`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>{t}</button>
        ))}
      </div>

      {/* Create/Edit Form */}
      <AnimatePresence>
        {(showCreate || editing) && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <RoleForm
              initial={editing}
              onSubmit={(data: any) => editing ? updateMut.mutate({ id: editing.id, data }) : createMut.mutate(data)}
              onCancel={() => { setShowCreate(false); setEditing(null); }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Permissions Panel */}
      <AnimatePresence>
        {viewingPerms && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <PermissionsPanel role={viewingPerms} onClose={() => setViewingPerms(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Content */}
      {tab === "Roles" && (
        <div>
          {isLoading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading roles...</div>
          ) : sortedRoles.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No roles yet — click New Role to create one</div>
          ) : (
            <div className="space-y-2">
              {sortedRoles.map((role: any) => (
                <RoleCard key={role.id} role={role}
                  onEdit={(r: any) => { setEditing(r); setShowCreate(false); setViewingPerms(null); }}
                  onDelete={(id: number) => { if (window.confirm("Delete this role?")) deleteMut.mutate(id); }}
                  onViewPerms={(r: any) => setViewingPerms(r)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "Permissions" && <PermissionsTab />}
      {tab === "Matrix" && <PermMatrixTab />}
    </div>
  );
}
