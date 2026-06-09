import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Download, ChevronLeft, ChevronRight, AlertTriangle, Info, ShieldAlert, Flame } from "lucide-react";
import { fetchJSON } from "@/lib/api";

const ACTION_COLORS: Record<string, string> = {
  create:      "bg-green-100 text-green-700",
  update:      "bg-blue-100 text-blue-700",
  delete:      "bg-red-100 text-red-700",
  login:       "bg-teal-100 text-teal-700",
  logout:      "bg-gray-100 text-gray-600",
  impersonate: "bg-orange-100 text-orange-700",
  verify:      "bg-purple-100 text-purple-700",
  export:      "bg-indigo-100 text-indigo-700",
  role_change: "bg-pink-100 text-pink-700",
};

const SEVERITY_STYLES: Record<string, { badge: string; icon: any }> = {
  info:     { badge: "bg-blue-50 text-blue-600 border border-blue-100",     icon: Info },
  warning:  { badge: "bg-amber-50 text-amber-600 border border-amber-100",  icon: AlertTriangle },
  error:    { badge: "bg-red-50 text-red-600 border border-red-100",        icon: ShieldAlert },
  critical: { badge: "bg-red-100 text-red-800 border border-red-200",       icon: Flame },
};

function SeverityBadge({ severity }: { severity: string }) {
  const s = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.info;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.badge}`}>
      <Icon size={10} />
      {severity}
    </span>
  );
}

export default function AuditPage() {
  const [search, setSearch]       = useState("");
  const [from, setFrom]           = useState("");
  const [to, setTo]               = useState("");
  const [severity, setSeverity]   = useState("");
  const [page, setPage]           = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", search, from, to, severity, page],
    queryFn: () =>
      fetchJSON(`/api/admin/audit-logs?search=${encodeURIComponent(search)}&from=${from}&to=${to}&severity=${severity}&page=${page}&limit=50`),
    keepPreviousData: true,
  } as any);

  const { data: stats } = useQuery({
    queryKey: ["audit-stats"],
    queryFn: () => fetchJSON("/api/admin/audit-logs/stats"),
    staleTime: 60_000,
  });

  const logs: any[]   = (data as any)?.logs  || [];
  const total: number = (data as any)?.total || 0;
  const totalPages    = Math.ceil(total / 50);
  const s             = stats as any || {};

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-sm text-gray-500">{total.toLocaleString()} total entries</p>
        </div>
        <a
          href="/api/admin/audit-logs/export"
          className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
        >
          <Download className="w-4 h-4" /> Export CSV
        </a>
      </div>

      {/* Severity stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["info","warning","error","critical"] as const).map((sev) => {
          const style = SEVERITY_STYLES[sev];
          const Icon  = style.icon;
          const cnt   = s[sev] ?? 0;
          return (
            <button
              key={sev}
              onClick={() => { setSeverity(severity === sev ? "" : sev); setPage(1); }}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                severity === sev ? style.badge + " shadow-sm" : "bg-white border-gray-100 hover:border-gray-200"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${style.badge}`}>
                <Icon size={15} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{cnt.toLocaleString()}</p>
                <p className="text-xs text-gray-500 capitalize">{sev}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search actions…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 bg-white"
          />
        </div>
        <select
          value={severity}
          onChange={(e) => { setSeverity(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 bg-white text-gray-700"
        >
          <option value="">All severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="critical">Critical</option>
        </select>
        <input
          type="date" value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 bg-white text-gray-700"
        />
        <input
          type="date" value={to}
          onChange={(e) => setTo(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 bg-white text-gray-700"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["#", "User", "Action", "Severity", "Resource", "IP Address", "Timestamp"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No logs found</td></tr>
              ) : logs.map((log: any) => (
                <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{log.id}</td>
                  <td className="px-4 py-3">
                    {log.username ? (
                      <div>
                        <p className="font-medium text-gray-900 text-xs">{log.displayName || log.username}</p>
                        <p className="text-gray-400 text-xs">@{log.username}</p>
                      </div>
                    ) : <span className="text-gray-400 text-xs">System</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-600"}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={log.severity || "info"} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {log.resource}{log.resourceId ? ` #${log.resourceId}` : ""}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{log.ipAddress || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">Page {page} of {totalPages} · {total.toLocaleString()} total</p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
