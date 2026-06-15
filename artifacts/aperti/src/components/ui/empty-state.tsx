import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  FileText, MessageSquare, Users, BarChart3, BookOpen, ClipboardList,
  Bell, Search, Star, Calendar, Inbox, Package,
} from "lucide-react";

const PRESET_ICONS: Record<string, ReactNode> = {
  assignments:   <ClipboardList className="w-10 h-10" />,
  messages:      <MessageSquare className="w-10 h-10" />,
  users:         <Users className="w-10 h-10" />,
  analytics:     <BarChart3 className="w-10 h-10" />,
  courses:       <BookOpen className="w-10 h-10" />,
  reports:       <FileText className="w-10 h-10" />,
  notifications: <Bell className="w-10 h-10" />,
  search:        <Search className="w-10 h-10" />,
  reviews:       <Star className="w-10 h-10" />,
  calendar:      <Calendar className="w-10 h-10" />,
  inbox:         <Inbox className="w-10 h-10" />,
  packages:      <Package className="w-10 h-10" />,
};

interface EmptyStateProps {
  icon?: ReactNode | keyof typeof PRESET_ICONS;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  const resolvedIcon = typeof icon === "string" ? PRESET_ICONS[icon] : icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "flex flex-col items-center justify-center text-center empty-bg rounded-2xl",
        compact ? "py-12 px-6" : "py-20 px-8",
        className,
      )}
    >
      {resolvedIcon && (
        <div className="mb-4 text-gray-300 opacity-70">
          {resolvedIcon}
        </div>
      )}
      <h3 className={cn("font-semibold text-gray-600", compact ? "text-sm" : "text-base")}>
        {title}
      </h3>
      {description && (
        <p className={cn("text-gray-400 leading-relaxed max-w-xs mt-1.5", compact ? "text-xs" : "text-sm")}>
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

interface TableEmptyStateProps {
  cols: number;
  icon?: ReactNode | keyof typeof PRESET_ICONS;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function TableEmptyRow({ cols, icon, title, description, action }: TableEmptyStateProps) {
  return (
    <tr>
      <td colSpan={cols} className="py-0">
        <EmptyState icon={icon} title={title} description={description} action={action} compact />
      </td>
    </tr>
  );
}
