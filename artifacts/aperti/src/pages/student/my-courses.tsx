import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { BookOpen, Clock, GraduationCap, CheckCircle2, XCircle, Hourglass, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const TEAL = "#00796B";
const tok = () => localStorage.getItem("aperti_token") || "";

interface Enrollment {
  id: number; course_id: number; course_title: string; subject: string | null;
  description: string | null; price_egp: string | null; thumbnail_url: string | null;
  teacher_name: string | null; status: string; requested_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  pending:  { label: "Pending Approval", icon: Hourglass,     color: "#F57C00", bg: "#FFF3E0" },
  approved: { label: "Enrolled",         icon: CheckCircle2,  color: "#388E3C", bg: "#E8F5E9" },
  rejected: { label: "Rejected",         icon: XCircle,       color: "#C62828", bg: "#FFEBEE" },
};

function EnrollmentCard({ enroll, index }: { enroll: Enrollment; index: number }) {
  const cfg = STATUS_CONFIG[enroll.status] || STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.07 }}>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col sm:flex-row">
        <div className="h-28 sm:h-auto sm:w-32 flex items-center justify-center shrink-0"
          style={{ background: `linear-gradient(135deg, ${TEAL}12, ${TEAL}25)` }}>
          {enroll.thumbnail_url ? (
            <img src={enroll.thumbnail_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <BookOpen className="h-8 w-8" style={{ color: TEAL }} />
          )}
        </div>
        <div className="p-5 flex flex-col flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-bold text-gray-900 text-sm leading-snug">{enroll.course_title}</h3>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold shrink-0"
              style={{ background: cfg.bg, color: cfg.color }}>
              <StatusIcon className="h-3 w-3" /> {cfg.label}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
            {enroll.teacher_name && <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" />{enroll.teacher_name}</span>}
            {enroll.subject && <span>{enroll.subject}</span>}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(enroll.requested_at).toLocaleDateString("en-GB", { day:"numeric", month:"short" })}
            </span>
          </div>
          {enroll.description && <p className="text-xs text-gray-500 line-clamp-2">{enroll.description}</p>}
        </div>
      </div>
    </motion.div>
  );
}

export default function MyCourses() {
  const { data: enrollments, isLoading } = useQuery<Enrollment[]>({
    queryKey: ["student-enrollments"],
    queryFn: async () => {
      const res = await fetch("/courses/my/enrollments", {
        headers: { Authorization: `Bearer ${tok()}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const approved = enrollments?.filter(e => e.status === "approved") || [];
  const pending = enrollments?.filter(e => e.status === "pending") || [];
  const rejected = enrollments?.filter(e => e.status === "rejected") || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" /> My Courses
          </h1>
          <p className="text-gray-500 text-sm mt-1">Courses you've enrolled in or requested.</p>
        </div>
        <Link href="/courses">
          <Button className="gap-2 rounded-xl text-sm" style={{ background: TEAL }}>
            Browse Marketplace <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_,i)=><Skeleton key={i} className="h-28 rounded-2xl"/>)}</div>
      ) : !enrollments?.length ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-200" />
          <h3 className="font-bold text-gray-700 mb-2">No courses yet</h3>
          <p className="text-sm text-gray-400 mb-5">Browse the course marketplace and request enrollment.</p>
          <Link href="/courses">
            <Button className="rounded-xl" style={{ background: TEAL }}>Browse Courses</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {approved.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Active Courses
              </h2>
              <div className="space-y-3">
                {approved.map((e,i) => <EnrollmentCard key={e.id} enroll={e} index={i} />)}
              </div>
            </section>
          )}
          {pending.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <Hourglass className="h-4 w-4 text-amber-600" /> Awaiting Approval
              </h2>
              <div className="space-y-3">
                {pending.map((e,i) => <EnrollmentCard key={e.id} enroll={e} index={i} />)}
              </div>
            </section>
          )}
          {rejected.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" /> Not Approved
              </h2>
              <div className="space-y-3">
                {rejected.map((e,i) => <EnrollmentCard key={e.id} enroll={e} index={i} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
