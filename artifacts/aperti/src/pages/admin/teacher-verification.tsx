import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BadgeCheck, Users, Award, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = "/api";
const authFetch = (url: string, opts?: RequestInit) =>
  fetch(`${API}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });

export default function TeacherVerification() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [processing, setProcessing] = useState<number | null>(null);

  const { data: teachers, isLoading } = useQuery({
    queryKey: ["teacher-verification"],
    queryFn: () => authFetch("/teacher-verification").then(r => r.json()),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => authFetch(`/teacher-verification/${id}/approve`, { method: "PUT" }).then(r => r.json()),
    onMutate: (id) => setProcessing(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teacher-verification"] }); toast({ title: "Verified badge granted" }); setProcessing(null); },
    onError: () => { toast({ title: "Failed", variant: "destructive" }); setProcessing(null); },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => authFetch(`/teacher-verification/${id}/revoke`, { method: "PUT" }).then(r => r.json()),
    onMutate: (id) => setProcessing(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teacher-verification"] }); toast({ title: "Verified badge revoked" }); setProcessing(null); },
    onError: () => { toast({ title: "Failed", variant: "destructive" }); setProcessing(null); },
  });

  const eligible = teachers?.filter((t: any) => !t.is_verified && parseInt(t.enrolled_count) >= 100) ?? [];
  const verified = teachers?.filter((t: any) => t.is_verified) ?? [];
  const pending = teachers?.filter((t: any) => !t.is_verified && parseInt(t.enrolled_count) < 100) ?? [];

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BadgeCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Teacher Verification</h1>
            <p className="text-sm text-gray-500">Grant the Verified badge to qualifying teachers (100+ enrolled students)</p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Eligible for Verification", value: eligible.length, icon: Award, color: "bg-amber-100 text-amber-700" },
          { label: "Currently Verified", value: verified.length, icon: BadgeCheck, color: "bg-green-100 text-green-700" },
          { label: "Working Toward It", value: pending.length, icon: Users, color: "bg-blue-100 text-blue-700" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-black text-gray-900">{value}</p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Eligible — needs attention */}
      {eligible.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Card className="border-0 shadow-sm border-l-4 border-l-amber-400">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-500" />
                Ready for Verification ({eligible.length})
              </CardTitle>
              <CardDescription>These teachers have 100+ enrolled students and are awaiting your approval.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eligible.map((t: any) => (
                    <TableRow key={t.id} className="bg-amber-50/20">
                      <TableCell className="font-medium">{t.name || t.username}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">@{t.username}</TableCell>
                      <TableCell>
                        <span className="font-bold text-gray-900">{t.enrolled_count}</span>
                        <span className="text-xs text-gray-400 ml-1">students</span>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          className="h-8 bg-primary text-white hover:opacity-90 gap-1.5 text-xs"
                          onClick={() => approveMutation.mutate(t.id)}
                          disabled={processing === t.id}
                        >
                          <BadgeCheck className="h-3.5 w-3.5" /> Grant Verified Badge
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Verified teachers */}
      <Card className="border-0 shadow-sm mb-6">
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-green-600" /> Verified Teachers ({verified.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : verified.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400">No verified teachers yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {verified.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name || t.username}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">@{t.username}</TableCell>
                    <TableCell className="text-sm">{t.enrolled_count}</TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-700 border-0 gap-1 text-xs">
                        <BadgeCheck className="h-3 w-3" /> Verified
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 gap-1"
                        onClick={() => revokeMutation.mutate(t.id)}
                        disabled={processing === t.id}
                      >
                        <XCircle className="h-3 w-3" /> Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm bg-blue-50/50">
        <CardContent className="p-4 flex items-start gap-3">
          <BadgeCheck className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">How verification works</p>
            <p className="text-xs text-blue-600 mt-1 leading-relaxed">
              A teacher becomes eligible once they reach 100+ enrolled students across all published courses. Admins manually review and approve the badge. The badge appears on the teacher's public profile and course cards.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
