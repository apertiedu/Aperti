import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface ContentQualityBadgeProps {
  score: number;
  showDetails?: boolean;
  size?: "sm" | "md";
}

const THRESHOLDS = {
  excellent: 85,
  good: 65,
  fair: 40,
};

function getLevel(score: number) {
  if (score >= THRESHOLDS.excellent) return { label: "Excellent", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 };
  if (score >= THRESHOLDS.good) return { label: "Good", color: "bg-primary/10 text-primary border-primary/20", icon: CheckCircle2 };
  if (score >= THRESHOLDS.fair) return { label: "Fair", color: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle };
  return { label: "Needs Work", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle };
}

export function computeContentQuality(content: {
  title?: string;
  description?: string;
  hasObjectives?: boolean;
  hasResources?: boolean;
  questionCount?: number;
  topicCount?: number;
  hasTimeline?: boolean;
}): number {
  let score = 0;
  if (content.title && content.title.trim().length >= 5) score += 20;
  if (content.description && content.description.trim().length >= 30) score += 20;
  if (content.hasObjectives) score += 20;
  if (content.hasResources) score += 15;
  if ((content.questionCount ?? 0) >= 3) score += 15;
  if ((content.topicCount ?? 0) >= 2) score += 10;
  if (content.hasTimeline) score += 10; // Would exceed 100, but clamp
  return Math.min(score, 100);
}

export default function ContentQualityBadge({ score, showDetails = false, size = "sm" }: ContentQualityBadgeProps) {
  const level = getLevel(score);
  const Icon = level.icon;
  const ringSize = size === "sm" ? 24 : 36;
  const strokeWidth = size === "sm" ? 3 : 4;
  const radius = (ringSize / 2) - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="flex items-center gap-1.5">
      <div className={`relative flex items-center justify-center`} style={{ width: ringSize, height: ringSize }}>
        <svg width={ringSize} height={ringSize} className="-rotate-90">
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-border"
          />
          <motion.circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            stroke={score >= 65 ? "hsl(var(--primary))" : score >= 40 ? "#f59e0b" : "#ef4444"}
            strokeDasharray={circumference}
          />
        </svg>
        <span className={`absolute text-[8px] font-black ${score >= 65 ? "text-primary" : score >= 40 ? "text-amber-700" : "text-red-600"}`}>
          {score}
        </span>
      </div>
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${level.color}`}>
        {level.label}
      </span>
    </div>
  );
}
