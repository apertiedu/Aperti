import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Clock, RefreshCw, Rocket, Shield, Server, CreditCard, Smartphone, Brain, FileText, Scale } from "lucide-react";
import { fetchJSON, putJSON } from "@/lib/api";

const CATEGORY_ICONS: Record<string, any> = {
  infrastructure: Server,
  core: Shield,
  deprecation: FileText,
  billing: CreditCard,
  security: Shield,
  mobile: Smartphone,
  ai: Brain,
  content: FileText,
  legal: Scale,
};

const CATEGORY_LABELS: Record<string, string> = {
  infrastructure: "Infrastructure",
  core: "Core Functionality",
  deprecation: "Deprecation Cleanup",
  billing: "Billing & Plans",
  security: "Security",
  mobile: "Mobile & PWA",
  ai: "AI Features",
  content: "Content Quality",
  legal: "Legal & Compliance",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "pass") return <CheckCircle size={18} className="text-green-500 shrink-0" />;
  if (status === "fail") return <XCircle size={18} className="text-red-500 shrink-0" />;
  return <Clock size={18} className="text-amber-400 shrink-0" />;
}

export default function LaunchAuditPage() {
  const qc = useQueryClient();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "launch-audit"],
    queryFn: () => fetchJSON("/api/admin/launch-audit"),
  });

  const updateItem = useMutation({
    mutationFn: ({ key, status, notes }: { key: string; status: string; notes: string }) =>
      putJSON(`/api/admin/launch-audit/${key}`, { status, notes, checked_manually: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "launch-audit"] }); setEditingKey(null); },
  });

  const items: any[] = (data as any)?.items || [];
  const summary = (data as any)?.summary || { pass: 0, fail: 0, pending: 0, total: 0, score: 0 };

  const categories = Array.from(new Set(items.map((i: any) => i.category)));
  const grouped = Object.fromEntries(categories.map(cat => [cat, items.filter((i: any) => i.category === cat)]));

  const scoreColor = summary.score >= 80 ? "text-green-600" : summary.score >= 60 ? "text-amber-600" : "text-red-600";
  const scoreBg = summary.score >= 80 ? "bg-green-50 border-green-200" : summary.score >= 60 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Rocket className="text-primary" size={24} /> Launch Readiness Audit</h1>
          <p className="text-sm text-gray-500 mt-1">Automated and manual checks confirming Aperti is ready for production launch.</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw size={14} /> Re-run checks
        </button>
      </div>

      {/* Score card */}
      {!isLoading && (
        <div className={`rounded-xl border p-6 ${scoreBg}`}>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className={`text-5xl font-black ${scoreColor}`}>{summary.score}%</p>
              <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-wide">Readiness Score</p>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-white/70 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{summary.pass}</p>
                <p className="text-xs text-gray-500">Passed</p>
              </div>
              <div className="text-center p-3 bg-white/70 rounded-lg">
                <p className="text-2xl font-bold text-red-500">{summary.fail}</p>
                <p className="text-xs text-gray-500">Failed</p>
              </div>
              <div className="text-center p-3 bg-white/70 rounded-lg">
                <p className="text-2xl font-bold text-amber-500">{summary.pending}</p>
                <p className="text-xs text-gray-500">Pending</p>
              </div>
            </div>
            <div className="text-right text-sm text-gray-500">
              {summary.score >= 80 ? (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-full font-semibold text-xs">
                  <CheckCircle size={12} /> Ready to Launch
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full font-semibold text-xs">
                  <Clock size={12} /> Action Required
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map(cat => {
            const catItems = grouped[cat] || [];
            const CatIcon = CATEGORY_ICONS[cat] || Shield;
            const passed = catItems.filter((i: any) => i.status === "pass").length;
            return (
              <div key={cat} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <CatIcon size={15} className="text-primary" />
                    <span className="text-sm font-semibold text-gray-700">{CATEGORY_LABELS[cat] ?? cat}</span>
                  </div>
                  <span className="text-xs text-gray-400">{passed}/{catItems.length} passed</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {catItems.map((item: any) => (
                    <div key={item.key} className="px-5 py-3">
                      {editingKey === item.key ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-700 flex-1">{item.label}</span>
                            <select defaultValue={item.status}
                              onChange={e => setEditNotes(prev => prev)}
                              id={`status-${item.key}`}
                              className="text-xs border border-gray-200 rounded px-2 py-1">
                              <option value="pass">Pass</option>
                              <option value="fail">Fail</option>
                              <option value="pending">Pending</option>
                            </select>
                          </div>
                          <input type="text" value={editNotes} onChange={e => setEditNotes(e.target.value)}
                            placeholder="Notes (optional)" className="w-full text-xs border border-gray-200 rounded px-2 py-1.5" />
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const sel = document.getElementById(`status-${item.key}`) as HTMLSelectElement;
                                updateItem.mutate({ key: item.key, status: sel?.value ?? "pass", notes: editNotes });
                              }}
                              className="px-3 py-1 bg-primary text-white rounded text-xs hover:bg-primary/80">Save</button>
                            <button onClick={() => setEditingKey(null)} className="px-3 py-1 border border-gray-200 rounded text-xs text-gray-500 hover:bg-gray-50">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <StatusIcon status={item.status} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700">{item.label}</p>
                            {item.detail && <p className="text-xs text-gray-400 mt-0.5">{item.detail}</p>}
                            {item.notes && <p className="text-xs text-blue-600 mt-0.5 italic">"{item.notes}"</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {!item.auto && (
                              <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">Manual</span>
                            )}
                            {item.checked_manually && (
                              <span className="text-xs px-1.5 py-0.5 bg-primary/8 text-primary rounded">Verified</span>
                            )}
                            <button onClick={() => { setEditingKey(item.key); setEditNotes(item.notes ?? ""); }}
                              className="text-xs text-gray-400 hover:text-primary transition-colors px-2 py-1 rounded hover:bg-gray-50">
                              Update
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
