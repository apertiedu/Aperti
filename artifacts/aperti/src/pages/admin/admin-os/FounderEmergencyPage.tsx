import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle, ShieldAlert, UserX, Monitor, Unlock, Wrench,
  Copy, CheckCircle2, ChevronRight, RefreshCw, Clock, User,
} from "lucide-react";
import { fetchJSON, postJSON } from "@/lib/api";

const TEAL = "#0D9488";

function ToolCard({
  icon: Icon, title, description, color, children,
}: {
  icon: any; title: string; description: string; color: string; children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
    >
      <div className={`px-5 py-4 border-b border-gray-50 flex items-center gap-3`}>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </motion.div>
  );
}

function UserIdInput({
  value, onChange, label = "User ID",
}: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Enter user ID (number)"
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 bg-gray-50"
      />
    </div>
  );
}

export default function FounderEmergencyPage() {
  const qc = useQueryClient();
  const [impersonateId, setImpersonateId] = useState("");
  const [forceLogoutId, setForceLogoutId] = useState("");
  const [deviceResetId, setDeviceResetId] = useState("");
  const [unlockId, setUnlockId] = useState("");
  const [copiedToken, setCopiedToken] = useState(false);
  const [impersonateToken, setImpersonateToken] = useState<{ token: string; username: string; role: string } | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});

  const { data: trail, isFetching: trailFetching, refetch: refetchTrail } = useQuery({
    queryKey: ["emergency-audit-trail"],
    queryFn: () => fetchJSON("/api/founder/emergency/audit-trail"),
    refetchInterval: 30000,
  });

  function makeEmergencyMutation(endpoint: string, getBody: () => any, onOk?: (d: any) => void) {
    return useMutation({
      mutationFn: () => postJSON(endpoint, getBody()),
      onSuccess: (d: any) => {
        setResults(r => ({ ...r, [endpoint]: d }));
        onOk?.(d);
        qc.invalidateQueries({ queryKey: ["emergency-audit-trail"] });
      },
    });
  }

  const impersonateMut = makeEmergencyMutation(
    "/api/founder/emergency/impersonate",
    () => ({ targetUserId: parseInt(impersonateId) }),
    d => setImpersonateToken(d),
  );
  const forceLogoutMut = makeEmergencyMutation(
    "/api/founder/emergency/force-logout",
    () => ({ targetUserId: parseInt(forceLogoutId) }),
  );
  const deviceResetMut = makeEmergencyMutation(
    "/api/founder/emergency/reset-device-limit",
    () => ({ targetUserId: parseInt(deviceResetId) }),
  );
  const unlockMut = makeEmergencyMutation(
    "/api/founder/emergency/unlock-account",
    () => ({ targetUserId: parseInt(unlockId) }),
  );
  const repairMut = useMutation({
    mutationFn: () => postJSON("/api/founder/emergency/repair-enrollments", {}),
    onSuccess: (d: any) => {
      setResults(r => ({ ...r, repair: d }));
      qc.invalidateQueries({ queryKey: ["emergency-audit-trail"] });
    },
  });

  function copyToken() {
    if (impersonateToken?.token) {
      navigator.clipboard.writeText(impersonateToken.token).then(() => {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      });
    }
  }

  function confirmAndRun(msg: string, fn: () => void) {
    if (confirm(msg)) fn();
  }

  const ResultBadge = ({ endpoint }: { endpoint: string }) => {
    const r = results[endpoint];
    if (!r) return null;
    return (
      <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-100 text-xs text-green-700 font-medium">
        <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5" />
        {r.username ? `@${r.username} — ` : ""}
        {JSON.stringify(r).slice(0, 120)}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <ShieldAlert className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Founder Emergency Tools</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            High-impact operations with full audit logging. Every action is recorded.
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-700">
          These tools bypass normal access controls. All actions are logged to the audit trail and cannot be undone.
          Use with extreme caution.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ToolCard icon={User} title="Impersonate Account" description="Generate a 1-hour session token for any user" color="bg-purple-50 text-purple-600">
          <div className="space-y-3">
            <UserIdInput value={impersonateId} onChange={setImpersonateId} />
            <button
              onClick={() => confirmAndRun(`Impersonate user ID ${impersonateId}? This will be logged.`, () => impersonateMut.mutate())}
              disabled={!impersonateId || impersonateMut.isPending}
              className="w-full py-2 px-4 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
              style={{ background: TEAL }}
            >
              {impersonateMut.isPending ? "Generating…" : "Generate Token"}
            </button>
            {impersonateToken && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">@{impersonateToken.username} ({impersonateToken.role}) · 1h token</span>
                  <button onClick={copyToken} className="flex items-center gap-1 text-xs text-teal-600 font-medium hover:text-teal-700">
                    {copiedToken ? <><CheckCircle2 className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <div className="font-mono text-[10px] bg-gray-50 rounded-lg p-2 break-all text-gray-600 border border-gray-100">
                  {impersonateToken.token}
                </div>
              </div>
            )}
            {impersonateMut.isError && <p className="text-xs text-red-500">{(impersonateMut.error as any)?.message}</p>}
          </div>
        </ToolCard>

        <ToolCard icon={UserX} title="Force Logout All Sessions" description="Revoke all active sessions and device registrations" color="bg-red-50 text-red-600">
          <div className="space-y-3">
            <UserIdInput value={forceLogoutId} onChange={setForceLogoutId} />
            <button
              onClick={() => confirmAndRun(`Force logout ALL sessions for user ID ${forceLogoutId}? They will need to sign in again.`, () => forceLogoutMut.mutate())}
              disabled={!forceLogoutId || forceLogoutMut.isPending}
              className="w-full py-2 px-4 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              {forceLogoutMut.isPending ? "Revoking…" : "Force Logout"}
            </button>
            <ResultBadge endpoint="/api/founder/emergency/force-logout" />
            {forceLogoutMut.isError && <p className="text-xs text-red-500">{(forceLogoutMut.error as any)?.message}</p>}
          </div>
        </ToolCard>

        <ToolCard icon={Monitor} title="Reset Device Limit" description="Clear all registered devices, allowing fresh sign-in" color="bg-blue-50 text-blue-600">
          <div className="space-y-3">
            <UserIdInput value={deviceResetId} onChange={setDeviceResetId} />
            <button
              onClick={() => confirmAndRun(`Reset device limit for user ID ${deviceResetId}?`, () => deviceResetMut.mutate())}
              disabled={!deviceResetId || deviceResetMut.isPending}
              className="w-full py-2 px-4 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
              style={{ background: "#2563eb" }}
            >
              {deviceResetMut.isPending ? "Clearing…" : "Reset Devices"}
            </button>
            <ResultBadge endpoint="/api/founder/emergency/reset-device-limit" />
            {deviceResetMut.isError && <p className="text-xs text-red-500">{(deviceResetMut.error as any)?.message}</p>}
          </div>
        </ToolCard>

        <ToolCard icon={Unlock} title="Unlock Account" description="Remove login lock and reset failed attempt counter" color="bg-amber-50 text-amber-600">
          <div className="space-y-3">
            <UserIdInput value={unlockId} onChange={setUnlockId} />
            <button
              onClick={() => confirmAndRun(`Unlock account for user ID ${unlockId}?`, () => unlockMut.mutate())}
              disabled={!unlockId || unlockMut.isPending}
              className="w-full py-2 px-4 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
              style={{ background: "#d97706" }}
            >
              {unlockMut.isPending ? "Unlocking…" : "Unlock Account"}
            </button>
            <ResultBadge endpoint="/api/founder/emergency/unlock-account" />
            {unlockMut.isError && <p className="text-xs text-red-500">{(unlockMut.error as any)?.message}</p>}
          </div>
        </ToolCard>
      </div>

      <ToolCard icon={Wrench} title="Repair Enrollments & Clean Up" description="Fix orphaned records, expired tokens, and stale device sessions" color="bg-teal-50 text-teal-600">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Scans for orphaned student enrollments, courses without subjects, expired password tokens, and
            device sessions inactive for 90+ days. Safe to run at any time — read-only except for cleanup.
          </p>
          <button
            onClick={() => confirmAndRun("Run enrollment repair and database cleanup?", () => repairMut.mutate())}
            disabled={repairMut.isPending}
            className="py-2 px-6 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
            style={{ background: TEAL }}
          >
            {repairMut.isPending ? "Running…" : "Run Repair"}
          </button>
          {results["repair"] && (
            <div className="grid sm:grid-cols-4 gap-3 mt-2">
              {Object.entries(results["repair"])
                .filter(([k]) => !["success","repairedAt"].includes(k))
                .map(([k, v]) => (
                  <div key={k} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-lg font-bold text-gray-800">{v as number}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-tight">
                      {k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </div>
      </ToolCard>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-900">Emergency Action Audit Trail</p>
          </div>
          <button onClick={() => refetchTrail()} disabled={trailFetching}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-teal-600 transition-colors">
            <RefreshCw className={`w-3 h-3 ${trailFetching ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {(trail?.trail ?? []).length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">No emergency actions logged yet</div>
          ) : (
            (trail?.trail ?? []).slice(0, 20).map((entry: any) => (
              <div key={entry.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50/50">
                <div className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{entry.action}</p>
                  <p className="text-xs text-gray-400">by @{entry.actor_username ?? "system"} · target: {entry.resource_id}</p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {new Date(entry.created_at).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
