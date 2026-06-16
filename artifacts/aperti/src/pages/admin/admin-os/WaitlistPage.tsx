import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON, putJSON } from "@/lib/api";
import { toast } from "sonner";
import { Users, Mail, Clock, CheckCircle2, UserCheck, Ban, ChevronDown, ChevronUp } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending:  "bg-yellow-100 text-yellow-700",
  invited:  "bg-blue-100 text-blue-700",
  granted:  "bg-green-100 text-green-700",
  revoked:  "bg-red-100 text-red-600",
};

export default function WaitlistPage() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: waitlists = [], isLoading } = useQuery({
    queryKey: ["admin-waitlists"],
    queryFn: () => fetchJSON("/api/admin/waitlists"),
  });

  const { data: entries = [], isFetching: loadingEntries } = useQuery({
    queryKey: ["waitlist-entries", expanded],
    queryFn: () => expanded ? fetchJSON(`/api/admin/features/${expanded}/waitlist`) : Promise.resolve([]),
    enabled: !!expanded,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => putJSON(`/api/admin/waitlist/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["waitlist-entries", expanded] }); qc.invalidateQueries({ queryKey: ["admin-waitlists"] }); toast.success("Status updated"); },
    onError: () => toast.error("Update failed"),
  });

  const totalWaitlist = waitlists.reduce((s: number, w: any) => s + parseInt(w.total_waitlist || 0), 0);
  const totalPending  = waitlists.reduce((s: number, w: any) => s + parseInt(w.pending || 0), 0);
  const totalGranted  = waitlists.reduce((s: number, w: any) => s + parseInt(w.granted || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Waitlist Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage feature waitlists and grant early access</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total on Waitlists", value: totalWaitlist, icon: Users, color: "text-gray-600" },
          { label: "Pending Review", value: totalPending, icon: Clock, color: "text-yellow-600" },
          { label: "Access Granted", value: totalGranted, icon: CheckCircle2, color: "text-green-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Feature Waitlists */}
      <div className="space-y-3">
        {isLoading && [1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse flex items-center gap-3">
            <div className="h-8 w-8 bg-gray-100 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-gray-100 rounded w-32" />
              <div className="h-3 bg-gray-100 rounded w-48" />
            </div>
          </div>
        ))}
        {!isLoading && waitlists.length === 0 && (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No waitlists yet. Users can join waitlists from feature pages.</p>
          </div>
        )}
        {waitlists.map((w: any) => (
          <div key={w.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === w.id ? null : w.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div>
                  <p className="font-semibold text-gray-900">{w.name}</p>
                  <p className="text-xs text-gray-500">{w.total_waitlist} on waitlist</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex gap-2 text-xs">
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">{w.pending} pending</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{w.invited} invited</span>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full">{w.granted} granted</span>
                </div>
                {expanded === w.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            {expanded === w.id && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="border-t border-gray-100">
                {loadingEntries ? (
                  <div className="p-6 text-center text-gray-400 text-sm">Loading entries...</div>
                ) : entries.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-sm">No waitlist entries</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Name</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Email</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Role</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Interest</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {entries.map((e: any) => (
                        <tr key={e.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-gray-800">{e.name || "—"}</td>
                          <td className="px-4 py-2.5 text-gray-600">
                            <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{e.email}</span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell">{e.role || "—"}</td>
                          <td className="px-4 py-2.5 hidden md:table-cell">
                            <div className="flex gap-0.5">{Array.from({ length: 10 }, (_, i) => (
                              <div key={i} className={`w-1.5 h-3 rounded-sm ${i < (e.interest_level || 5) ? "bg-teal-500" : "bg-gray-200"}`} />
                            ))}</div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[e.status] || "bg-gray-100 text-gray-600"}`}>{e.status}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1">
                              {e.status !== "granted" && (
                                <button onClick={() => updateMutation.mutate({ id: e.id, status: "granted" })} title="Grant access" className="p-1 text-green-500 hover:bg-green-50 rounded transition-colors"><UserCheck className="w-4 h-4" /></button>
                              )}
                              {e.status !== "invited" && e.status !== "granted" && (
                                <button onClick={() => updateMutation.mutate({ id: e.id, status: "invited" })} title="Send invite" className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors"><Mail className="w-4 h-4" /></button>
                              )}
                              {e.status !== "revoked" && (
                                <button onClick={() => updateMutation.mutate({ id: e.id, status: "revoked" })} title="Revoke" className="p-1 text-red-400 hover:bg-red-50 rounded transition-colors"><Ban className="w-4 h-4" /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
