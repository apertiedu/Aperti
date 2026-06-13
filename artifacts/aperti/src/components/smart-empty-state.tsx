import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  BookOpen, Plus, Upload, FileQuestion, Users, Download,
  Sparkles, GraduationCap, LayoutTemplate, Inbox, MessageSquare,
  Calendar, BarChart3, FileText
} from "lucide-react";

interface Action {
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
}

interface SmartEmptyStateProps {
  type:
    | "courses" | "questions" | "students" | "assessments"
    | "flashcards" | "homework" | "messages" | "sessions"
    | "results" | "attendance" | "notes" | "generic";
  title?: string;
  description?: string;
  actions?: Action[];
  className?: string;
}

const PRESETS: Record<string, {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  description: string;
  actions: Action[];
  color: string;
}> = {
  courses: {
    icon: BookOpen,
    color: "#0D9488",
    title: "No courses yet",
    description: "Create your first course to start teaching and enrolling students.",
    actions: [
      { label: "Create Course", icon: Plus, href: "/my-courses", primary: true },
      { label: "View Templates", icon: LayoutTemplate, href: "/resources" },
    ],
  },
  questions: {
    icon: FileQuestion,
    color: "#7c3aed",
    title: "No questions yet",
    description: "Build your question bank to create powerful assessments.",
    actions: [
      { label: "Add Question", icon: Plus, href: "/question-bank", primary: true },
      { label: "Generate with AI", icon: Sparkles, href: "/tutorcraft" },
      { label: "Import Questions", icon: Upload, href: "/question-bank" },
    ],
  },
  students: {
    icon: GraduationCap,
    color: "#0ea5e9",
    title: "No students enrolled",
    description: "Invite students to your course or approve pending enrollment requests.",
    actions: [
      { label: "View Enrollments", icon: UserCheck, href: "/my-courses", primary: true },
      { label: "Import from CSV", icon: Upload, href: "/students" },
    ],
  },
  assessments: {
    icon: FileText,
    color: "#f59e0b",
    title: "No assessments yet",
    description: "Create an assessment to test your students' knowledge.",
    actions: [
      { label: "Create Assessment", icon: Plus, href: "/assessment-hub", primary: true },
      { label: "Browse Question Bank", icon: FileQuestion, href: "/question-bank" },
    ],
  },
  flashcards: {
    icon: Sparkles,
    color: "#ec4899",
    title: "No flashcards yet",
    description: "Create flashcard sets to help you memorize and revise effectively.",
    actions: [
      { label: "Create Flashcard", icon: Plus, href: "/flashcards", primary: true },
      { label: "AI Generate", icon: Sparkles, href: "/tutorcraft" },
    ],
  },
  homework: {
    icon: BarChart3,
    color: "#0D9488",
    title: "No homework assigned",
    description: "Assign homework to keep students engaged between sessions.",
    actions: [
      { label: "Assign Homework", icon: Plus, href: "/plan-grid", primary: true },
    ],
  },
  messages: {
    icon: MessageSquare,
    color: "#6366f1",
    title: "No messages",
    description: "Your inbox is empty. Start a conversation with a teacher or student.",
    actions: [
      { label: "New Message", icon: Plus, href: "/messages", primary: true },
    ],
  },
  sessions: {
    icon: Calendar,
    color: "#0D9488",
    title: "No sessions scheduled",
    description: "Schedule sessions to set your weekly teaching timetable.",
    actions: [
      { label: "Schedule Session", icon: Plus, href: "/sessions", primary: true },
    ],
  },
  results: {
    icon: BarChart3,
    color: "#0D9488",
    title: "No results yet",
    description: "Results will appear here after students complete assessments.",
    actions: [
      { label: "View Assessments", icon: FileText, href: "/exams", primary: true },
    ],
  },
  attendance: {
    icon: Calendar,
    color: "#0D9488",
    title: "No attendance records",
    description: "Start marking attendance for your sessions to track student presence.",
    actions: [
      { label: "Mark Attendance", icon: Plus, href: "/attendance", primary: true },
    ],
  },
  notes: {
    icon: FileText,
    color: "#0D9488",
    title: "No notes yet",
    description: "Add revision notes to help students study key topics.",
    actions: [
      { label: "Add Note", icon: Plus, href: "/revision-notes", primary: true },
    ],
  },
  generic: {
    icon: Inbox,
    color: "#94a3b8",
    title: "Nothing here yet",
    description: "Get started by adding your first item.",
    actions: [],
  },
};

function UserCheck(props: { className?: string }) {
  return <Users {...props} />;
}

export default function SmartEmptyState({
  type,
  title,
  description,
  actions,
  className = "",
}: SmartEmptyStateProps) {
  const preset = PRESETS[type] || PRESETS.generic;
  const Icon = preset.icon;
  const displayTitle = title || preset.title;
  const displayDesc = description || preset.description;
  const displayActions = actions || preset.actions;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`flex flex-col items-center justify-center py-14 px-6 text-center ${className}`}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 280, damping: 24 }}
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-sm"
        style={{ background: `${preset.color}15`, border: `1.5px solid ${preset.color}25` }}
      >
        <Icon className="w-7 h-7" style={{ color: preset.color }} />
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="text-base font-bold text-foreground mb-2"
      >
        {displayTitle}
      </motion.h3>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-sm text-muted-foreground max-w-xs mb-6 leading-relaxed"
      >
        {displayDesc}
      </motion.p>

      {displayActions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {displayActions.map((action, i) => {
            const ActionIcon = action.icon;
            const btn = (
              <motion.button
                key={i}
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={action.onClick}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  action.primary
                    ? "text-white shadow-sm"
                    : "bg-white border border-border text-foreground hover:bg-muted"
                }`}
                style={action.primary ? { background: preset.color } : {}}
              >
                <ActionIcon className="w-3.5 h-3.5" />
                {action.label}
              </motion.button>
            );
            return action.href ? (
              <Link key={i} href={action.href}>{btn}</Link>
            ) : btn;
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
