import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "wouter";
import {
  BookOpen, ArrowLeft, GraduationCap, Clock, CheckCircle2,
  XCircle, Hourglass, ArrowRight, Layers, FileText, Users,
  TrendingUp, Play, ExternalLink,
} from "lucide-react";


interface Enrollment {
  id: number; course_id: number; course_title: string; subject: string | null;
  description: string | null; price_egp: string | null; thumbnail_url: string | null;
  teacher_name: string | null; status: string; requested_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  pending:  { label: "Pending Approval", icon: Hourglass,    color: "#92400E", bg: "#FEF3C7" },
  approved: { label: "Enrolled",         icon: CheckCircle2, color: "#065F46", bg: "#ECFDF5" },
  rejected: { label: "Rejected",         icon: XCircle,      color: "#991B1B", bg: "#FEF2F2" },
};

const SUBJECT_COLORS = ["#0D9488", "#2563EB", "#7C3AED", "#DB2777", "#D97706"];

function CourseCard({ enroll, idx, onClick }: { enroll: Enrollment; idx: number; onClick: () => void }) {
  const cfg = STATUS_CONFIG[enroll.status] || STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;
  const color = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
  const isApproved = enroll.status === "approved";

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.07 }}
      whileHover={isApproved ? { y: -3 } : {}}
      className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${isApproved ? "cursor-pointer" : ""}`}
      onClick={isApproved ? onClick : undefined}
      role={isApproved ? "button" : undefined}
    >
      <div className="flex flex-col sm:flex-row">
        <div className="h-24 sm:h-auto sm:w-28 flex items-center justify-center shrink-0 relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${color}20, ${color}40)` }}>
          {enroll.thumbnail_url
            ? <img src={enroll.thumbnail_url} alt="" className="w-full h-full object-cover" />
            : <BookOpen className="h-8 w-8" style={{ color }} />}
        </div>
        <div className="p-4 flex flex-col flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-1">{enroll.course_title}</h3>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
              style={{ background: cfg.bg, color: cfg.color }}>
              <StatusIcon className="h-2.5 w-2.5" /> {cfg.label}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mb-2">
            {enroll.teacher_name && <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" />{enroll.teacher_name}</span>}
            {enroll.subject && <span className="font-medium" style={{ color }}>{enroll.subject}</span>}
          </div>
          {enroll.description && <p className="text-xs text-gray-500 line-clamp-1">{enroll.description}</p>}
          {isApproved && (
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                <span>Progress</span><span>0%</span>
              </div>
              <Progress value={0} className="h-1.5 rounded-full" />
            </div>
          )}
        </div>
        {isApproved && (
          <div className="flex items-center px-4 sm:pr-4">
            <ArrowRight className="h-4 w-4 text-gray-300" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function CourseDetail({ enroll, onBack }: { enroll: Enrollment; onBack: () => void }) {
  const color = SUBJECT_COLORS[0];

  const { data: homework } = useQuery({
    queryKey: ["portal-homework"],
    queryFn: async () => {
      const res = await fetch("/api/portal/homework", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: flashcards } = useQuery({
    queryKey: ["flashcards", "student", "decks"],
    queryFn: async () => {
      const res = await fetch("/api/flashcards/student/decks", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-5">
        <ArrowLeft className="h-4 w-4" /> Back to courses
      </button>

      {/* Course header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
        <div className="h-28 flex items-center justify-center relative"
          style={{ background: `linear-gradient(135deg, ${color}20, ${color}50)` }}>
          {enroll.thumbnail_url
            ? <img src={enroll.thumbnail_url} alt="" className="w-full h-full object-cover absolute inset-0" />
            : <BookOpen className="h-12 w-12" style={{ color }} />}
        </div>
        <div className="p-5">
          <h2 className="text-lg font-black text-gray-900">{enroll.course_title}</h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
            {enroll.teacher_name && <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{enroll.teacher_name}</span>}
            {enroll.subject && <Badge variant="secondary" className="text-xs">{enroll.subject}</Badge>}
          </div>
          {enroll.description && <p className="text-sm text-gray-600 mt-2">{enroll.description}</p>}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span>Overall Progress</span><span>0%</span>
            </div>
            <Progress value={0} className="h-2 rounded-full" />
          </div>
        </div>
      </div>

      <Tabs defaultValue="assignments">
        <TabsList className="grid grid-cols-3 mb-5 h-auto p-1 rounded-xl">
          <TabsTrigger value="assignments" className="text-xs py-2">Assignments</TabsTrigger>
          <TabsTrigger value="flashcards" className="text-xs py-2">Flashcards</TabsTrigger>
          <TabsTrigger value="resources" className="text-xs py-2">Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" /> Assignments
            </h3>
            {!homework || homework.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-8 w-8 mx-auto mb-2 text-gray-200" />
                <p className="text-sm text-gray-400">No assignments for this course yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {homework.slice(0, 5).map((hw: any) => (
                  <Link href="/my-homework" key={hw.id}>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{hw.title}</p>
                        {hw.dueDate && <p className="text-xs text-gray-400 mt-0.5">Due {new Date(hw.dueDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {hw.submissionStatus && (
                          <Badge variant="secondary" className="text-xs capitalize">{hw.submissionStatus}</Badge>
                        )}
                        <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                      </div>
                    </div>
                  </Link>
                ))}
                <Link href="/my-homework">
                  <Button variant="ghost" size="sm" className="w-full text-xs text-teal-600 mt-2">
                    View all assignments <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            )}
          </motion.div>
        </TabsContent>

        <TabsContent value="flashcards">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-600" /> Flashcard Decks
            </h3>
            {!flashcards || flashcards.length === 0 ? (
              <div className="text-center py-8">
                <Layers className="h-8 w-8 mx-auto mb-2 text-gray-200" />
                <p className="text-sm text-gray-400">No flashcard decks yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {flashcards.slice(0, 4).map((deck: any) => (
                  <Link href="/flashcards" key={deck.id}>
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer">
                      <Layers className="h-5 w-5 text-blue-600 mb-2" />
                      <p className="text-xs font-bold text-blue-900 line-clamp-1">{deck.title}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <Link href="/flashcards">
              <Button variant="outline" size="sm" className="w-full text-xs mt-3 gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Go to Flashcard Hub
              </Button>
            </Link>
          </motion.div>
        </TabsContent>

        <TabsContent value="resources">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-teal-600" /> Learning Resources
            </h3>
            <div className="space-y-2">
              {[
                { label: "Past Papers", href: "/papers", icon: FileText, color: "#2563EB" },
                { label: "Study Groups", href: "/study-groups", icon: Users, color: "#7C3AED" },
                { label: "TrialVault Mock Exams", href: "/trial-vault", icon: Play, color: "#D97706" },
              ].map(({ label, href, icon: Icon, color: c }) => (
                <Link href={href} key={label}>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${c}20` }}>
                      <Icon className="h-4 w-4" style={{ color: c }} />
                    </div>
                    <span className="text-sm font-medium text-gray-800">{label}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-gray-400 ml-auto" />
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CourseHub() {
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);

  const { data: enrollments, isLoading } = useQuery<Enrollment[]>({
    queryKey: ["student-enrollments"],
    queryFn: async () => {
      const res = await fetch("/api/courses/my/enrollments", {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const approved = enrollments?.filter((e) => e.status === "approved") || [];
  const pending = enrollments?.filter((e) => e.status === "pending") || [];
  const rejected = enrollments?.filter((e) => e.status === "rejected") || [];

  if (selectedEnrollment) {
    return (
      <div className="min-h-screen bg-[#F8FAFB] px-4 py-6 max-w-3xl mx-auto" style={{ fontFamily: "Inter, sans-serif" }}>
        <CourseDetail enroll={selectedEnrollment} onBack={() => setSelectedEnrollment(null)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFB] px-4 py-6 max-w-3xl mx-auto" style={{ fontFamily: "Inter, sans-serif" }}>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-teal-50 flex items-center justify-center">
              <GraduationCap className="h-4.5 w-4.5 text-teal-600" style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900">Course Hub</h1>
              <p className="text-xs text-gray-500">Your enrolled courses and learning materials</p>
            </div>
          </div>
          <Link href="/courses">
            <Button size="sm" className="gap-1.5 rounded-xl text-xs h-8" style={{ background: "#0D9488" }}>
              Browse <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : !enrollments?.length ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-200" />
          <h3 className="font-bold text-gray-700 mb-2">No courses yet</h3>
          <p className="text-sm text-gray-400 mb-5">Browse the marketplace and enroll.</p>
          <Link href="/courses">
            <Button className="rounded-xl" style={{ background: "#0D9488" }}>Browse Courses</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {approved.length > 0 && (
            <section>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Active Courses
              </h2>
              <div className="space-y-3">
                {approved.map((e, i) => (
                  <CourseCard key={e.id} enroll={e} idx={i} onClick={() => setSelectedEnrollment(e)} />
                ))}
              </div>
            </section>
          )}
          {pending.length > 0 && (
            <section>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Hourglass className="h-3.5 w-3.5 text-amber-600" /> Awaiting Approval
              </h2>
              <div className="space-y-3">
                {pending.map((e, i) => <CourseCard key={e.id} enroll={e} idx={i} onClick={() => {}} />)}
              </div>
            </section>
          )}
          {rejected.length > 0 && (
            <section>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <XCircle className="h-3.5 w-3.5 text-red-500" /> Not Approved
              </h2>
              <div className="space-y-3">
                {rejected.map((e, i) => <CourseCard key={e.id} enroll={e} idx={i} onClick={() => {}} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
