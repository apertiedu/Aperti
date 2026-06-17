import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ShieldAlert, AlertTriangle, CheckCircle2, XCircle, Clock, Search, Scale } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open:          { label: "Open",          color: "bg-red-100 text-red-800 border-red-200" },
  investigating: { label: "Investigating", color: "bg-amber-100 text-amber-800 border-amber-200" },
  resolved:      { label: "Resolved",      color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  rejected:      { label: "Rejected",      color: "bg-gray-100 text-gray-600 border-gray-200" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "bg-gray-100 text-gray-600 border-gray-200" };
  return <Badge className={`text-[10px] font-semibold border ${cfg.color}`}>{cfg.label}</Badge>;
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className="text-xl font-black text-gray-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DisputeCenter() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any | null>(null);
  const [resolution, setResolution] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const { data: disputes = [], isLoading } = useQuery<any[]>({
    queryKey: ["admin-disputes"],
    queryFn: async () => {
      const r = await fetch("/api/disputes", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      const j = await r.json();
      return Array.isArray(j) ? j : (j.disputes ?? []);
    },
    retry: false,
    refetchInterval: 30_000,
  });

  async function updateDispute(id: number, action: "start-review" | "resolve" | "reject", resolutionText?: string) {
    setActionLoading(true);
    try {
      const body: Record<string, unknown> = {};
      if (action === "resolve" && resolutionText) body.resolution = resolutionText;
      if (action === "reject"  && resolutionText) body.reason      = resolutionText;
      const r = await fetch(`/api/disputes/${id}/${action}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Failed");
      toast({ title: `Dispute ${action === "start-review" ? "now under investigation" : action + "d"}` });
      qc.invalidateQueries({ queryKey: ["admin-disputes"] });
      setSelected(null);
      setResolution("");
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  }

  const open          = disputes.filter((d: any) => d.status === "open").length;
  const investigating = disputes.filter((d: any) => d.status === "investigating").length;
  const resolved      = disputes.filter((d: any) => d.status === "resolved").length;
  const rejected      = disputes.filter((d: any) => d.status === "rejected").length;

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center">
            <Scale className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dispute Center</h1>
            <p className="text-sm text-gray-500">Chargeback & dispute resolution management</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={ShieldAlert}   label="Open"          value={open}          color="bg-red-100 text-red-600" />
        <StatCard icon={Search}        label="Investigating" value={investigating}  color="bg-amber-100 text-amber-600" />
        <StatCard icon={CheckCircle2}  label="Resolved"      value={resolved}       color="bg-emerald-100 text-emerald-600" />
        <StatCard icon={XCircle}       label="Rejected"      value={rejected}       color="bg-gray-100 text-gray-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                All Disputes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />)}</div>
              ) : disputes.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No disputes filed</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-xs">ID</TableHead>
                      <TableHead className="text-xs">User</TableHead>
                      <TableHead className="text-xs">Reason</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Filed</TableHead>
                      <TableHead className="text-xs">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disputes.map((d: any) => (
                      <TableRow key={d.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(d)}>
                        <TableCell className="text-xs font-mono text-gray-500">#{d.id}</TableCell>
                        <TableCell className="text-xs">{d.username ?? d.email ?? `User ${d.user_id}`}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{d.reason}</TableCell>
                        <TableCell><StatusBadge status={d.status} /></TableCell>
                        <TableCell className="text-xs text-gray-500">{new Date(d.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            {d.status === "open" && (
                              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                                onClick={() => updateDispute(d.id, "start-review")}>Investigate</Button>
                            )}
                            {(d.status === "open" || d.status === "investigating") && (
                              <>
                                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => { setSelected(d); setResolution(""); }}>Resolve</Button>
                                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-red-300 text-red-700 hover:bg-red-50"
                                  onClick={() => updateDispute(d.id, "reject", "Dispute rejected after review.")}>Reject</Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          {selected ? (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Dispute #{selected.id}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-[11px] text-gray-400 uppercase font-semibold mb-1">Status</p>
                  <StatusBadge status={selected.status} />
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 uppercase font-semibold mb-1">Reason</p>
                  <p className="text-sm text-gray-700">{selected.reason}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 uppercase font-semibold mb-1">Evidence</p>
                  {(selected.evidence ?? []).length === 0 ? (
                    <p className="text-xs text-gray-400 italic">None provided</p>
                  ) : (
                    <ul className="list-disc list-inside space-y-1">
                      {selected.evidence.map((e: string, i: number) => (
                        <li key={i} className="text-xs text-gray-600">{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
                {(selected.status === "open" || selected.status === "investigating") && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-gray-400 uppercase font-semibold">Resolution Note</p>
                    <Textarea
                      className="text-sm min-h-[80px]"
                      placeholder="Add a resolution note..."
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                    />
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                      disabled={actionLoading}
                      onClick={() => updateDispute(selected.id, "resolve", resolution)}
                    >
                      {actionLoading ? "Resolving..." : "Mark Resolved"}
                    </Button>
                  </div>
                )}
                {selected.resolution && (
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase font-semibold mb-1">Resolution</p>
                    <p className="text-sm text-gray-700">{selected.resolution}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8 text-center text-gray-400 text-sm">
                <Scale className="h-10 w-10 mx-auto mb-3 opacity-20" />
                Click a dispute row to view details and take action
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
