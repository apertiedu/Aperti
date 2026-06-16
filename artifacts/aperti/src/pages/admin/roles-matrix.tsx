import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, RotateCcw, CheckCircle2, XCircle, AlertTriangle, Lock, Unlock, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";


interface MatrixData {
  roles: { id: string; name: string; description: string; color: string }[];
  modules: Record<string, string[]>;
  matrix: Record<string, Record<string, boolean>>;
  overrideCount: number;
}

function PermissionCell({ role, permission, granted, isOverridden, onToggle, isAdmin }: {
  role: string; permission: string; granted: boolean; isOverridden: boolean;
  onToggle: (role: string, permission: string, granted: boolean) => void;
  isAdmin: boolean;
}) {
  const isLocked = role === "admin" && permission !== "ai:disable";

  return (
    <motion.button
      whileTap={{ scale: isLocked ? 1 : 0.85 }}
      onClick={() => !isLocked && onToggle(role, permission, !granted)}
      className={`
        relative w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150
        ${isLocked ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:scale-110"}
        ${granted
          ? isOverridden ? "bg-blue-100 border-2 border-blue-400" : "bg-primary/15 border border-primary/30"
          : isOverridden ? "bg-red-100 border-2 border-red-400" : "bg-gray-100 border border-gray-200"
        }
      `}
      title={`${role} — ${permission}: ${granted ? "granted" : "denied"}${isOverridden ? " (custom)" : " (default)"}${isLocked ? " (locked)" : ""}`}
    >
      {isLocked ? (
        <Lock className="w-3 h-3 text-gray-400" />
      ) : granted ? (
        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: isOverridden ? "#2563EB" : "hsl(var(--primary))" }} />
      ) : (
        <XCircle className="w-3.5 h-3.5" style={{ color: isOverridden ? "#DC2626" : "#D1D5DB" }} />
      )}
    </motion.button>
  );
}

export default function RolesMatrixPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [hoveredRole, setHoveredRole] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<MatrixData>({
    queryKey: ["roles-matrix"],
    queryFn: () => fetch("/api/admin/roles/matrix", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ role, permission, granted }: { role: string; permission: string; granted: boolean }) => {
      const res = await fetch("/api/admin/roles/matrix", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, permission, granted }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["roles-matrix"] });
      toast({ title: `Permission updated`, description: `${vars.role} — ${vars.permission}: ${vars.granted ? "granted" : "revoked"}` });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: async (role: string) => {
      const res = await fetch("/api/admin/roles/matrix/reset", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error("Failed to reset");
      return res.json();
    },
    onSuccess: (_, role) => {
      qc.invalidateQueries({ queryKey: ["roles-matrix"] });
      setConfirmReset(null);
      toast({ title: `Permissions reset`, description: `${role} reverted to defaults` });
    },
    onError: () => toast({ title: "Failed to reset", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-slate-500">Loading permission matrix…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <p className="text-slate-600">Failed to load permission matrix</p>
      </div>
    );
  }

  const allPerms = Object.values(data.modules).flat();
  const defaultMatrix: Record<string, Record<string, boolean>> = {};
  for (const role of data.roles) {
    defaultMatrix[role.id] = {};
    for (const perm of allPerms) {
      defaultMatrix[role.id][perm] = data.matrix[role.id]?.[perm] ?? false;
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#E6F4F1" }}>
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Role & Permission Matrix</h1>
          </div>
          <p className="text-sm text-slate-500 ml-10">
            Toggle permissions per role. Changes take effect immediately.
            Blue border = custom override, teal = default.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-primary/15 border border-primary/30 inline-block" /> Default granted
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-blue-100 border-2 border-blue-400 inline-block" /> Custom override
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-red-100 border-2 border-red-400 inline-block" /> Custom revoked
          </span>
        </div>
      </div>

      {data.overrideCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
          <Info className="w-4 h-4 shrink-0" />
          {data.overrideCount} custom permission override{data.overrideCount !== 1 ? "s" : ""} active
        </div>
      )}

      {/* Matrix table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left p-3 font-semibold text-slate-600 bg-gray-50/50 sticky left-0 z-10 min-w-48 rounded-tl-xl">
                Module / Permission
              </th>
              {data.roles.map(role => (
                <th
                  key={role.id}
                  className="p-3 text-center min-w-28"
                  onMouseEnter={() => setHoveredRole(role.id)}
                  onMouseLeave={() => setHoveredRole(null)}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                      style={{ background: role.color }}
                    >
                      {role.name[0]}
                    </div>
                    <span className="font-semibold text-slate-800 text-xs">{role.name}</span>
                    <button
                      onClick={() => setConfirmReset(role.id)}
                      className="text-[9px] text-slate-400 hover:text-rose-500 flex items-center gap-0.5 transition-colors"
                      title="Reset to defaults"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> reset
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.modules).map(([module, perms], mi) => (
              <>
                <tr key={`module-${module}`} className="border-t border-gray-50">
                  <td
                    colSpan={data.roles.length + 1}
                    className="px-3 py-1.5 bg-gray-50/70 text-[10px] font-bold tracking-wider uppercase text-slate-400"
                  >
                    {module}
                  </td>
                </tr>
                {perms.map((perm, pi) => (
                  <motion.tr
                    key={perm}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: pi * 0.01 }}
                    className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-3 py-2 text-xs text-slate-600 font-mono sticky left-0 bg-card">
                      {perm.replace(":", "​:")}
                    </td>
                    {data.roles.map(role => {
                      const granted = data.matrix[role.id]?.[perm] ?? false;
                      const isHighlighted = hoveredRole === role.id;
                      return (
                        <td
                          key={role.id}
                          className={`px-3 py-2 text-center transition-colors ${isHighlighted ? "bg-gray-50" : ""}`}
                        >
                          <div className="flex justify-center">
                            <PermissionCell
                              role={role.id}
                              permission={perm}
                              granted={granted}
                              isOverridden={false}
                              onToggle={(r, p, g) => toggleMutation.mutate({ role: r, permission: p, granted: g })}
                              isAdmin={role.id === "admin"}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </motion.tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reset confirmation */}
      <AnimatePresence>
        {confirmReset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            onClick={() => setConfirmReset(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 8 }}
              className="bg-card rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-3">
                <RotateCcw className="w-5 h-5 text-slate-600" />
                <h3 className="text-base font-bold text-slate-900">Reset to defaults?</h3>
              </div>
              <p className="text-sm text-slate-500 mb-5">
                All custom overrides for the <strong className="text-slate-700">{confirmReset}</strong> role will be removed and system defaults will apply.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmReset(null)}
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-slate-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => resetMutation.mutate(confirmReset)}
                  disabled={resetMutation.isPending}
                  className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "#DC2626" }}
                >
                  {resetMutation.isPending ? "Resetting…" : "Reset"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
