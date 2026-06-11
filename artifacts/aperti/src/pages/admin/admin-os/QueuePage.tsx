import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON } from "@/lib/api";
import { Clock, CheckCircle, XCircle, Loader, Play, RefreshCw, ListTodo, Zap } from "lucide-react";
import { postJSON } from "@/lib/api";

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-3xl font-bold text-gray-900">{value ?? "—"}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </motion.div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  waiting: "bg-yellow-100 text-yellow-700",
  active: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function QueuePage() {
  const qc = useQueryClient();

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["admin-queue-stats"],
    queryFn: () => fetchJSON("/api/admin/queue/stats"),
    refetchInterval: 5000,
  });

  const { data: jobs, refetch: refetchJobs } = useQuery({
    queryKey: ["admin-queue-jobs"],
    queryFn: () => fetchJSON("/api/admin/queue/jobs?limit=50"),
    refetchInterval: 8000,
  });

  const testMutation = useMutation({
    mutationFn: () => postJSON("/api/admin/queue/test", {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-queue-stats"] }); qc.invalidateQueries({ queryKey: ["admin-queue-jobs"] }); },
  });

  const s = stats as any;
  const jobList = (jobs as any[]) ?? [];

  const refetch = () => { refetchStats(); refetchJobs(); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Queue</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monitor background jobs and task processing</p>
        </div>
        <div className="flex gap-2">
          <button onClick={refetch} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-60"
          >
            <Play className="w-4 h-4" /> Test Job
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Waiting" value={s?.waiting ?? 0} icon={Clock} color="bg-yellow-500" />
        <StatCard label="Active" value={s?.active ?? 0} icon={Loader} color="bg-blue-500" />
        <StatCard label="Completed" value={s?.completed ?? 0} icon={CheckCircle} color="bg-green-500" />
        <StatCard label="Failed" value={s?.failed ?? 0} icon={XCircle} color="bg-red-500" />
      </div>

      {/* Queue Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { name: "email-queue", desc: "Transactional emails", icon: Zap },
          { name: "ai-processing-queue", desc: "AI generation tasks", icon: Zap },
          { name: "notification-queue", desc: "Push notifications", icon: Zap },
        ].map((q) => (
          <div key={q.name} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-2">
              <q.icon className="w-4 h-4 text-teal-600" />
              <p className="font-semibold text-gray-900 text-sm">{q.name}</p>
            </div>
            <p className="text-xs text-gray-500">{q.desc}</p>
            <div className="mt-2 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              <span className="text-xs text-green-600">Active</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Jobs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-teal-600" /> Recent Jobs
          </h2>
          <span className="text-xs text-gray-400">{jobList.length} jobs</span>
        </div>
        <div className="overflow-x-auto">
          {jobList.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <ListTodo className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No jobs yet — click "Test Job" to create one</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  {["ID", "Name", "Status", "Attempts", "Created", "Completed"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {jobList.map((job: any) => (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{job.id.slice(0, 12)}…</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{job.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[job.status] || "bg-gray-100 text-gray-600"}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{job.attempts}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(job.createdAt).toLocaleTimeString()}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{job.completedAt ? new Date(job.completedAt).toLocaleTimeString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
