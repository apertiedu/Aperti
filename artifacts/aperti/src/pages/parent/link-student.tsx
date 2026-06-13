import { useState, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Key, Users, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const TEAL = "#0D9488";
const authFetch = (url: string, opts?: RequestInit) =>
  fetch(url, { ...opts, credentials: "include", headers: { "Content-Type": "application/json", ...(opts?.headers || {}) } });

interface GuardianLink {
  id: number; status: string; student_name: string; student_code: string;
  student_display_name: string | null; student_email: string | null;
  pairing_code: string | null; requested_at: string;
}

function ParentCodeSection() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: codeData } = useQuery<{ pairingCode: string }>({
    queryKey: ["parent-code"],
    queryFn: () => authFetch("/parent/my-code").then(r => r.json()),
  });

  const regenMutation = useMutation({
    mutationFn: () => authFetch("/parent/generate-code", { method: "POST" }).then(r => r.json()),
    onSuccess: (data) => {
      qc.setQueryData(["parent-code"], data);
      toast({ title: "New pairing code generated" });
    },
  });

  return (
    <Card className="border border-gray-100 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Key className="h-4 w-4 text-primary" /> Your Parent Pairing Code
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-500 mb-4">Share this code with your child so they can link their account to your parent portal.</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 font-mono text-2xl font-black tracking-[0.3em] text-center py-3 px-5 rounded-xl border-2 border-dashed"
            style={{ borderColor: `${TEAL}40`, color: TEAL, background: `${TEAL}06` }}>
            {codeData?.pairingCode || "--------"}
          </div>
          <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl border-gray-200"
            onClick={() => regenMutation.mutate()} disabled={regenMutation.isPending}>
            <RefreshCw className={`h-4 w-4 ${regenMutation.isPending ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-3">Ask your child to go to their account settings and enter this code.</p>
      </CardContent>
    </Card>
  );
}

function LinkedStudentsSection() {
  const { data: links = [], isLoading } = useQuery<GuardianLink[]>({
    queryKey: ["parent-links"],
    queryFn: () => authFetch("/parent/pending-links").then(r => r.json()),
  });

  const qc = useQueryClient();
  const { toast } = useToast();

  const approveMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      authFetch(`/parent/approve-link/${id}`, { method: "PUT", body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["parent-links"] }); toast({ title: "Link updated" }); },
  });

  if (isLoading) return <div className="h-20 bg-white animate-pulse rounded-2xl" />;

  return (
    <Card className="border border-gray-100 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" /> Linked Children ({links.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No children linked yet</p>
            <p className="text-xs mt-1">Share your pairing code above to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {links.map((link, i) => (
              <motion.div key={link.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: TEAL }}>
                    {(link.student_display_name || link.student_name).slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900">{link.student_display_name || link.student_name}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(link.requested_at).toLocaleDateString("en-GB", { day:"numeric", month:"short" })}
                    </p>
                  </div>
                  <div>
                    {link.status === "pending" ? (
                      <div className="flex gap-1.5">
                        <Button size="sm" className="h-7 px-3 text-xs rounded-lg text-white bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => approveMutation.mutate({ id: link.id, status: "active" })}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-3 text-xs rounded-lg text-red-600 border-red-200"
                          onClick={() => approveMutation.mutate({ id: link.id, status: "rejected" })}>
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <Badge className={`text-[10px] rounded-full px-2 ${link.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                        {link.status === "active" ? "Linked" : "Rejected"}
                      </Badge>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LinkStudent() {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Link Your Child</h1>
        <p className="text-gray-500 text-sm mt-1">Connect your parent account to your child's student profile.</p>
      </div>
      <ParentCodeSection />
      <LinkedStudentsSection />
    </div>
  );
}
