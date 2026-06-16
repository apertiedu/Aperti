import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Brain, TrendingUp, DollarSign, Zap, AlertTriangle, Settings, BarChart3, Users, RefreshCw } from "lucide-react";
import { fetchJSON, putJSON } from "@/lib/api";

const COST_PER_1K = 0.002;

function StatCard({ icon: Icon, label, value, sub, color = "primary" }: any) {
  const colors: Record<string, string> = {
    primary: "bg-primary/8 text-primary",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon size={18} />
        </div>
        <span className="text-sm font-medium text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function AiUsagePage() {
  const qc = useQueryClient();
  const [showThresholdEdit, setShowThresholdEdit] = useState(false);
  const [thresholdVal, setThresholdVal] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "ai-usage"],
    queryFn: () => fetchJSON("/api/admin/ai-usage/summary"),
    refetchInterval: 60_000,
  });

  const { data: thresholdData } = useQuery({
    queryKey: ["admin", "ai-threshold"],
    queryFn: () => fetchJSON("/api/admin/ai-usage/threshold"),
  });

  const updateThreshold = useMutation({
    mutationFn: (val: number) => putJSON("/api/admin/ai-usage/threshold", { threshold: val }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "ai-threshold"] }); setShowThresholdEdit(false); },
  });

  const summary = (data as any) || {};
  const daily: any[] = summary.daily || [];
  const byRole: any[] = summary.byRole || [];
  const byType: any[] = summary.byType || [];
  const total = summary.total || { calls: 0, tokens: 0, estimatedCostUSD: 0 };

  const threshold = (thresholdData as any)?.threshold ?? 10;
  const todayCost = daily.length > 0 ? ((daily[daily.length - 1]?.tokens ?? 0) / 1000) * COST_PER_1K : 0;
  const overThreshold = todayCost > threshold;

  const maxCalls = Math.max(...daily.map((d: any) => d.calls), 1);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Brain className="text-primary" size={24} /> AI Usage Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor AI API calls, token consumption, and estimated cost for the last 30 days.</p>
        </div>
        <div className="flex items-center gap-2">
          {overThreshold && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">
              <AlertTriangle size={14} /> Daily cost threshold exceeded
            </div>
          )}
          <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => { setThresholdVal(String(threshold)); setShowThresholdEdit(true); }}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90">
            <Settings size={14} /> Set Threshold
          </button>
        </div>
      </div>

      {showThresholdEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <span className="text-sm text-amber-800 font-medium">Daily cost alert threshold (USD):</span>
          <input type="number" value={thresholdVal} onChange={e => setThresholdVal(e.target.value)}
            className="w-24 px-2 py-1 border border-amber-300 rounded text-sm" min="0" step="0.5" />
          <button onClick={() => updateThreshold.mutate(parseFloat(thresholdVal) || 0)}
            className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700">Save</button>
          <button onClick={() => setShowThresholdEdit(false)} className="text-sm text-gray-500 hover:underline">Cancel</button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Zap} label="Total API Calls (30d)" value={total.calls.toLocaleString()} sub="All AI endpoints" color="primary" />
          <StatCard icon={Brain} label="Tokens Used (30d)" value={total.tokens.toLocaleString()} sub="prompt + completion" color="blue" />
          <StatCard icon={DollarSign} label="Est. Cost (30d)" value={`$${total.estimatedCostUSD?.toFixed(4)}`} sub="at $0.002 / 1K tokens" color="amber" />
          <StatCard icon={TrendingUp} label="Today's Cost" value={`$${todayCost.toFixed(4)}`} sub={`Threshold: $${threshold}/day`} color={overThreshold ? "amber" : "purple"} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily calls chart */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><BarChart3 size={16} className="text-primary" /> Daily API Calls (Last 30 days)</h2>
          {daily.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No AI interactions recorded yet.</p>
          ) : (
            <div className="space-y-1.5">
              {daily.slice(-14).map((d: any) => (
                <div key={d.day} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-20 shrink-0">{d.day?.slice(5, 10)}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${Math.round((d.calls / maxCalls) * 100)}%` }} />
                  </div>
                  <span className="text-xs text-gray-600 w-12 text-right">{d.calls.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By type */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><Zap size={16} className="text-blue-600" /> Calls by Feature</h2>
          {byType.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {byType.map((t: any) => {
                const maxT = Math.max(...byType.map((x: any) => x.calls), 1);
                return (
                  <div key={t.interaction_type} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-28 shrink-0 capitalize">{t.interaction_type?.replace(/_/g, " ")}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.round((t.calls / maxT) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right">{t.calls}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* By role */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><Users size={16} className="text-purple-600" /> Usage by Role</h2>
        {byRole.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">API Calls</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tokens Used</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Est. Cost (USD)</th>
                </tr>
              </thead>
              <tbody>
                {byRole.map((r: any) => (
                  <tr key={r.role ?? "unknown"} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 font-medium text-gray-700 capitalize">{r.role ?? "unknown"}</td>
                    <td className="py-2.5 text-right text-gray-600">{r.calls?.toLocaleString()}</td>
                    <td className="py-2.5 text-right text-gray-600">{r.tokens?.toLocaleString()}</td>
                    <td className="py-2.5 text-right text-gray-600">${((r.tokens / 1000) * COST_PER_1K).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
