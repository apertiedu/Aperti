import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  BookOpen, Plus, FileQuestion, Users, GraduationCap, LayoutTemplate,
  MessageSquare, Calendar, BarChart3, FileText, FolderOpen, Bell,
  Inbox, Search, AlertTriangle, RefreshCw, Zap, Sparkles, ClipboardList,
  UserCheck, TrendingUp, Award, Clock, CheckCircle2, Upload, Shield,
  Heart, Star, Coffee, Smile, Target
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type EmptyStateType =
  | "courses" | "questions" | "students" | "assessments" | "flashcards"
  | "homework" | "messages" | "sessions" | "results" | "attendance"
  | "notes" | "resources" | "analytics" | "notifications" | "announcements"
  | "gradebook" | "inbox-zero" | "no-overdue" | "no-warnings" | "all-done"
  | "search" | "search-no-results" | "error" | "offline" | "permission"
  | "first-run-teacher" | "first-run-student" | "first-run-parent" | "first-run-admin"
  | "reports" | "billing" | "enrollments" | "recordings" | "goals"
  | "tickets" | "study-rooms" | "revision" | "certificates" | "generic";

export type EmptyStateSize = "sm" | "md" | "lg";
export type EmptyStateVariant = "default" | "celebration" | "error" | "subtle";

export interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}

interface AppEmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  actions?: EmptyStateAction[];
  size?: EmptyStateSize;
  variant?: EmptyStateVariant;
  searchQuery?: string;
  className?: string;
}

function IllustrationWrapper({ children, color, size }: { children: React.ReactNode; color: string; size: EmptyStateSize }) {
  const dim = size === "sm" ? 64 : size === "md" ? 88 : 112;
  return (
    <div
      className="relative flex items-center justify-center rounded-2xl mx-auto"
      style={{ width: dim, height: dim, backgroundColor: `${color}14` }}
    >
      <div className="absolute inset-0 rounded-2xl" style={{ background: `radial-gradient(circle at 50% 50%, ${color}20, transparent 70%)` }} />
      {children}
    </div>
  );
}

function SVGIllustration({ type, color, size }: { type: EmptyStateType; color: string; size: EmptyStateSize }) {
  const dim = size === "sm" ? 32 : size === "md" ? 44 : 56;

  const illustrations: Partial<Record<EmptyStateType, React.ReactNode>> = {
    courses: <BookOpen size={dim} color={color} strokeWidth={1.5} />,
    questions: <FileQuestion size={dim} color={color} strokeWidth={1.5} />,
    students: <GraduationCap size={dim} color={color} strokeWidth={1.5} />,
    assessments: <ClipboardList size={dim} color={color} strokeWidth={1.5} />,
    flashcards: <Sparkles size={dim} color={color} strokeWidth={1.5} />,
    homework: <FileText size={dim} color={color} strokeWidth={1.5} />,
    messages: <MessageSquare size={dim} color={color} strokeWidth={1.5} />,
    sessions: <Calendar size={dim} color={color} strokeWidth={1.5} />,
    results: <BarChart3 size={dim} color={color} strokeWidth={1.5} />,
    attendance: <UserCheck size={dim} color={color} strokeWidth={1.5} />,
    notes: <FileText size={dim} color={color} strokeWidth={1.5} />,
    resources: <FolderOpen size={dim} color={color} strokeWidth={1.5} />,
    analytics: <TrendingUp size={dim} color={color} strokeWidth={1.5} />,
    notifications: <Bell size={dim} color={color} strokeWidth={1.5} />,
    announcements: <MessageSquare size={dim} color={color} strokeWidth={1.5} />,
    gradebook: <BarChart3 size={dim} color={color} strokeWidth={1.5} />,
    reports: <FileText size={dim} color={color} strokeWidth={1.5} />,
    billing: <Shield size={dim} color={color} strokeWidth={1.5} />,
    enrollments: <Users size={dim} color={color} strokeWidth={1.5} />,
    recordings: <Zap size={dim} color={color} strokeWidth={1.5} />,
    goals: <Target size={dim} color={color} strokeWidth={1.5} />,
    tickets: <Inbox size={dim} color={color} strokeWidth={1.5} />,
    "study-rooms": <Users size={dim} color={color} strokeWidth={1.5} />,
    revision: <Clock size={dim} color={color} strokeWidth={1.5} />,
    certificates: <Award size={dim} color={color} strokeWidth={1.5} />,
    search: <Search size={dim} color={color} strokeWidth={1.5} />,
    "search-no-results": <Search size={dim} color={color} strokeWidth={1.5} />,
    error: <AlertTriangle size={dim} color={color} strokeWidth={1.5} />,
    offline: <Zap size={dim} color={color} strokeWidth={1.5} />,
    permission: <Shield size={dim} color={color} strokeWidth={1.5} />,
    "inbox-zero": <CheckCircle2 size={dim} color={color} strokeWidth={1.5} />,
    "no-overdue": <CheckCircle2 size={dim} color={color} strokeWidth={1.5} />,
    "no-warnings": <Heart size={dim} color={color} strokeWidth={1.5} />,
    "all-done": <Star size={dim} color={color} strokeWidth={1.5} />,
    "first-run-teacher": <LayoutTemplate size={dim} color={color} strokeWidth={1.5} />,
    "first-run-student": <BookOpen size={dim} color={color} strokeWidth={1.5} />,
    "first-run-parent": <Heart size={dim} color={color} strokeWidth={1.5} />,
    "first-run-admin": <Shield size={dim} color={color} strokeWidth={1.5} />,
    generic: <FolderOpen size={dim} color={color} strokeWidth={1.5} />,
  };

  return (
    <>{illustrations[type] ?? illustrations.generic}</>
  );
}

const PRESETS: Record<EmptyStateType, {
  color: string;
  title: string;
  description: string;
  actions?: EmptyStateAction[];
  variant?: EmptyStateVariant;
}> = {
  courses: {
    color: "hsl(var(--primary))",
    title: "No courses yet",
    description: "Create your first course to manage students, assignments, and attendance in one place.",
    actions: [{ label: "Create Course", href: "/my-courses", primary: true, icon: Plus }],
  },
  questions: {
    color: "#7c3aed",
    title: "No questions in the bank",
    description: "Build a question library to create assessments faster and track performance by topic.",
    actions: [
      { label: "Add Question", href: "/question-bank", primary: true, icon: Plus },
      { label: "Generate with AI", href: "/tutorcraft", icon: Sparkles },
    ],
  },
  students: {
    color: "#0ea5e9",
    title: "No students enrolled",
    description: "Invite students to your course or approve pending enrollment requests.",
    actions: [
      { label: "View Enrollments", href: "/my-courses", primary: true, icon: UserCheck },
      { label: "Import Students", href: "/students", icon: Upload },
    ],
  },
  assessments: {
    color: "#f59e0b",
    title: "No assessments yet",
    description: "Create an assessment to test your students' knowledge and track progress over time.",
    actions: [
      { label: "Create Assessment", href: "/assessment-hub", primary: true, icon: Plus },
      { label: "Browse Questions", href: "/question-bank", icon: FileQuestion },
    ],
  },
  flashcards: {
    color: "#ec4899",
    title: "No flashcard decks yet",
    description: "Create flashcard sets to revise faster with spaced repetition and confidence tracking.",
    actions: [
      { label: "Create Deck", href: "/flashcards", primary: true, icon: Plus },
    ],
  },
  homework: {
    color: "hsl(var(--primary))",
    title: "No assignments yet",
    description: "Your teacher hasn't published any assignments yet. You'll be notified as soon as new work becomes available.",
    actions: [{ label: "Browse Resources", href: "/student-resources", primary: true, icon: BookOpen }],
  },
  messages: {
    color: "#6366f1",
    title: "No messages yet",
    description: "Start a conversation with your teacher, classmates, or parent to stay connected.",
    actions: [{ label: "Start a Conversation", href: "/messages", primary: true, icon: MessageSquare }],
  },
  sessions: {
    color: "hsl(var(--primary))",
    title: "No sessions scheduled",
    description: "Add your first lesson session to get started with scheduling and attendance.",
    actions: [{ label: "Add Session", href: "/my-courses", primary: true, icon: Plus }],
  },
  results: {
    color: "#8b5cf6",
    title: "No exam results yet",
    description: "Results will appear here once your teacher grades your submissions.",
    actions: [{ label: "View Assessments", href: "/assessment-hub", primary: true, icon: ClipboardList }],
  },
  attendance: {
    color: "#0ea5e9",
    title: "No attendance records",
    description: "Attendance data will appear once sessions begin and the register is marked.",
  },
  notes: {
    color: "#10b981",
    title: "No notes yet",
    description: "Create notes to capture ideas, revision points, and key concepts.",
    actions: [{ label: "Create Note", primary: true, icon: Plus }],
  },
  resources: {
    color: "hsl(var(--primary))",
    title: "No resources yet",
    description: "Add links, notes, videos, and PDFs to build a library your students can access any time.",
    actions: [{ label: "Add Resource", primary: true, icon: Plus }],
  },
  analytics: {
    color: "#6366f1",
    title: "Analytics build up over time",
    description: "Insights will appear as students begin interacting with your classes, submitting work, and sitting assessments.",
  },
  notifications: {
    color: "hsl(var(--primary))",
    title: "You're all caught up",
    description: "New activity, assignment deadlines, and updates will appear here automatically.",
    variant: "celebration",
  },
  announcements: {
    color: "#f59e0b",
    title: "No announcements yet",
    description: "Post announcements to keep your students and parents informed about important updates.",
    actions: [{ label: "Post Announcement", primary: true, icon: Plus }],
  },
  gradebook: {
    color: "hsl(var(--primary))",
    title: "No grades recorded yet",
    description: "Grades will appear here once assessments are marked and published.",
    actions: [{ label: "View Assessments", href: "/assessment-hub", primary: true, icon: ClipboardList }],
  },
  reports: {
    color: "#8b5cf6",
    title: "No reports generated",
    description: "Run your first report to get a detailed breakdown of student performance.",
    actions: [{ label: "Generate Report", primary: true, icon: FileText }],
  },
  billing: {
    color: "hsl(var(--primary))",
    title: "No billing history",
    description: "Your subscription details and invoices will appear here.",
    actions: [{ label: "View Plans", href: "/subscribe", primary: true, icon: Zap }],
  },
  enrollments: {
    color: "#0ea5e9",
    title: "No enrollment requests",
    description: "When students request to join your courses, their requests will appear here for approval.",
  },
  recordings: {
    color: "#7c3aed",
    title: "No recordings yet",
    description: "Upload lesson recordings to give students on-demand access to class content.",
    actions: [{ label: "Upload Recording", primary: true, icon: Upload }],
  },
  goals: {
    color: "#f59e0b",
    title: "No goals set yet",
    description: "Set academic goals to track your progress and stay motivated throughout the year.",
    actions: [{ label: "Set a Goal", primary: true, icon: Plus }],
  },
  tickets: {
    color: "hsl(var(--primary))",
    title: "No support tickets",
    description: "All open tickets will appear here. Everything is running smoothly.",
    variant: "celebration",
  },
  "study-rooms": {
    color: "#6366f1",
    title: "No study rooms active",
    description: "Create a study room to collaborate with classmates, share notes, and study together.",
    actions: [{ label: "Create Room", primary: true, icon: Plus }],
  },
  revision: {
    color: "#ec4899",
    title: "No revision plan yet",
    description: "Build a revision plan to organise your study schedule and track topic coverage.",
    actions: [{ label: "Create Plan", primary: true, icon: Plus }],
  },
  certificates: {
    color: "#f59e0b",
    title: "No certificates yet",
    description: "Certificates are awarded as you complete courses and reach milestones.",
  },
  "inbox-zero": {
    color: "#10b981",
    title: "Inbox zero — well done",
    description: "You've read everything. Take a moment to enjoy the calm before the next wave.",
    variant: "celebration",
  },
  "no-overdue": {
    color: "#10b981",
    title: "Nothing overdue",
    description: "You're ahead of schedule. Keep up the great work.",
    variant: "celebration",
  },
  "no-warnings": {
    color: "#10b981",
    title: "No attendance warnings",
    description: "All students are meeting attendance requirements. Great news.",
    variant: "celebration",
  },
  "all-done": {
    color: "#10b981",
    title: "All done",
    description: "No pending actions right now. Check back later.",
    variant: "celebration",
  },
  search: {
    color: "#6366f1",
    title: "Search for anything",
    description: "Try searching by student name, topic, subject, or assignment title.",
  },
  "search-no-results": {
    color: "#94a3b8",
    title: "No results found",
    description: "Try different keywords, check your spelling, or browse by category.",
  },
  error: {
    color: "#ef4444",
    title: "Something went wrong",
    description: "We couldn't load this content. Please try again.",
    actions: [{ label: "Retry", primary: true, icon: RefreshCw }],
    variant: "error",
  },
  offline: {
    color: "#6b7280",
    title: "You appear to be offline",
    description: "Check your connection and try refreshing. Your work has been saved.",
    actions: [{ label: "Refresh", primary: true, icon: RefreshCw }],
  },
  permission: {
    color: "#f59e0b",
    title: "Access restricted",
    description: "You don't have permission to view this section. Contact your administrator if you believe this is a mistake.",
  },
  "first-run-teacher": {
    color: "hsl(var(--primary))",
    title: "Welcome to your teaching hub",
    description: "You're all set up. Create your first course to start teaching, or explore the platform.",
    actions: [
      { label: "Create First Course", href: "/my-courses", primary: true, icon: Plus },
      { label: "Explore Platform", href: "/core-hub", icon: BookOpen },
    ],
  },
  "first-run-student": {
    color: "hsl(var(--primary))",
    title: "Welcome to Aperti",
    description: "Your learning dashboard is ready. Browse your courses or explore study tools to get started.",
    actions: [
      { label: "Browse Courses", href: "/my-courses", primary: true, icon: BookOpen },
      { label: "Study Tools", href: "/study-stream", icon: Sparkles },
    ],
  },
  "first-run-parent": {
    color: "hsl(var(--primary))",
    title: "Welcome to your parent portal",
    description: "Link your child's account to track their progress, attendance, and grades.",
    actions: [
      { label: "Link Child Account", href: "/parent/link-child", primary: true, icon: Plus },
    ],
  },
  "first-run-admin": {
    color: "hsl(var(--primary))",
    title: "Platform ready",
    description: "Your Aperti instance is configured. Start by inviting teachers or reviewing platform settings.",
    actions: [
      { label: "Manage Teachers", href: "/admin/teachers", primary: true, icon: Users },
      { label: "Platform Settings", href: "/admin/settings", icon: Shield },
    ],
  },
  generic: {
    color: "hsl(var(--primary))",
    title: "Nothing here yet",
    description: "Content will appear here as you start using this feature.",
  },
};

const sizeConfig = {
  sm: { py: "py-8", gap: "gap-3", titleSize: "text-base", descSize: "text-xs", maxW: "max-w-sm" },
  md: { py: "py-12", gap: "gap-4", titleSize: "text-lg", descSize: "text-sm", maxW: "max-w-md" },
  lg: { py: "py-16", gap: "gap-5", titleSize: "text-xl", descSize: "text-sm", maxW: "max-w-lg" },
};

export function AppEmptyState({
  type = "generic",
  title,
  description,
  actions,
  size = "md",
  variant,
  searchQuery,
  className = "",
}: AppEmptyStateProps) {
  const preset = PRESETS[type] ?? PRESETS.generic;
  const resolvedTitle = title ?? preset.title;
  const resolvedDescription = description ?? (
    type === "search-no-results" && searchQuery
      ? `No results for "${searchQuery}". Try different keywords, check spelling, or browse by category.`
      : preset.description
  );
  const resolvedActions = actions ?? preset.actions ?? [];
  const resolvedVariant = variant ?? preset.variant ?? "default";
  const resolvedColor = preset.color;
  const sc = sizeConfig[size];

  const isCelebration = resolvedVariant === "celebration";
  const isError = resolvedVariant === "error";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`flex flex-col items-center text-center ${sc.py} ${sc.gap} ${className}`}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <IllustrationWrapper color={isCelebration ? "#10b981" : isError ? "#ef4444" : resolvedColor} size={size}>
          {isCelebration ? (
            <CheckCircle2 size={size === "sm" ? 32 : size === "md" ? 44 : 56} color="#10b981" strokeWidth={1.5} />
          ) : (
            <SVGIllustration type={type} color={resolvedColor} size={size} />
          )}
        </IllustrationWrapper>
      </motion.div>

      <div className={`${sc.maxW} space-y-1.5`}>
        <h3 className={`font-semibold text-foreground ${sc.titleSize} leading-tight`}>
          {resolvedTitle}
        </h3>
        <p className={`${sc.descSize} text-muted-foreground leading-relaxed`}>
          {resolvedDescription}
        </p>
      </div>

      {type === "search-no-results" && (
        <div className="flex flex-wrap justify-center gap-2">
          {["Check spelling", "Try broader terms", "Browse all"].map(s => (
            <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
              {s}
            </span>
          ))}
        </div>
      )}

      {resolvedActions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-2.5"
        >
          {resolvedActions.map((action, i) => {
            const Icon = action.icon;
            const btn = (
              <Button
                key={i}
                size={size === "sm" ? "sm" : "default"}
                variant={action.primary ? "default" : "outline"}
                className={action.primary ? "gap-2" : "gap-2"}
                onClick={action.onClick}
              >
                {Icon && <Icon size={15} />}
                {action.label}
              </Button>
            );
            return action.href ? <Link key={i} href={action.href}>{btn}</Link> : btn;
          })}
        </motion.div>
      )}

      {isCelebration && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium"
        >
          <CheckCircle2 size={12} />
          You're on top of everything
        </motion.div>
      )}
    </motion.div>
  );
}

interface TableEmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  action?: EmptyStateAction;
  colSpan?: number;
}

export function TableEmptyState({ type = "generic", title, description, action, colSpan = 6 }: TableEmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12">
        <AppEmptyState type={type} title={title} description={description} actions={action ? [action] : []} size="sm" />
      </td>
    </tr>
  );
}

interface SectionEmptyProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
}

export function SectionEmpty({ type = "generic", title, description, action, className }: SectionEmptyProps) {
  return (
    <div className={`rounded-xl border border-dashed border-border bg-muted/20 ${className ?? ""}`}>
      <AppEmptyState type={type} title={title} description={description} actions={action ? [action] : []} size="sm" />
    </div>
  );
}

export function SearchEmptyState({ query, suggestions, onSuggestion }: { query: string; suggestions?: string[]; onSuggestion?: (s: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center text-center py-12 gap-4"
    >
      <IllustrationWrapper color="#94a3b8" size="md">
        <Search size={44} color="#94a3b8" strokeWidth={1.5} />
      </IllustrationWrapper>
      <div className="max-w-sm space-y-1.5">
        <h3 className="text-lg font-semibold text-foreground">No results found</h3>
        <p className="text-sm text-muted-foreground">
          No results for <span className="font-medium text-foreground">"{query}"</span>
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium">Try:</p>
        <div className="flex flex-wrap justify-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">Check your spelling</span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">Use broader keywords</span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">Try subject name or code</span>
        </div>
        {suggestions && suggestions.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            <span className="text-xs text-muted-foreground">Suggested:</span>
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => onSuggestion?.(s)}
                className="text-xs px-2.5 py-1 rounded-full bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <AppEmptyState
      type="error"
      description={message ?? "We couldn't load this content. Please try again."}
      actions={onRetry ? [{ label: "Try again", primary: true, icon: RefreshCw, onClick: onRetry }] : []}
      size="md"
    />
  );
}

export function CelebrationBanner({ title, description }: { title: string; description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800"
    >
      <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
        <CheckCircle2 size={20} className="text-emerald-600" />
      </div>
      <div>
        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{title}</p>
        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">{description}</p>
      </div>
    </motion.div>
  );
}
