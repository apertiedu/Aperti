import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, CheckCircle2, RefreshCw, Wrench, Users,
  Copy, Trash2, Link as LinkIcon, ShieldCheck,
} from "lucide-react";


async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(`/api${url}`, {
    ...opts,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function EnrollmentAudit() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [repairing, setRepairing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["enrollment-audit"],
    queryFn: () => apiFetch("/admin/analytics/enrollment-audit"),
    retry: 1,
  });

  const repairMut = useMutation({
    mutationFn: () => apiFetch("/admin/analytics/enrollment-repair", { method: "POST" }),
    onSuccess: (res) => {
      toast({ title: "Repair complete", description: res.message });
      qc.invalidateQueries({ queryKey: ["enrollment-audit"] });
      setRepairing(false);
    },
    onError: () => {
      toast({ title: "Repair failed", description: "Could not complete repair. Check the debug panel.", variant: "destructive" });
      setRepairing(false);
    },
  });

  const handleRepair = () => {
    setRepairing(true);
    repairMut.mutate();
  };

  const hasIssues = data?.hasIssues;
  const orphans: any[] = data?.orphanedEnrollments ?? [];
  const dupes: any[] = data?.duplicateEnrollments ?? [];
  const oldInactiveCount: number = data?.oldInactiveCount ?? 0;

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Enrollment Audit</h1>
              <p className="text-sm text-gray-500">Data integrity check for all student enrollments</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            {hasIssues && (
              <Button
                size="sm"
                onClick={handleRepair}
                disabled={repairing || repairMut.isPending}
                className="gap-2 bg-primary hover:bg-primary/90"
              >
                <Wrench className="h-3.5 w-3.5" />
                {repairing ? "Repairing…" : "Auto-Repair"}
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className={`border-0 shadow-sm ${orphans.length > 0 ? "bg-red-50 border-red-200" : "bg-card"}`}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${orphans.length > 0 ? "bg-red-100" : "bg-green-100"}`}>
                  {orphans.length > 0 ? <Trash2 className="h-5 w-5 text-red-500" /> : <CheckCircle2 className="h-5 w-5 text-green-500" />}
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{orphans.length}</p>
                  <p className="text-xs text-gray-500">Orphaned enrollments</p>
                  <p className="text-[10px] text-gray-400">No matching course found</p>
                </div>
              </CardContent>
            </Card>

            <Card className={`border-0 shadow-sm ${dupes.length > 0 ? "bg-amber-50" : "bg-card"}`}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${dupes.length > 0 ? "bg-amber-100" : "bg-green-100"}`}>
                  {dupes.length > 0 ? <Copy className="h-5 w-5 text-amber-500" /> : <CheckCircle2 className="h-5 w-5 text-green-500" />}
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{dupes.length}</p>
                  <p className="text-xs text-gray-500">Duplicate enrollments</p>
                  <p className="text-[10px] text-gray-400">Same student + course</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-card">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-gray-100">
                  <Users className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{oldInactiveCount}</p>
                  <p className="text-xs text-gray-500">Old inactive records</p>
                  <p className="text-[10px] text-gray-400">Cancelled/expired &gt;90 days</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* All clear */}
          {!hasIssues && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center gap-3 py-16 text-center"
            >
              <div className="h-16 w-16 rounded-2xl bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">All enrollments are valid</h2>
              <p className="text-sm text-gray-400 max-w-xs">No orphaned or duplicate records found. Your enrollment data is clean.</p>
            </motion.div>
          )}

          {/* Orphaned enrollments */}
          {orphans.length > 0 && (
            <Card className="mb-6 border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <CardTitle className="text-base">Orphaned Enrollments ({orphans.length})</CardTitle>
                </div>
                <CardDescription className="text-xs">These enrollments reference courses that no longer exist.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {orphans.map((o: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-red-50/60 border border-red-100">
                      <div className="h-7 w-7 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <LinkIcon className="h-3.5 w-3.5 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800">{o.display_name}</p>
                        <p className="text-[10px] text-gray-400">Status: {o.status} · ID: {o.id}</p>
                      </div>
                      <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Orphan</Badge>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3">Use Auto-Repair to safely remove these orphaned records.</p>
              </CardContent>
            </Card>
          )}

          {/* Duplicate enrollments */}
          {dupes.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Copy className="h-4 w-4 text-amber-500" />
                  <CardTitle className="text-base">Duplicate Enrollments ({dupes.length})</CardTitle>
                </div>
                <CardDescription className="text-xs">These students are enrolled in the same course more than once.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dupes.map((d: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-50/60 border border-amber-100">
                      <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                        <Copy className="h-3.5 w-3.5 text-amber-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-700">Student {d.student_account_id} → Course {d.course_id}</p>
                        <p className="text-[10px] text-gray-400">{d.count} duplicate records</p>
                      </div>
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">×{d.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
