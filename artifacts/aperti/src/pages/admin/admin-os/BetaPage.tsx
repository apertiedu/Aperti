import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON, postJSON } from "@/lib/api";
import { toast } from "sonner";
import { TestTube, Users, Plus, Star, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";

export default function BetaPage() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [enrollModal, setEnrollModal] = useState<any>(null);
  const [userIds, setUserIds] = useState("");

  const { data: betas = [], isLoading } = useQuery({
    queryKey: ["admin-beta"],
    queryFn: () => fetchJSON("/api/admin/beta"),
  });

  const { data: testers = [], isFetching } = useQuery({
    queryKey: ["beta-testers", expanded],
    queryFn: () => expanded ? fetchJSON(`/api/admin/features/${expanded}/beta/testers`) : Promise.resolve([]),
    enabled: !!expanded,
  });

  const enrollMutation = useMutation({
    mutationFn: () => {
      const ids = userIds.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n));
      return postJSON(`/api/admin/features/${enrollModal.id}/beta/enroll`, { user_ids: ids });
    },
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ["admin-beta"] });
      qc.invalidateQueries({ queryKey: ["beta-testers", enrollModal?.id] });
      toast.success(`${d.enrolled} users enrolled`);
      setEnrollModal(null);
      setUserIds("");
    },
    onError: () => toast.error("Enrollment failed"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Beta Program</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage beta testers and collect feature feedback</p>
      </div>

      {/* Stats */}
      {!isLoading && betas.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <TestTube className="w-5 h-5 text-orange-500 mb-2" />
            <p className="text-2xl font-bold text-gray-900">{betas.length}</p>
            <p className="text-xs text-gray-500">Active Beta Programs</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <Users className="w-5 h-5 text-blue-500 mb-2" />
            <p className="text-2xl font-bold text-gray-900">{betas.reduce((s: number, b: any) => s + parseInt(b.active_testers || 0), 0)}</p>
            <p className="text-xs text-gray-500">Total Beta Testers</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <Star className="w-5 h-5 text-yellow-500 mb-2" />
            <p className="text-2xl font-bold text-gray-900">{betas.reduce((s: number, b: any) => s + parseInt(b.total_enrolled || 0), 0)}</p>
            <p className="text-xs text-gray-500">Total Enrolled</p>
          </div>
        </div>
      )}

      {/* Beta Programs List */}
      <div className="space-y-3">
        {isLoading && [1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-gray-100 rounded w-48" />
                <div className="h-3 bg-gray-100 rounded w-64" />
              </div>
              <div className="h-6 w-16 bg-gray-100 rounded-full" />
            </div>
          </div>
        ))}
        {!isLoading && betas.length === 0 && (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
            <TestTube className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium mb-1">No beta programs yet</p>
            <p className="text-gray-400 text-sm">Set a feature's status to "Beta" to enable beta testing</p>
          </div>
        )}
        {betas.map((b: any) => (
          <div key={b.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <TestTube className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{b.name}</p>
                  <p className="text-xs text-gray-500">{b.active_testers} active testers · {b.total_enrolled} total enrolled</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setEnrollModal(b)} className="flex items-center gap-1 px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg text-xs font-medium hover:bg-teal-100 transition-colors">
                  <Plus className="w-3 h-3" /> Enroll Users
                </button>
                <button onClick={() => setExpanded(expanded === b.id ? null : b.id)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors">
                  {expanded === b.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {expanded === b.id && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-t border-gray-100">
                {isFetching ? (
                  <div className="p-6 text-center text-gray-400 text-sm">Loading testers...</div>
                ) : testers.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-sm">No testers enrolled yet</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">User</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Enrolled</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Feedback</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {testers.map((t: any) => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-gray-800">{t.display_name || t.username || `User #${t.user_id}`}</p>
                            <p className="text-xs text-gray-400">{t.email || "—"}</p>
                          </td>
                          <td className="px-4 py-2.5 text-gray-500">{new Date(t.enrolled_at).toLocaleDateString()}</td>
                          <td className="px-4 py-2.5">
                            <span className="flex items-center gap-1 text-gray-600">
                              <MessageSquare className="w-3 h-3" />
                              {(t.feedback || []).length} responses
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                              {t.active ? "Active" : "Inactive"}
                            </span>
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

      {/* Enroll Modal */}
      {enrollModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-gray-900 mb-1">Enroll Beta Testers</h3>
            <p className="text-xs text-gray-500 mb-4">{enrollModal.name}</p>
            <label className="block text-xs font-medium text-gray-600 mb-1">User IDs (comma-separated)</label>
            <input value={userIds} onChange={(e) => setUserIds(e.target.value)} placeholder="1, 5, 12, 34" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 mb-4" />
            <div className="flex gap-3">
              <button onClick={() => { setEnrollModal(null); setUserIds(""); }} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => enrollMutation.mutate()} disabled={!userIds || enrollMutation.isPending} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50">
                {enrollMutation.isPending ? "Enrolling..." : "Enroll"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
