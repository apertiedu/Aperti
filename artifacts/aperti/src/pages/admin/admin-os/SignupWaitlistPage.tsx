import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON, putJSON } from "@/lib/api";
import { toast } from "sonner";
import {
  Search, Download, Mail, UserCheck, UserX, Phone,
  Users, Clock, TrendingUp, CheckCircle2, RefreshCw,
} from "lucide-react";

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pending",   color: "bg-yellow-100 text-yellow-700" },
  contacted: { label: "Contacted", color: "bg-blue-100 text-blue-700" },
  converted: { label: "Converted", color: "bg-green-100 text-green-700" },
  rejected:  { label: "Rejected",  color: "bg-red-100 text-red-600" },
};

function StatCard({ label, value, icon: Icon, color }: { label: string; value: any; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <Icon className={`w-4 h-4 ${color} mb-2`} />
      <p className="text-2xl font-bold text-gray-900">{value ?? "—"}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

export default function SignupWaitlistPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data: stats } = useQuery({
    queryKey: ["signup-waitlist-stats"],
    queryFn: () => fetchJSON("/api/admin/signup-waitlist/stats"),
    staleTime: 30_000,
  });

  const { data, isLoading, refetch } = useQuery<{ entries: any[]; total: number }>({
    queryKey: ["signup-waitlist", search, statusFilter, page],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), limit: "50" });
      if (search) p.set("search", search);
      if (statusFilter) p.set("status", statusFilter);
      return fetchJSON(`/api/admin/signup-waitlist?${p}`);
    },
    placeholderData: (prev) => prev,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      putJSON(`/api/admin/signup-waitlist/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signup-waitlist"] });
      qc.invalidateQueries({ queryKey: ["signup-waitlist-stats"] });
      toast.success("Status updated");
    },
    onError: () => toast.error("Update failed"),
  });

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 50);

  function handleExport() {
    window.open("/api/admin/signup-waitlist/export", "_blank");
    toast.success("Downloading CSV export");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Signup Waitlist</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage landing page signup submissions — approve, contact, and track conversions</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Submissions" value={stats?.total} icon={Users} color="text-gray-500" />
        <StatCard label="Pending Review" value={stats?.pending} icon={Clock} color="text-yellow-500" />
        <StatCard label="Converted to Users" value={stats?.converted} icon={CheckCircle2} color="text-green-500" />
        <StatCard label="Joined This Week" value={stats?.this_week} icon={TrendingUp} color="text-primary" />
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by email or name…"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => { setStatusFilter(""); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${!statusFilter ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            All ({stats?.total ?? 0})
          </button>
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => { setStatusFilter(statusFilter === key ? "" : key); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${statusFilter === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {meta.label} ({stats?.[key] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="space-y-0">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-16 border-b border-gray-50 animate-pulse bg-gray-50 last:border-0" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-semibold">No submissions found</p>
            <p className="text-sm text-gray-400 mt-1">Adjust your search or filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Name / Email</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Message</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">Date</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((entry: any) => {
                  const meta = STATUS_META[entry.status] ?? STATUS_META.pending;
                  return (
                    <motion.tr key={entry.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-gray-800">{entry.name || "—"}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3" /> {entry.email}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 hidden md:table-cell">{entry.role || "—"}</td>
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <p className="text-gray-500 text-xs max-w-[200px] truncate">{entry.message || "—"}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${meta.color}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-gray-400 text-xs hidden md:table-cell">
                        {entry.created_at ? new Date(entry.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1">
                          {entry.status !== "contacted" && (
                            <button
                              onClick={() => updateMutation.mutate({ id: entry.id, status: "contacted" })}
                              title="Mark as Contacted"
                              className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {entry.status !== "converted" && (
                            <button
                              onClick={() => updateMutation.mutate({ id: entry.id, status: "converted" })}
                              title="Mark as Converted"
                              className="p-1.5 rounded-lg text-green-400 hover:bg-green-50 hover:text-green-600 transition-colors"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {entry.status !== "rejected" && (
                            <button
                              onClick={() => updateMutation.mutate({ id: entry.id, status: "rejected" })}
                              title="Reject"
                              className="p-1.5 rounded-lg text-red-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {entry.status !== "pending" && (
                            <button
                              onClick={() => updateMutation.mutate({ id: entry.id, status: "pending" })}
                              title="Reset to Pending"
                              className="p-1.5 rounded-lg text-gray-300 hover:bg-gray-100 hover:text-gray-500 transition-colors"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">{total} total submissions</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40">Prev</button>
              <span className="text-xs text-gray-500">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
