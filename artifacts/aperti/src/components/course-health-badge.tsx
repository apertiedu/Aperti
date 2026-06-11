import { useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Activity } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface HealthData {
  score: number | null;
  status: "healthy" | "attention" | "critical" | "no-data";
  color: string;
  label: string;
  issues: string[];
  metrics: {
    attendanceRate: number | null;
    examAvgScore: number | null;
    homeworkCompletionRate: number | null;
    activeStudents: number;
  };
}

interface CourseHealthBadgeProps {
  courseId: number;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export default function CourseHealthBadge({ courseId, showLabel = false, size = "sm" }: CourseHealthBadgeProps) {
  const { data, isLoading } = useQuery<HealthData>({
    queryKey: ["course-health", courseId],
    queryFn: () => apiFetch(`/api/course-health/${courseId}`).then(r => r.ok ? r.json() : null),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return <span className="inline-block h-4 w-4 rounded-full bg-slate-100 animate-pulse flex-shrink-0" />;
  }

  if (!data || data.status === "no-data" || data.metrics.activeStudents === 0) return null;

  const dotSize = size === "sm" ? "w-2.5 h-2.5" : "w-3.5 h-3.5";
  const pulse = data.status === "critical";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1.5 cursor-default flex-shrink-0">
          <span className="relative inline-flex">
            <span
              className={`${dotSize} rounded-full`}
              style={{ background: data.color }}
            />
            {pulse && (
              <span
                className={`${dotSize} rounded-full absolute inset-0 animate-ping opacity-60`}
                style={{ background: data.color }}
              />
            )}
          </span>
          {showLabel && (
            <span className="text-[10px] font-semibold" style={{ color: data.color }}>
              {data.score !== null ? `${data.score}%` : data.label}
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[200px]">
        <div className="space-y-1">
          <p className="font-bold text-xs flex items-center gap-1">
            <Activity className="w-3 h-3" style={{ color: data.color }} />
            Course Health: {data.label}
            {data.score !== null && ` (${data.score}%)`}
          </p>
          {data.metrics.attendanceRate !== null && (
            <p className="text-[10px] text-muted-foreground">Attendance {data.metrics.attendanceRate}%</p>
          )}
          {data.metrics.examAvgScore !== null && (
            <p className="text-[10px] text-muted-foreground">Exam avg {data.metrics.examAvgScore}%</p>
          )}
          {data.metrics.homeworkCompletionRate !== null && (
            <p className="text-[10px] text-muted-foreground">Homework {data.metrics.homeworkCompletionRate}%</p>
          )}
          {data.issues.length > 0 && (
            <div className="pt-1 border-t border-border/50 mt-1 space-y-0.5">
              {data.issues.map((issue, i) => (
                <p key={i} className="text-[10px] text-red-500">{issue}</p>
              ))}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
