import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Key, Users, Clock, RefreshCw, Copy, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

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
  const [copied, setCopied] = useState(false);

  const { data: codeData, isLoading } = useQuery<{ pairingCode: string }>({
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

  const handleCopy = async () => {
    if (!codeData?.pairingCode) return;
    try {
      await navigator.clipboard.writeText(codeData.pairingCode);
      setCopied(true);
      toast({ title: "Code copied to clipboard" });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ title: "Could not copy — please copy manually", variant: "destructive" });
    }
  };

  return (
    <Card className="border border-gray-100 shadow-sm overflow-hidden">
      <div className="h-1" style={{ background: "linear-gradient(90deg, hsl(var(--primary)), #06b6d4, #8b5cf6)" }} />
      <CardHeader className="pb-3 pt-5">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Key className="h-4 w-4 text-primary" /> Your Parent Pairing Code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-gray-500 leading-relaxed">
          Share this code with your child. They go to <strong>Student Portal → Link to a Parent</strong> and enter it to connect their account to your dashboard.
        </p>

        {isLoading ? (
          <div className="h-16 bg-gray-100 animate-pulse rounded-2xl" />
        ) : (
          <div className="flex items-center gap-2">
            <div
              className="flex-1 font-mono text-3xl font-black tracking-[0.35em] text-center py-4 px-5 rounded-2xl border-2 border-dashed select-all cursor-text"
              style={{ borderColor: "hsl(var(--primary) / 0.25)", color: "hsl(var(--primary))", background: "hsl(var(--primary) / 0.04)" }}
            >
              {codeData?.pairingCode || "--------"}
            </div>
            <div className="flex flex-col gap-1.5">
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-xl border-gray-200"
                onClick={handleCopy}
                disabled={!codeData?.pairingCode}
                title="Copy code"
              >
                {copied
                  ? <Check className="h-4 w-4 text-emerald-500" />
                  : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-xl border-gray-200"
                onClick={() => regenMutation.mutate()}
                disabled={regenMutation.isPending}
                title="Generate new code"
              >
                <RefreshCw className={`h-4 w-4 ${regenMutation.isPending ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-xl bg-primary/8 border border-primary/15 p-3">
          <p className="text-xs font-semibold text-primary mb-2">How to connect</p>
          <div className="space-y-1.5">
            {[
              "Copy the code above and send it to your child",
              "Your child opens Student Portal → Link to a Parent",
              "They enter your 8-character code and submit",
              "You approve the request below — done!",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-xs text-primary">{step}</p>
              </div>
            ))}
          </div>
        </div>
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parent-links"] });
      toast({ title: "Connection updated" });
    },
  });

  const pending = links.filter(l => l.status === "pending");
  const active = links.filter(l => l.status === "active");
  const rejected = links.filter(l => l.status === "rejected");

  if (isLoading) return <div className="h-24 bg-muted animate-pulse rounded-2xl border" />;

  return (
    <Card className="border border-gray-100 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Linked Children
          {pending.length > 0 && (
            <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full animate-pulse">
              {pending.length} pending
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No children linked yet</p>
            <p className="text-xs mt-1">Share your pairing code above to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...pending, ...active, ...rejected].map((link, i) => (
              <motion.div key={link.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <div className={`flex items-center gap-3 p-3.5 rounded-xl border ${link.status === "pending" ? "border-amber-200 bg-amber-50/50" : "border-gray-100 bg-gray-50/50"}`}>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ background: link.status === "active" ? "hsl(var(--primary))" : link.status === "pending" ? "#f59e0b" : "#94a3b8" }}
                  >
                    {(link.student_display_name || link.student_name).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900">{link.student_display_name || link.student_name}</p>
                    <p className="text-xs text-gray-400 font-mono">{link.student_code}</p>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {new Date(link.requested_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div>
                    {link.status === "pending" ? (
                      <div className="flex flex-col gap-1.5">
                        <Button
                          size="sm"
                          className="h-7 px-3 text-xs rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 gap-1"
                          onClick={() => approveMutation.mutate({ id: link.id, status: "active" })}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle2 className="h-3 w-3" />Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 text-xs rounded-lg text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => approveMutation.mutate({ id: link.id, status: "rejected" })}
                          disabled={approveMutation.isPending}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <Badge className={`text-[10px] rounded-full px-2.5 py-1 ${
                        link.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {link.status === "active" ? (
                          <span className="flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5" />Connected</span>
                        ) : "Rejected"}
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
        <p className="text-gray-500 text-sm mt-1">Generate a pairing code and share it with your child to connect their student profile to your dashboard.</p>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
        <div className="flex items-center gap-1.5 font-semibold text-primary">
          <span className="w-5 h-5 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">1</span>
          Get Code
        </div>
        <ArrowRight className="h-3 w-3 text-gray-300 shrink-0" />
        <div className="flex items-center gap-1.5 font-medium">
          <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-[9px] font-bold flex items-center justify-center">2</span>
          Child Enters Code
        </div>
        <ArrowRight className="h-3 w-3 text-gray-300 shrink-0" />
        <div className="flex items-center gap-1.5 font-medium">
          <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-[9px] font-bold flex items-center justify-center">3</span>
          You Approve
        </div>
        <ArrowRight className="h-3 w-3 text-gray-300 shrink-0" />
        <div className="flex items-center gap-1.5 font-medium">
          <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-[9px] font-bold flex items-center justify-center">4</span>
          Connected
        </div>
      </div>

      <ParentCodeSection />
      <LinkedStudentsSection />
    </div>
  );
}
