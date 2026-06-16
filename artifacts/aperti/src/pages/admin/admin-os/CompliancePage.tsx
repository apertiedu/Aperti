import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Scale, Database, CheckCircle, Clock, RefreshCw, Plus } from "lucide-react";
import { fetchJSON, putJSON, postJSON } from "@/lib/api";
import { toast } from "sonner";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const BACKUP_STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  running: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function CompliancePage() {
  const [tab, setTab] = useState<"requests" | "backups" | "settings">("requests");
  const [settings, setSettings] = useState<Record<string, any>>({});
  const qc = useQueryClient();

  const { data: requests } = useQuery({ queryKey: ["compliance-requests"], queryFn: () => fetchJSON("/api/admin/compliance/requests") });
  const { data: backups } = useQuery({ queryKey: ["compliance-backups"], queryFn: () => fetchJSON("/api/admin/compliance/backups"), refetchInterval: 10000 });
  const { data: platformSettings } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: () => fetchJSON("/api/admin/compliance/platform-settings"),
    onSuccess: (data: any) => setSettings(data || {}),
  } as any);

  const updateRequestMutation = useMutation({
    mutationFn: ({ id, status, notes }: any) => putJSON(`/api/admin/compliance/requests/${id}`, { status, notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["compliance-requests"] }); toast.success("Request updated"); },
    onError: () => toast.error("Failed"),
  });

  const triggerBackupMutation = useMutation({
    mutationFn: () => postJSON("/api/admin/compliance/backups", {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["compliance-backups"] }); toast.success("Backup triggered"); },
    onError: () => toast.error("Backup failed"),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: () => putJSON("/api/admin/compliance/platform-settings", settings),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-settings"] }); toast.success("Settings saved"); },
    onError: () => toast.error("Save failed"),
  });

  const requestList: any[] = (requests as any[]) || [];
  const backupList: any[] = (backups as any[]) || [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Compliance & Governance</h1>
        <p className="text-sm text-gray-500">Data requests, backups, and platform settings</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(["requests", "backups", "settings"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-all ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>{t}</button>
        ))}
      </div>

      {tab === "requests" && (
        <div className="space-y-3">
          {requestList.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <Scale className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No compliance requests</p>
            </div>
          ) : requestList.map((r: any) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-900">{r.displayName || r.username}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[r.status] || "bg-gray-100 text-gray-600"}`}>{r.status}</span>
                  </div>
                  <p className="text-sm text-gray-600">Type: <span className="font-medium">{r.type}</span></p>
                  <p className="text-xs text-gray-400 mt-1">Requested: {new Date(r.requestedAt).toLocaleString()}</p>
                  {r.notes && <p className="text-xs text-gray-500 mt-1">Notes: {r.notes}</p>}
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <button onClick={() => updateRequestMutation.mutate({ id: r.id, status: "completed" })} className="px-3 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100">Complete</button>
                    <button onClick={() => updateRequestMutation.mutate({ id: r.id, status: "rejected" })} className="px-3 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100">Reject</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "backups" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">{backupList.length} backups recorded</p>
            <button onClick={() => triggerBackupMutation.mutate()} disabled={triggerBackupMutation.isPending} className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors">
              {triggerBackupMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              {triggerBackupMutation.isPending ? "Running…" : "Trigger Backup"}
            </button>
          </div>

          {backupList.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <Database className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No backups yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {["#", "Type", "Status", "Size", "Created"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {backupList.map((b: any) => (
                    <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 text-xs">#{b.id}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{b.type}</span></td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BACKUP_STATUS_STYLES[b.status] || "bg-gray-100 text-gray-600"}`}>{b.status}</span></td>
                      <td className="px-4 py-3 text-xs text-gray-500">{b.sizeBytes ? `${(b.sizeBytes / 1024 / 1024).toFixed(1)} MB` : "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(b.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "settings" && (
        <div className="max-w-2xl space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Platform Settings</h3>
            <div className="space-y-4">
              {[
                { key: "maintenance_mode", label: "Maintenance Mode", type: "toggle" },
                { key: "registration_open", label: "Open Registration", type: "toggle" },
                { key: "max_sessions_per_user", label: "Max Sessions Per User", type: "text" },
                { key: "default_subscription_plan", label: "Default Subscription Plan", type: "text" },
                { key: "support_email", label: "Support Email", type: "text" },
                { key: "platform_name", label: "Platform Name", type: "text" },
              ].map((f) => (
                <div key={f.key} className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">{f.label}</label>
                  {f.type === "toggle" ? (
                    <button
                      onClick={() => setSettings(p => ({ ...p, [f.key]: !p[f.key] }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings[f.key] ? "bg-primary" : "bg-gray-200"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${settings[f.key] ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  ) : (
                    <input
                      value={settings[f.key] || ""}
                      onChange={(e) => setSettings(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-48 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary"
                    />
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => saveSettingsMutation.mutate()} disabled={saveSettingsMutation.isPending} className="w-full mt-5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors">
              {saveSettingsMutation.isPending ? "Saving…" : "Save Settings"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
