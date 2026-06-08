import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Clock, Users, GraduationCap, CheckCircle2, LogIn } from "lucide-react";
import DiscussButton from "@/components/discuss-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";

const TEAL = "#00796B";
const TEAL_LIGHT = "#E6F4F1";

interface Course {
  id: number; title: string; description: string | null; subject: string | null;
  price_egp: string | null; thumbnail_url: string | null; duration_weeks: number;
  enrolled_count_real: string; teacher_name: string | null; teacher_username: string;
  created_at: string; category: string | null;
}

export default function CourseDetail() {
  const [, params] = useRoute("/courses/:id");
  const courseId = parseInt(params?.id || "0");
  const { user } = useAuth();
  const { toast } = useToast();
  const [enrolled, setEnrolled] = useState(false);

  const { data: course, isLoading } = useQuery<Course>({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const res = await fetch(`/courses/${courseId}`);
      if (!res.ok) throw new Error("Course not found");
      return res.json();
    },
    enabled: courseId > 0,
  });

  const enrollMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("aperti_token") || "";
      const res = await fetch(`/courses/${courseId}/enroll`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Enrollment failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setEnrolled(true);
      toast({ title: "Enrollment request sent! ✅", description: "Your teacher will review and approve your request shortly." });
    },
    onError: (err: Error) => {
      toast({ title: "Enrollment failed", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F5F5F5" }}>
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F5F5F5" }}>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-700 mb-2">Course not found</h2>
          <Link href="/courses"><Button variant="outline">Back to Marketplace</Button></Link>
        </div>
      </div>
    );
  }

  const price = course.price_egp ? `${parseFloat(course.price_egp).toLocaleString()} EGP / mo` : "Free";
  const enrolled_count = parseInt(course.enrolled_count_real || "0");

  return (
    <div className="min-h-screen" style={{ background: "#F5F5F5" }}>
      {/* Header strip */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center gap-4">
          <Link href="/courses">
            <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
              <ArrowLeft className="h-4 w-4" /> Marketplace
            </button>
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Main */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              {/* Hero card */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                <div className="h-52 flex items-center justify-center relative"
                  style={{ background: `linear-gradient(135deg, ${TEAL}15, ${TEAL}30)` }}>
                  {course.thumbnail_url ? (
                    <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: `${TEAL}25` }}>
                        <BookOpen className="h-8 w-8" style={{ color: TEAL }} />
                      </div>
                      {course.subject && (
                        <Badge className="rounded-full px-3 text-xs font-semibold border-0" style={{ background: TEAL_LIGHT, color: TEAL }}>
                          {course.subject}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h1 className="text-2xl font-extrabold text-gray-900">{course.title}</h1>
                    <DiscussButton contextType="course" contextId={courseId} contextTitle={course.title} size="sm" />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                    <GraduationCap className="h-4 w-4" style={{ color: TEAL }} />
                    <span>by <strong className="text-gray-800">{course.teacher_name || course.teacher_username}</strong></span>
                  </div>
                  {course.description && (
                    <p className="text-gray-600 leading-relaxed text-sm">{course.description}</p>
                  )}
                </div>
              </div>

              {/* What you'll get */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="font-bold text-gray-900 mb-4">What's included</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    "Live interactive sessions", "AI-powered mentor access",
                    "Smart flashcard decks", "Homework submissions & grading",
                    "Attendance tracking", "Progress analytics",
                  ].map(item => (
                    <div key={item} className="flex items-center gap-2.5 text-sm text-gray-600">
                      <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: TEAL }} />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right: Enroll card */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 sticky top-20">
              <div className="text-3xl font-black mb-1" style={{ color: TEAL }}>{price}</div>
              <p className="text-xs text-gray-400 mb-5">per month · cancel anytime</p>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Duration</span>
                  <span className="font-semibold text-gray-800">{course.duration_weeks} weeks</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Enrolled</span>
                  <span className="font-semibold text-gray-800">{enrolled_count} students</span>
                </div>
                {course.subject && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" />Subject</span>
                    <span className="font-semibold text-gray-800">{course.subject}</span>
                  </div>
                )}
              </div>

              {enrolled ? (
                <div className="w-full py-3 rounded-xl text-center font-semibold text-sm text-emerald-700 bg-emerald-50 border border-emerald-200">
                  ✅ Enrollment requested!
                </div>
              ) : user?.role === "student" ? (
                <Button className="w-full h-11 rounded-xl font-semibold text-sm text-white"
                  style={{ background: TEAL }}
                  disabled={enrollMutation.isPending}
                  onClick={() => enrollMutation.mutate()}>
                  {enrollMutation.isPending ? "Requesting…" : "Request Enrollment"}
                </Button>
              ) : !user ? (
                <div className="space-y-2">
                  <Link href="/login">
                    <Button className="w-full h-11 rounded-xl font-semibold text-sm text-white" style={{ background: TEAL }}>
                      <LogIn className="h-4 w-4 mr-2" /> Sign in to Enroll
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button variant="outline" className="w-full h-11 rounded-xl font-semibold text-sm border-gray-200">
                      Create Student Account
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-xs text-center text-gray-400 py-3 border border-gray-100 rounded-xl">
                  Only students can enroll in courses.
                </div>
              )}

              <p className="text-[10px] text-gray-400 text-center mt-4">
                Enrollment requires teacher approval. You'll be notified once approved.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
