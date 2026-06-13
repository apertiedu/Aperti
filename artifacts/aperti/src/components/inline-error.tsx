import { AlertTriangle, RefreshCw } from "lucide-react";

interface InlineErrorProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

export function InlineError({
  message = "Something went wrong. Please try again.",
  onRetry,
  className = "",
  compact = false,
}: InlineErrorProps) {
  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-sm text-red-600 ${className}`}>
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="flex-1">{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="shrink-0 flex items-center gap-1 text-xs text-teal-600 font-medium hover:text-teal-700 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center min-h-[180px] ${className}`}>
      <div className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center mb-3">
        <AlertTriangle className="w-5 h-5 text-red-400" />
      </div>
      <p className="text-sm font-medium text-gray-700 mb-1">Failed to load</p>
      <p className="text-xs text-gray-500 mb-4 max-w-xs leading-relaxed">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 active:scale-95 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </button>
      )}
    </div>
  );
}
