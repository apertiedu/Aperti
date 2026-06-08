import { useQuery } from "@tanstack/react-query";
import { Shield, Check } from "lucide-react";
import { fetchJSON } from "@/lib/api";

const ROLE_COLORS: Record<string, string> = {
  admin: "from-red-500 to-orange-500",
  teacher: "from-teal-500 to-emerald-500",
  student: "from-blue-500 to-indigo-500",
  parent: "from-purple-500 to-violet-500",
  assistant: "from-orange-500 to-amber-500",
};

export default function RolesPage() {
  const { data: roles } = useQuery({ queryKey: ["admin-roles"], queryFn: () => fetchJSON("/api/admin/roles") });
  const { data: permissions } = useQuery({ queryKey: ["admin-permissions"], queryFn: () => fetchJSON("/api/admin/roles/permissions") });

  const roleList: any[] = (roles as any[]) || [];
  const permMap: Record<string, string[]> = (permissions as any) || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
        <p className="text-sm text-gray-500">System-defined role hierarchy</p>
      </div>

      {/* Role cards */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {roleList.map((role: any) => (
          <div key={role.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            <div className={`bg-gradient-to-r ${ROLE_COLORS[role.id] || "from-gray-500 to-gray-600"} p-4`}>
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-white" />
                <div>
                  <p className="font-bold text-white">{role.name}</p>
                  {role.isSystem && <p className="text-xs text-white/70">System Role</p>}
                </div>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-3">{role.description}</p>
              <div className="flex flex-wrap gap-1">
                {(role.permissions || []).slice(0, 6).map((p: string) => (
                  <span key={p} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{p}</span>
                ))}
                {(role.permissions || []).length > 6 && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">+{role.permissions.length - 6} more</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Permission matrix */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Permission Matrix</h3>
          <p className="text-xs text-gray-500 mt-0.5">All available permissions by module</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Module</th>
                {roleList.map((r: any) => (
                  <th key={r.id} className="text-center px-4 py-3 font-semibold text-gray-600">{r.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(permMap).map(([module, perms]) => (
                <>
                  <tr className="border-b border-gray-50 bg-gray-50/50">
                    <td colSpan={roleList.length + 1} className="px-4 py-1.5">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide capitalize">{module}</p>
                    </td>
                  </tr>
                  {perms.map((perm: string) => (
                    <tr key={perm} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 pl-8">
                        <span className="text-xs text-gray-600 font-mono">{perm}</span>
                      </td>
                      {roleList.map((role: any) => {
                        const hasAll = role.permissions?.includes("all");
                        const hasPerm = hasAll || role.permissions?.includes(perm);
                        return (
                          <td key={role.id} className="text-center px-4 py-2">
                            {hasPerm ? (
                              <Check className="w-4 h-4 text-teal-500 mx-auto" />
                            ) : (
                              <span className="w-4 h-4 block mx-auto text-gray-200">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
