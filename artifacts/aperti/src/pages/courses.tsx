import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, BookOpen, Clock, Users, Star, ChevronRight, GraduationCap, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const TEAL = "#0D9488";

const SUBJECTS = ["All Subjects","Physics","Math","Chemistry","Biology","English","Computer Science","Economics","History","Geography"];

interface Course {
  id: number;
  title: string;
  description: string | null;
  subject: string | null;
  price_egp: string | null;
  thumbnail_url: string | null;
  duration_weeks: number;
  enrolled_count: number;
  teacher_name: string | null;
  teacher_username: string;
  created_at: string;
}

const SUBJECT_COLORS: Record<string, string> = {
  Physics: "#0D9488", Math: "#0D9488", Chemistry: "#0D9488",
  Biology: "#0D9488", English: "#0D9488", "Computer Science": "#0D9488",
  Economics: "#0D9488", History: "#0D9488", Geography: "#0D9488",
};

function CourseCard({ course, index }: { course: Course; index: number }) {
  const color = SUBJECT_COLORS[course.subject || ""] || TEAL;
  const price = course.price_egp ? `${parseFloat(course.price_egp).toLocaleString()} EGP` : "Free";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <Link href={`/courses/${course.id}`}>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-lg transition-shadow h-full flex flex-col">
          {/* Thumbnail */}
          <div className="h-44 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}15, ${color}30)` }}>
            {course.thumbnail_url ? (
              <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-2" style={{ background: `${color}20` }}>
                    <BookOpen className="h-7 w-7" style={{ color }} />
                  </div>
                  {course.subject && (
                    <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: `${color}15`, color }}>
                      {course.subject}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-5 flex flex-col flex-1">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 flex-1">{course.title}</h3>
              <span className="font-bold text-sm shrink-0 whitespace-nowrap" style={{ color: TEAL }}>{price}</span>
            </div>

            {course.description && (
              <p className="text-xs text-gray-500 line-clamp-2 mb-3 flex-1">{course.description}</p>
            )}

            <div className="flex items-center gap-3 text-xs text-gray-400 mt-auto pt-3 border-t border-gray-50">
              <span className="flex items-center gap-1">
                <GraduationCap className="h-3 w-3" />
                {course.teacher_name || course.teacher_username}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {course.duration_weeks}w
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {course.enrolled_count}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
      <Skeleton className="h-44 w-full" />
      <div className="p-5 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export default function Courses() {
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("All Subjects");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data: courses, isLoading } = useQuery<Course[]>({
    queryKey: ["courses", debouncedSearch, subject],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (subject !== "All Subjects") params.set("subject", subject);
      const res = await fetch(`/api/courses?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load courses");
      return res.json();
    },
  });

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((window as any).__searchTimer);
    (window as any).__searchTimer = setTimeout(() => setDebouncedSearch(val), 400);
  };

  return (
    <div className="min-h-screen" style={{ background: "#F5F5F5" }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-5 py-8">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
            <Badge className="mb-3 rounded-full px-3 py-1 text-xs border-0" style={{ background: "#E6F4F1", color: TEAL }}>
              Course Marketplace
            </Badge>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Find your next course.</h1>
            <p className="text-gray-500 mb-6">Browse courses created by expert teachers. Enroll in seconds.</p>

            {/* Search */}
            <div className="flex gap-3 flex-col sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-10 bg-gray-50 border-gray-200 rounded-xl h-11 text-sm"
                  placeholder="Search courses, subjects, topics…"
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                />
              </div>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 h-11 min-w-[160px] focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Courses grid */}
      <div className="max-w-6xl mx-auto px-5 py-10">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : !courses?.length ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24 max-w-sm mx-auto">
            <div className="w-20 h-20 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-5">
              <BookOpen className="h-10 w-10 text-teal-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No courses available yet</h3>
            <p className="text-sm text-gray-400 mb-1">Courses published by your teachers will appear here.</p>
            <p className="text-xs text-gray-300">Try adjusting your subject filter or check back soon.</p>
          </motion.div>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-5">{courses.length} course{courses.length !== 1 ? "s" : ""} found</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {courses.map((course, i) => (
                <CourseCard key={course.id} course={course} index={i} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
