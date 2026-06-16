import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON } from "@/lib/api";
import { Database, CheckCircle, XCircle, Clock, Play, RefreshCw, HardDrive } from "lucide-react";
import { postJSON } from "@/lib/api";

const STATUS_STYLES: Record<string, { badge: string; icon: any }> = {
  success: { badge: "bg-green-100 text-green-700", icon: CheckCircle },
  failed: { badge: "bg-red-100 text-red-700", icon: XCircle },
  pending: { badge: "bg-yellow-100 text-yellow-700", icon: Clock },
};

export default function BackupsPage() {
  const qc = useQueryClient();

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["admin-backup-logs"],
    queryFn: () => fetchJSON("/api/admin/health/backup-logs"),
    refetchInterval: 30000,
  });

  const runMutation = useMutation({
    mutationFn: () => postJSON("/api/admin/health/run-backup", {}),
    onSuccess: () => { setTimeout(() => qc.invalidateQueries({ queryKey: ["admin-backup-logs"] }), 3000); },
  });

  const backupList = (logs as any[]) ?? [];

  const latest = backupList[0];
  const successCount = backupList.filter((b: any) => b.status === "success").length;
  const failedCount = backupList.filter((b: any) => b.status === "failed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Backups</h1>
          <p className="text-sm text-gray-500 mt-0.5">Automated database backups — daily at 02:00 UTC</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-60"
          >
            <Play className="w-4 h-4" /> {runMutation.isPending ? "Running…" : "Run Backup Now"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center mb-3">
            <Database className="w-5 h-5 text-teal-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{backupList.length}</p>
          <p className="text-sm text-gray-500">Total Backups</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{successCount}</p>
          <p className="text-sm text-gray-500">Successful</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center mb-3">
            <XCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{failedCount}</p>
          <p className="text-sm text-gray-500">Failed</p>
        </motion.div>
      </div>

      {/* Schedule Info */}
      <div className="bg-teal-50 border border-teal-100 rounded-xl p-5 flex items-start gap-4">
        <Clock className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold text-teal-900">Automatic Backup Schedule</p>
          <p className="text-sm text-teal-700 mt-0.5">PostgreSQL database is automatically backed up daily at <strong>02:00 UTC</strong> using pg_dump. Up to 10 backups are retained on disk.</p>
          <p className="text-xs text-teal-600 mt-2">Backups are stored in the <code className="bg-teal-100 px-1 rounded">/backups</code> directory on the server. Set <code className="bg-teal-100 px-1 rounded">CDN_URL</code> to upload to cloud storage.</p>
        </div>
      </div>

      {/* Backup Log */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-teal-600" /> Backup History
          </h2>
          <span className="text-xs text-gray-400">{backupList.length} records</span>
        </div>

        {isLoading ? (
          <div className="space-y-3 animate-pulse p-2">{[1,2,3].map(i=><div key={i} className="h-16 bg-gray-100 rounded-xl" />)}</div>
        ) : backupList.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Database className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No backups yet — click "Run Backup Now" to create the first one</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  {["Date", "Type", "Status", "Size", "File"].map((h) => (
                    <th key={h} className="px-6 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {backupList.map((b: any) => {
                  const s = STATUS_STYLES[b.status] || STATUS_STYLES.pending;
                  return (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-600">{new Date(b.created_at).toLocaleString()}</td>
                      <td className="px-6 py-3"><span className="capitalize text-gray-700">{b.type}</span></td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.badge}`}>
                          <s.icon className="w-3 h-3" /> {b.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-500">{b.size_bytes ? `${Math.round(b.size_bytes / 1024)}KB` : "—"}</td>
                      <td className="px-6 py-3 font-mono text-xs text-gray-400">{b.file_url ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
