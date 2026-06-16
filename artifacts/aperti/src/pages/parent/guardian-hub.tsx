import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Users, CheckCircle2, BookOpen, TrendingUp, Clock, UserCheck, UserX,
  Key, ChevronRight, AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";


const authFetch = (url: string, opts?: RequestInit) =>
  fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts?.headers || {}),
    },
  });

interface GuardianLink {
  id: number;
  status: string;
  student_name: string;
  student_code: string;
  student_display_name: string | null;
  student_email: string | null;
  pairing_code: string | null;
  requested_at: string;
}

interface StudentStats {
  attendanceRate: number;
  totalSessions: number;
  presentCount: number;
  homeworkSubmitted: number;
  homeworkPending: number;
}

function LinkedChildCard({ link }: { link: GuardianLink }) {
  const name = link.student_display_name || link.student_name || "Student";
  const initials = name.slice(0, 2).toUpperCase();

  const { data: stats } = useQuery<StudentStats>({
    queryKey: ["child-stats", link.id],
    queryFn: async () => {
      const res = await authFetch(`/parent/child-stats/${link.id}`);
      if (!res.ok) return { attendanceRate: 0, totalSessions: 0, presentCount: 0, homeworkSubmitted: 0, homeworkPending: 0 };
      return res.json();
    },
    enabled: link.status === "active",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 w-full" className="bg-primary text-primary-foreground" />
        <CardHeader className="pb-3 pt-5">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              className="bg-primary text-primary-foreground"
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base font-extrabold text-gray-900">{name}</CardTitle>
              {link.student_email && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">{link.student_email}</p>
              )}
            </div>
            <Badge
              className={`text-[10px] rounded-full px-2.5 shrink-0 ${
                link.status === "active"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {link.status === "active" ? "✓ Linked" : "Pending"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {link.status !== "active" ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              This link is awaiting your approval in{" "}
              <Link href="/parent/link-student">
                <span className="underline font-semibold cursor-pointer">Linked Children</span>
              </Link>.
            </div>
          ) : stats ? (
            <>
              <div>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="flex items-center gap-1.5 text-gray-500 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" className="text-primary" />
                    Attendance
                  </span>
                  <span className="font-bold text-gray-900">{stats.attendanceRate}%</span>
                </div>
                <Progress value={stats.attendanceRate} className="h-2" />
                <p className="text-[10px] text-gray-400 mt-1">
                  {stats.presentCount} of {stats.totalSessions} sessions attended
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3 border border-gray-100" className="bg-primary/8">
                  <p className="text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wide">Homework done</p>
                  <p className="text-xl font-black" className="text-primary">{stats.homeworkSubmitted}</p>
                </div>
                <div className="rounded-xl p-3 border border-amber-100 bg-amber-50">
                  <p className="text-[10px] text-amber-500 mb-1 font-medium uppercase tracking-wide">Pending</p>
                  <p className="text-xl font-black text-amber-600">{stats.homeworkPending}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full rounded-lg" />
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PendingCard({ link, onAction }: { link: GuardianLink; onAction: (id: number, status: string) => void }) {
  const name = link.student_display_name || link.student_name || "Student";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl"
    >
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" className="bg-primary text-primary-foreground">
        {name.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-gray-900">{name}</p>
        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
          <Clock className="h-3 w-3" />
          {new Date(link.requested_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button
          size="sm"
          className="h-8 px-3 text-xs rounded-lg gap-1.5 text-white bg-emerald-600 hover:bg-emerald-700"
          onClick={() => onAction(link.id, "active")}
        >
          <UserCheck className="h-3.5 w-3.5" /> Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-3 text-xs rounded-lg gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
          onClick={() => onAction(link.id, "rejected")}
        >
          <UserX className="h-3.5 w-3.5" /> Reject
        </Button>
      </div>
    </motion.div>
  );
}

export default function GuardianHub() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: links = [], isLoading } = useQuery<GuardianLink[]>({
    queryKey: ["parent-links-all"],
    queryFn: () => authFetch("/parent/pending-links").then(r => r.json()),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      authFetch(`/parent/approve-link/${id}`, { method: "PUT", body: JSON.stringify({ status }) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["parent-links-all"] });
      toast({ title: vars.status === "active" ? "Child linked ✅" : "Link rejected" });
    },
    onError: () => toast({ title: "Action failed", variant: "destructive" }),
  });

  const pending = links.filter(l => l.status === "pending");
  const active = links.filter(l => l.status === "active");

  return (
    <div className="min-h-screen p-6 space-y-8" style={{ background: "#F5F5F5" }}>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between flex-wrap gap-4 mb-1">
          <div>
            <h1 className="text-2xl font-black text-gray-900">
              GuardianHub<span className="text-primary">.</span>
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">Your children's learning, at a glance.</p>
          </div>
          <Link href="/parent/link-student">
            <Button
              className="gap-2 rounded-xl text-sm"
              className="bg-primary text-primary-foreground"
            >
              <Key className="h-4 w-4" /> Manage Pairing Code
            </Button>
          </Link>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="grid gap-5 md:grid-cols-2">
          {[0, 1].map(i => (
            <Card key={i} className="border border-gray-100">
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-11 w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-2 w-full rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : links.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-card rounded-2xl border border-dashed border-border p-16 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" className="bg-primary/8">
            <Users className="h-8 w-8" className="text-primary" />
          </div>
          <h3 className="text-lg font-extrabold text-gray-900 mb-2">No children linked yet</h3>
          <p className="text-gray-400 text-sm max-w-xs mx-auto mb-6">
            Get your pairing code and share it with your child so they can link their account to your parent portal.
          </p>
          <Link href="/parent/link-student">
            <Button className="gap-2 rounded-xl" className="bg-primary text-primary-foreground">
              <Key className="h-4 w-4" /> Get Pairing Code <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      ) : (
        <>
          {pending.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-amber-700 mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {pending.length} pending approval{pending.length !== 1 ? "s" : ""}
              </h2>
              <div className="space-y-3">
                {pending.map(link => (
                  <PendingCard
                    key={link.id}
                    link={link}
                    onAction={(id, status) => approveMutation.mutate({ id, status })}
                  />
                ))}
              </div>
            </section>
          )}

          {active.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-gray-500 mb-4 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Linked children ({active.length})
              </h2>
              <div className="grid gap-5 md:grid-cols-2">
                {active.map(link => (
                  <LinkedChildCard key={link.id} link={link} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <div className="rounded-2xl p-4 text-xs text-gray-500 border border-dashed border-border bg-card">
        <p className="font-semibold mb-1 flex items-center gap-1.5" className="text-primary">
          <BookOpen className="h-3.5 w-3.5" /> Quick tip
        </p>
        <p>
          Go to <Link href="/parent/guardian-link"><span className="underline font-semibold cursor-pointer" className="text-primary">GuardianLink</span></Link> to message your child's teachers directly.
          Use <Link href="/parent/link-student"><span className="underline font-semibold cursor-pointer" className="text-primary">Link Your Child</span></Link> to manage your pairing code.
        </p>
      </div>
    </div>
  );
}
