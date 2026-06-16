import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserCheck, UserX, Clock, User, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const authFetch = (url: string, opts?: RequestInit) =>
  fetch(url, { ...opts, credentials: "include", headers: { "Content-Type": "application/json", ...(opts?.headers || {}) } });

interface PendingStudent {
  id: number; username: string; display_name: string; email: string | null;
  status: string; created_at: string; role: string;
}

export default function StudentApprovals() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: pending = [], isLoading } = useQuery<PendingStudent[]>({
    queryKey: ["pending-students"],
    queryFn: () => authFetch("/students/pending").then(r => r.json()),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "approve" | "reject" }) =>
      authFetch(`/students/${id}/${action}`, { method: "PUT" }).then(r => r.json()),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["pending-students"] });
      toast({ title: vars.action === "approve" ? "Student approved ✅" : "Student rejected" });
    },
    onError: () => toast({ title: "Action failed", variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <UserCheck className="h-6 w-6 text-primary" /> Student Approvals
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Review and approve students who registered and selected you as their teacher.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_,i)=><Skeleton key={i} className="h-20 rounded-2xl"/>)}</div>
      ) : pending.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-200">
          <CardContent className="p-12 text-center text-gray-400">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium">No pending approvals</p>
            <p className="text-sm mt-1">All student registrations have been reviewed.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <strong>{pending.length}</strong> student{pending.length !== 1 ? "s" : ""} waiting for your approval.
          </p>
          {pending.map((student, i) => (
            <motion.div key={student.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Card className="border border-gray-100 shadow-sm">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    className="bg-primary">
                    {(student.display_name || student.username).slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900">{student.display_name || student.username}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                      <span>@{student.username}</span>
                      {student.email && <span>· {student.email}</span>}
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(student.created_at).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" className="h-8 px-3 rounded-lg gap-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700"
                      disabled={approveMutation.isPending}
                      onClick={() => approveMutation.mutate({ id: student.id, action: "approve" })}>
                      <UserCheck className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 px-3 rounded-lg gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
                      disabled={approveMutation.isPending}
                      onClick={() => approveMutation.mutate({ id: student.id, action: "reject" })}>
                      <UserX className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
