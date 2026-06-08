import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, RefreshCw, CheckCircle2, XCircle, Clock, Filter } from "lucide-react";
import { fetchJSON, postJSON, putJSON } from "@/lib/api";
import { toast } from "sonner";

const TYPE_STYLES: Record<string, string> = {
  duplicate_enrollment: "bg-orange-100 text-orange-700 border-orange-200",
  orphaned_enrollment: "bg-red-100 text-red-700 border-red-200",
  missing_teacher: "bg-red-100 text-red-700 border-red-200",
  missing_role: "bg-yellow-100 text-yellow-700 border-yellow-200",
  permission_conflict: "bg-purple-100 text-purple-700 border-purple-200",
};

const RESOLUTIONS: Record<string, string> = {
  duplicate_enrollment: "Remove duplicate enrollment and keep the earliest active one",
  orphaned_enrollment: "Archive the enrollment — course no longer exists",
  missing_teacher: "Delete the orphaned assistant approval",
  missing_role: "Assign the default 'student' role to this user",
  permission_conflict: "Remove conflicting permission override",
};

function ConflictCard({ conflict: c, onResolve }: any) {
  const [resolving, setResolving] = useState(false);
  const [customRes, setCustomRes] = useState(RESOLUTIONS[c.conflict_type] || "Manually reviewed and resolved");

  return (
    <motion.div layout className={`bg-white rounded-xl border overflow-hidden ${c.status === "resolved" ? "border-gray-100 opacity-60" : "border-gray-200 shadow-sm"}`}>
      <div className={`flex items-center gap-3 px-5 py-3 ${c.status === "resolved" ? "bg-gray-50" : "bg-white"}`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${c.status === "resolved" ? "bg-green-100" : "bg-red-50"}`}>
          {c.status === "resolved" ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded border text-[11px] font-medium ${TYPE_STYLES[c.conflict_type] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
              {c.conflict_type.replace(/_/g, " ")}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${c.status === "resolved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{c.status}</span>
          </div>
          <p className="text-sm text-gray-700 mt-1">{c.description}</p>
          {c.resolution && <p className="text-xs text-gray-400 mt-1 italic">Resolution: {c.resolution}</p>}
          {c.resolver_username && <p className="text-xs text-gray-400">Resolved by {c.resolver_username}</p>}
        </div>
        {c.status !== "resolved" && (
          <button onClick={() => setResolving(!resolving)} className="flex-shrink-0 px-3 py-1.5 text-xs font-medium border border-teal-200 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors">
            {resolving ? "Cancel" : "Resolve"}
          </button>
        )}
      </div>

      <AnimatePresence>
        {resolving && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 space-y-2">
              <label className="text-xs font-medium text-gray-600">Resolution note</label>
              <textarea
                value={customRes}
                onChange={e => setCustomRes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
              <div className="flex justify-end">
                <button onClick={() => onResolve(c.id, customRes)} className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />Mark Resolved
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ConflictPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("open");
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);

  const { data: conflicts, isLoading } = useQuery({
    queryKey: ["gov-conflicts", statusFilter],
    queryFn: () => fetchJSON(`/api/admin/governance/conflicts${statusFilter ? `?status=${statusFilter}` : ""}`),
  });

  const list: any[] = (conflicts as any[]) || [];
  const open = list.filter(c => c.status === "open").length;
  const resolved = list.filter(c => c.status === "resolved").length;

  const resolveMut = useMutation({
    mutationFn: ({ id, resolution }: any) => putJSON(`/api/admin/governance/conflicts/${id}/resolve`, { resolution }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gov-conflicts"] }); toast.success("Conflict resolved"); },
  });

  async function runScan() {
    setScanning(true);
    try {
      const result = await postJSON("/api/admin/governance/enrollments/conflict-scan", {});
      const total = (result as any).total;
      qc.invalidateQueries({ queryKey: ["gov-conflicts"] });
      setLastScan(new Date().toLocaleTimeString());
      toast.success(`Scan complete — ${total} issue(s) found and logged`);
    } catch {
      toast.error("Scan failed");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conflict Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {lastScan ? `Last scan: ${lastScan}` : "Detect and resolve governance conflicts across the platform"}
          </p>
        </div>
        <button onClick={runScan} disabled={scanning} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-70">
          <RefreshCw className={`w-4 h-4 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning..." : "Run System Scan"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Open", value: open, icon: XCircle, style: "text-red-600 bg-red-50" },
          { label: "Resolved", value: resolved, icon: CheckCircle2, style: "text-green-600 bg-green-50" },
          { label: "Total Logged", value: list.length, icon: AlertTriangle, style: "text-yellow-600 bg-yellow-50" },
        ].map(({ label, value, icon: Icon, style }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${style.split(" ")[1]}`}>
              <Icon className={`w-5 h-5 ${style.split(" ")[0]}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        {[
          { label: "Open", val: "open" },
          { label: "Resolved", val: "resolved" },
          { label: "All", val: "" },
        ].map(({ label, val }) => (
          <button key={val || "all"} onClick={() => setStatusFilter(val)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === val ? "bg-teal-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Conflict List */}
      {isLoading ? (
        <div className="text-center py-12 text-sm text-gray-400">Loading conflicts...</div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <CheckCircle2 className="w-12 h-12 text-green-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-700">No {statusFilter} conflicts</p>
          <p className="text-sm text-gray-400 mt-1">Run a scan to detect issues</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((c: any) => (
            <ConflictCard key={c.id} conflict={c} onResolve={(id: number, resolution: string) => resolveMut.mutate({ id, resolution })} />
          ))}
        </div>
      )}
    </div>
  );
}
