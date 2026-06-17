import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Plus, Play, Pause, CheckCircle2, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:    "bg-emerald-100 text-emerald-700",
    paused:    "bg-amber-100 text-amber-700",
    completed: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${map[status] ?? map.paused}`}>
      {status}
    </span>
  );
}

function CreateExperimentModal({ plans, onClose, onCreate }: { plans: any[]; onClose: () => void; onCreate: (data: any) => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [planId, setPlanId] = useState("");
  const [priceA, setPriceA] = useState("");
  const [priceB, setPriceB] = useState("");
  const [splitA, setSplitA] = useState("50");

  const splitB = Math.max(0, 100 - parseInt(splitA || "50"));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">New Pricing Experiment</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Experiment Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" placeholder="e.g. Teacher Plan Price Test" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Description</label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" placeholder="Optional" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Base Plan</label>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
              <option value="">Select plan...</option>
              {plans.map((p: any) => <option key={p.id} value={p.id}>{p.name} — EGP {p.price_egp}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Variant A Price (EGP)</label>
              <input type="number" value={priceA} onChange={(e) => setPriceA(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="e.g. 299" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Variant B Price (EGP)</label>
              <input type="number" value={priceB} onChange={(e) => setPriceB(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="e.g. 349" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Traffic Split — A: {splitA}% / B: {splitB}%</label>
            <input type="range" min="10" max="90" value={splitA} onChange={(e) => setSplitA(e.target.value)} className="w-full" />
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => {
              if (!name || !priceA || !priceB) return;
              onCreate({
                name, description: desc,
                planId: planId ? parseInt(planId) : undefined,
                variants: [{ name: "A", price: parseFloat(priceA) }, { name: "B", price: parseFloat(priceB) }],
                trafficSplit: { A: parseInt(splitA), B: splitB },
              });
            }}
          >
            Create
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export default function PricingExperiments() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["pricing-experiments"],
    queryFn: async () => {
      const r = await fetch("/api/pricing-experiments/admin/all", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const { data: plansData } = useQuery<any>({
    queryKey: ["plans-public"],
    queryFn: async () => {
      const r = await fetch("/api/plans/public", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch("/api/pricing-experiments/admin/create", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
    onSuccess: () => { toast({ title: "Experiment created" }); setShowCreate(false); qc.invalidateQueries({ queryKey: ["pricing-experiments"] }); },
    onError: (e) => toast({ title: (e as Error).message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await fetch(`/api/pricing-experiments/admin/${id}/status`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      return d;
    },
    onSuccess: () => { toast({ title: "Experiment updated" }); qc.invalidateQueries({ queryKey: ["pricing-experiments"] }); },
    onError: (e) => toast({ title: (e as Error).message, variant: "destructive" }),
  });

  const experiments: any[] = data?.experiments ?? [];
  const plans: any[] = plansData ?? [];

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <FlaskConical className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pricing Experiments</h1>
            <p className="text-sm text-gray-400">A/B test pricing safely — users stay in their assigned variant</p>
          </div>
        </div>
        <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
          onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5" />New Experiment
        </Button>
      </motion.div>

      {/* Rules card */}
      <Card className="border-0 shadow-sm mb-6">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Experiment Rules</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-700">
            {[
              "Users stay in their assigned variant for the experiment lifetime",
              "No switching mid-subscription — billing integrity preserved",
              "Traffic split is deterministic (hash of user ID)",
              "Ledger is source of truth — experiments only change display price",
            ].map((r, i) => (
              <div key={i} className="p-2 bg-purple-50 rounded-lg text-purple-800 text-[11px]">{r}</div>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-white animate-pulse rounded-xl" />)}
        </div>
      ) : experiments.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FlaskConical className="h-10 w-10 mx-auto mb-3 text-purple-200" />
          <p className="text-sm font-semibold">No experiments yet</p>
          <Button size="sm" className="mt-3 bg-purple-600 hover:bg-purple-700 text-white" onClick={() => setShowCreate(true)}>Create First Experiment</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {experiments.map((exp: any) => (
            <Card key={exp.id} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{exp.name}</p>
                    {exp.description && <p className="text-xs text-gray-400 mt-0.5">{exp.description}</p>}
                  </div>
                  <StatusBadge status={exp.status} />
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <p className="text-lg font-black text-gray-900">{exp.total_assigned ?? 0}</p>
                    <p className="text-[10px] text-gray-400">Assigned</p>
                  </div>
                  <div className="text-center p-2 bg-emerald-50 rounded-lg">
                    <p className="text-lg font-black text-emerald-700">{exp.total_converted ?? 0}</p>
                    <p className="text-[10px] text-gray-400">Converted</p>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded-lg">
                    <p className="text-lg font-black text-blue-700">EGP {parseFloat(exp.avg_revenue_per_user ?? "0").toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400">Avg Revenue</p>
                  </div>
                </div>
                {Array.isArray(exp.variant_stats) && exp.variant_stats.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {exp.variant_stats.map((v: any) => (
                      <div key={v.variant} className="flex items-center gap-3 text-xs">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">{v.variant}</div>
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="font-semibold text-gray-700">{v.assigned} assigned</span>
                            <span className="text-emerald-600 font-semibold">{v.conversion_rate ?? 0}% CVR</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${v.conversion_rate ?? 0}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  {exp.status === "active" && (
                    <Button size="sm" variant="outline" className="gap-1 text-xs text-amber-700 border-amber-200"
                      onClick={() => statusMutation.mutate({ id: exp.id, status: "paused" })}>
                      <Pause className="h-3 w-3" />Pause
                    </Button>
                  )}
                  {exp.status === "paused" && (
                    <Button size="sm" variant="outline" className="gap-1 text-xs text-emerald-700 border-emerald-200"
                      onClick={() => statusMutation.mutate({ id: exp.id, status: "active" })}>
                      <Play className="h-3 w-3" />Resume
                    </Button>
                  )}
                  {exp.status !== "completed" && (
                    <Button size="sm" variant="outline" className="gap-1 text-xs text-gray-600 border-gray-200"
                      onClick={() => statusMutation.mutate({ id: exp.id, status: "completed" })}>
                      <CheckCircle2 className="h-3 w-3" />Complete
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-gray-300 mt-2">Created {new Date(exp.created_at).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateExperimentModal
          plans={plans}
          onClose={() => setShowCreate(false)}
          onCreate={(d) => createMutation.mutate(d)}
        />
      )}
    </div>
  );
}
