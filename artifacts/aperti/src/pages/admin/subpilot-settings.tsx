import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, Settings, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = "/api";
const token = () => localStorage.getItem("aperti_token");

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(options?.headers as object | undefined),
    },
    ...options,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  pending_review: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-600",
  pending: "bg-slate-100 text-slate-600",
};

export default function SubPilotAdmin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [processing, setProcessing] = useState<number | null>(null);

  const { data: subs, isLoading } = useQuery({
    queryKey: ["admin", "subscriptions"],
    queryFn: () => fetchJSON("/subscriptions/admin/all"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${API}/subscriptions/admin/${id}/approve`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token()}` },
      }).then(r => r.json()),
    onMutate: (id) => setProcessing(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      toast({ title: "Subscription approved" });
      setProcessing(null);
    },
    onError: () => { toast({ title: "Failed to approve", variant: "destructive" }); setProcessing(null); },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${API}/subscriptions/admin/${id}/reject`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token()}` },
      }).then(r => r.json()),
    onMutate: (id) => setProcessing(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      toast({ title: "Subscription rejected" });
      setProcessing(null);
    },
    onError: () => { toast({ title: "Failed to reject", variant: "destructive" }); setProcessing(null); },
  });

  const pending = subs?.filter((s: any) => s.status === "pending_review") ?? [];
  const others = subs?.filter((s: any) => s.status !== "pending_review") ?? [];

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SubPilot Admin</h1>
            <p className="text-sm text-gray-500">Review and approve subscription requests</p>
          </div>
          {pending.length > 0 && (
            <Badge className="ml-2 bg-amber-100 text-amber-700 border-0">
              {pending.length} pending
            </Badge>
          )}
        </div>
      </motion.div>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Card className="border-0 shadow-sm border-l-4 border-l-amber-400">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Awaiting Approval ({pending.length})
              </CardTitle>
              <CardDescription>These InstaPay transactions need manual review before the subscription activates.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account ID</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>InstaPay Code</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((sub: any) => (
                    <TableRow key={sub.id} className="bg-amber-50/30">
                      <TableCell className="font-medium text-sm">#{sub.accountId}</TableCell>
                      <TableCell className="text-sm">{sub.plan?.name ?? "—"}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">
                          {sub.instaPayCode || "—"}
                        </code>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {sub.startDate ? new Date(sub.startDate).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-8 bg-[#00796B] hover:bg-[#00695C] text-white text-xs gap-1.5"
                            onClick={() => approveMutation.mutate(sub.id)}
                            disabled={processing === sub.id}
                          >
                            <CheckCircle className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-red-600 border-red-200 hover:bg-red-50 text-xs gap-1.5"
                            onClick={() => rejectMutation.mutate(sub.id)}
                            disabled={processing === sub.id}
                          >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* All subscriptions */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">All Subscriptions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : !subs?.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No subscriptions yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>InstaPay Code</TableHead>
                  <TableHead>Since</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.map((sub: any) => (
                  <TableRow key={sub.id}>
                    <TableCell className="text-sm font-medium">#{sub.accountId}</TableCell>
                    <TableCell className="text-sm">{sub.plan?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs border-0 ${STATUS_COLORS[sub.status] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {sub.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs text-muted-foreground font-mono">
                        {sub.instaPayCode || "—"}
                      </code>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {sub.startDate ? new Date(sub.startDate).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      {sub.status === "pending_review" && (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-[#00796B] text-white hover:bg-[#00695C]"
                            onClick={() => approveMutation.mutate(sub.id)}
                            disabled={processing === sub.id}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => rejectMutation.mutate(sub.id)}
                            disabled={processing === sub.id}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
