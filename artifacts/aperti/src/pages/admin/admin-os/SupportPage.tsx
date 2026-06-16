import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TicketCheck, CheckCircle, Clock, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchJSON, putJSON } from "@/lib/api";
import { toast } from "sonner";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-blue-100 text-blue-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-500",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-gray-100 text-gray-500",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export default function SupportPage() {
  const [statusFilter, setStatusFilter] = useState("open");
  const [page, setPage] = useState(1);
  const [resolving, setResolving] = useState<any>(null);
  const [resolution, setResolution] = useState("");
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["support-tickets", statusFilter, page],
    queryFn: () => fetchJSON(`/api/admin/support/tickets?status=${statusFilter}&page=${page}&limit=20`),
    refetchInterval: 30000,
  });

  const { data: analytics } = useQuery({
    queryKey: ["support-analytics"],
    queryFn: () => fetchJSON("/api/admin/support/tickets/analytics"),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, resolution }: any) => putJSON(`/api/admin/support/tickets/${id}/resolve`, { resolution }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["support-tickets"] }); qc.invalidateQueries({ queryKey: ["support-analytics"] }); toast.success("Ticket resolved"); setResolving(null); setResolution(""); },
    onError: () => toast.error("Failed to resolve"),
  });

  const tickets: any[] = (data as any)?.tickets || [];
  const total: number = (data as any)?.total || 0;
  const a: any = analytics || {};

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
        <p className="text-sm text-gray-500">Manage and resolve user support requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: a.total, icon: TicketCheck, color: "text-gray-900" },
          { label: "Open", value: a.open, icon: AlertCircle, color: "text-yellow-600" },
          { label: "In Progress", value: a.in_progress, icon: Clock, color: "text-blue-600" },
          { label: "Resolved", value: a.resolved, icon: CheckCircle, color: "text-green-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <s.icon className={`w-8 h-8 ${s.color}`} />
            <div>
              <p className="text-xl font-bold text-gray-900">{s.value ?? "—"}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {["open", "in_progress", "resolved", ""].map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }} className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${statusFilter === s ? "bg-primary text-white border-primary" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      {/* Tickets */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["#", "User", "Subject", "Priority", "Status", "Date", "Action"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">No tickets found</td></tr>
              ) : tickets.map((t: any) => (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">#{t.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{t.display_name || t.username}</p>
                    <p className="text-xs text-gray-400">{t.email}</p>
                  </td>
                  <td className="px-4 py-3 max-w-48">
                    <p className="text-gray-900 truncate">{t.subject || t.title || "—"}</p>
                    <p className="text-xs text-gray-400 truncate">{t.description?.slice(0, 60)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_STYLES[t.priority] || "bg-gray-100 text-gray-600"}`}>{t.priority || "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[t.status] || "bg-gray-100 text-gray-600"}`}>{t.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {t.status !== "resolved" && (
                      <button onClick={() => setResolving(t)} className="px-3 py-1 text-xs bg-primary/8 text-primary rounded-lg hover:bg-primary/15 transition-colors">Resolve</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > 20 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">Page {page} · {total} total</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
              <button disabled={tickets.length < 20} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {resolving && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Resolve Ticket #{resolving.id}</h2>
            <p className="text-sm text-gray-600 mb-4">{resolving.subject || resolving.title}</p>
            <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={4} placeholder="Resolution notes…" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary/60" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setResolving(null)} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">Cancel</button>
              <button onClick={() => resolveMutation.mutate({ id: resolving.id, resolution })} disabled={resolveMutation.isPending} className="flex-1 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/80 disabled:opacity-50">
                {resolveMutation.isPending ? "Resolving…" : "Mark Resolved"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
