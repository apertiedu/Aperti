import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft, Bug } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  reported: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, reported: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    fetch("/api/founder/frontend-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        source: "react-error-boundary",
      }),
    }).catch(() => {});

    if (this.props.onError) {
      this.props.onError(error, info);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, reported: false });
  };

  handleGoBack = () => {
    window.history.back();
  };

  handleReport = () => {
    this.setState({ reported: true });
    fetch("/api/founder/frontend-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: this.state.error?.message ?? "User-reported error",
        stack: this.state.error?.stack ?? "",
        url: window.location.href,
        timestamp: new Date().toISOString(),
        source: "user-report",
        userInitiated: true,
      }),
    }).catch(() => {});
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center min-h-[320px] p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-base font-bold text-gray-900 mb-1">Something went wrong</h2>
          <p className="text-sm text-gray-500 mb-5 max-w-sm leading-relaxed">
            This section encountered an unexpected error. The issue has been logged automatically.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 active:scale-95 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
            <button
              onClick={this.handleGoBack}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 active:scale-95 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Go back
            </button>
            <button
              onClick={this.handleReport}
              disabled={this.state.reported}
              className="flex items-center gap-2 px-4 py-2 text-gray-500 rounded-lg text-sm font-medium hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-50"
            >
              <Bug className="w-4 h-4" />
              {this.state.reported ? "Reported" : "Report issue"}
            </button>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <details className="mt-5 text-left max-w-lg w-full">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">Error details (dev only)</summary>
              <pre className="mt-2 text-xs text-red-600 bg-red-50 p-3 rounded-lg overflow-auto max-h-48">
                {this.state.error.message}
                {"\n"}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
