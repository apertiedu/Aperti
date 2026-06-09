import { useQuery } from "@tanstack/react-query";
import { fetchJSON } from "@/lib/api";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Users, BarChart3, CalendarDays, MessageSquare,
  FileText, ChevronRight, TrendingUp, Bell,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function AttendanceRing({ present, total }: { present: number; total: number }) {
  const pct = total > 0 ? present / total : 0;
  const size = 64;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted/20" />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke="currentColor" strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={circ - pct * circ}
          strokeLinecap="round" className="text-green-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-bold text-foreground">{Math.round(pct * 100)}%</span>
      </div>
    </div>
  );
}

export default function ParentMobileHome() {
  const { data, isLoading } = useQuery({
    queryKey: ["mobile-parent-home"],
    queryFn: () => fetchJSON("/mobile/parent-home"),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const children = data?.children ?? [];
  const attendance = data?.attendance ?? [];
  const grades = data?.recentGrades ?? [];
  const announcements = data?.announcements ?? [];

  const getAttendance = (childId: number) =>
    attendance.find((a: any) => a.student_id === childId) ?? { present: 0, total: 0 };

  return (
    <div className="min-h-screen bg-background pb-20 px-4 pt-4 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium">Family Overview</p>
          <h1 className="text-xl font-bold text-foreground">Guardian Hub</h1>
        </div>
        <Link href="/parent/notifications">
          <button className="w-11 h-11 rounded-full bg-muted/60 flex items-center justify-center min-h-[44px] min-w-[44px]">
            <Bell className="w-5 h-5 text-muted-foreground" />
          </button>
        </Link>
      </div>

      {children.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border/40 p-8 text-center space-y-3">
          <Users className="w-10 h-10 text-primary mx-auto" />
          <p className="font-semibold text-foreground">No children linked yet</p>
          <p className="text-sm text-muted-foreground">Link your child's account to see their progress.</p>
          <Link href="/parent/link-student">
            <button className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold min-h-[44px]">
              Link a Child
            </button>
          </Link>
        </div>
      ) : (
        <>
          {/* Child Cards */}
          <div className="space-y-3">
            {children.map((child: any) => {
              const att = getAttendance(child.id);
              return (
                <Link key={child.id} href={`/parent/child/${child.id}`}>
                  <motion.div
                    whileTap={{ scale: 0.98 }}
                    className="bg-card rounded-2xl border border-border/40 shadow-sm p-4 flex items-center gap-4 min-h-[80px]"
                  >
                    <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
                      {(child.display_name || child.username || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">
                        {child.display_name || child.username}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Attendance: {att.present}/{att.total} days
                      </p>
                    </div>
                    <AttendanceRing present={att.present} total={att.total} />
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </motion.div>
                </Link>
              );
            })}
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: "/parent/grades", icon: BarChart3, label: "Grades", color: "bg-blue-50 dark:bg-blue-950/30 text-blue-600" },
              { href: "/parent/attendance", icon: CalendarDays, label: "Attendance", color: "bg-green-50 dark:bg-green-950/30 text-green-600" },
              { href: "/parent/messages", icon: MessageSquare, label: "Messages", color: "bg-purple-50 dark:bg-purple-950/30 text-purple-600" },
              { href: "/parent/reports", icon: FileText, label: "Reports", color: "bg-orange-50 dark:bg-orange-950/30 text-orange-600" },
            ].map((item) => (
              <Link key={item.href} href={item.href}>
                <motion.div
                  whileTap={{ scale: 0.96 }}
                  className={`${item.color} rounded-2xl p-4 flex items-center gap-3 min-h-[60px]`}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-semibold">{item.label}</span>
                </motion.div>
              </Link>
            ))}
          </div>

          {/* Recent Grades */}
          {grades.length > 0 && (
            <div className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between border-b border-border/40">
                <h2 className="font-semibold text-sm text-foreground">Recent Grades</h2>
                <Link href="/parent/grades">
                  <span className="text-xs text-primary font-medium">All grades</span>
                </Link>
              </div>
              <ul className="divide-y divide-border/30">
                {grades.slice(0, 4).map((g: any, i: number) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="px-4 py-3 flex items-center gap-3 min-h-[52px]"
                  >
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{g.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {g.graded_at ? formatDistanceToNow(new Date(g.graded_at), { addSuffix: true }) : ""}
                      </p>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${
                      g.score >= g.max_score * 0.7 ? "text-green-600" : "text-red-500"
                    }`}>
                      {g.score}/{g.max_score}
                    </span>
                  </motion.li>
                ))}
              </ul>
            </div>
          )}

          {/* Announcements */}
          {announcements.length > 0 && (
            <div className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border/40">
                <h2 className="font-semibold text-sm text-foreground">Announcements</h2>
              </div>
              <ul className="divide-y divide-border/30">
                {announcements.map((a: any) => (
                  <li key={a.id} className="px-4 py-3 min-h-[52px]">
                    <p className="text-sm font-medium text-foreground">{a.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{a.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
