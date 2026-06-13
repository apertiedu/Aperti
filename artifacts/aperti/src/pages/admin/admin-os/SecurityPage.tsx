import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Shield, Trash2, LogOut, Key, RefreshCw, Monitor } from "lucide-react";
import { fetchJSON, postJSON } from "@/lib/api";
import { toast } from "sonner";

export default function SecurityPage() {
  const [tab, setTab] = useState<"sessions" | "recovery">("sessions");
  const [recoveryUserId, setRecoveryUserId] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const qc = useQueryClient();

  const { data: sessions, refetch } = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: () => fetchJSON("/api/admin/security/sessions"),
    refetchInterval: 30000,
  });

  const terminateMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin/security/sessions/${id}`, {
        method: "DELETE",
        headers: {},
      }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-sessions"] }); toast.success("Session terminated"); },
    onError: () => toast.error("Failed"),
  });

  const terminateUserMutation = useMutation({
    mutationFn: (userId: number) =>
      fetch(`/api/admin/security/sessions/user/${userId}`, {
        method: "DELETE",
        headers: {},
      }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-sessions"] }); toast.success("All sessions terminated"); },
    onError: () => toast.error("Failed"),
  });

  const recoveryMutation = useMutation({
    mutationFn: () => postJSON("/api/admin/security/account-recovery", { userId: parseInt(recoveryUserId), newPassword: recoveryPassword }),
    onSuccess: () => { toast.success("Account recovered"); setRecoveryUserId(""); setRecoveryPassword(""); },
    onError: () => toast.error("Recovery failed"),
  });

  const sessionList: any[] = (sessions as any[]) || [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Security Center</h1>
        <p className="text-sm text-gray-500">Active sessions, account recovery, and security actions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Sessions", value: sessionList.length, color: "text-teal-600" },
          { label: "Unique Users", value: new Set(sessionList.map((s) => s.accountId)).size, color: "text-blue-600" },
          { label: "Devices", value: new Set(sessionList.map((s) => s.deviceId)).size, color: "text-purple-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["sessions", "recovery"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-all ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>{t === "sessions" ? "Active Sessions" : "Account Recovery"}</button>
        ))}
      </div>

      {tab === "sessions" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">{sessionList.length} active sessions</p>
            <button onClick={() => refetch()} className="flex items-center gap-1 text-xs text-gray-500 hover:text-teal-600 transition-colors">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {["User", "Device", "IP", "Last Active", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessionList.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-400">No active sessions</td></tr>
                ) : sessionList.map((s: any) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{s.displayName || s.username}</p>
                      <p className="text-xs text-gray-400">{s.role}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <Monitor className="w-3 h-3 text-gray-400" />
                        <span className="truncate max-w-32">{s.userAgent?.slice(0, 30) || "Unknown"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.ip || "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(s.lastActiveAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => terminateMutation.mutate(s.id)} className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">End</button>
                        <button onClick={() => { if (confirm("Terminate all sessions for this user?")) terminateUserMutation.mutate(s.accountId); }} className="px-2 py-1 text-xs text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors">All</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "recovery" && (
        <div className="max-w-md">
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <Key className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Account Recovery</p>
                <p className="text-xs text-gray-500">Force-reset a user's password and revoke all sessions</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                <input value={recoveryUserId} onChange={(e) => setRecoveryUserId(e.target.value)} placeholder="Enter user ID" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input type="password" value={recoveryPassword} onChange={(e) => setRecoveryPassword(e.target.value)} placeholder="New temporary password" maxLength={500} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400" />
              </div>
              <button
                onClick={() => { if (confirm("This will reset the user's password and log them out everywhere. Proceed?")) recoveryMutation.mutate(); }}
                disabled={!recoveryUserId || !recoveryPassword || recoveryMutation.isPending}
                className="w-full px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
              >
                {recoveryMutation.isPending ? "Processing…" : "Recover Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
