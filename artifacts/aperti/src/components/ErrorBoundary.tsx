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
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <h2 className="text-base font-bold text-foreground mb-1">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-5 max-w-sm leading-relaxed">
            This section encountered an unexpected error. The issue has been logged automatically.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 active:scale-95 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
            <button
              onClick={this.handleGoBack}
              className="inline-flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted/80 active:scale-95 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Go back
            </button>
            <button
              onClick={this.handleReport}
              disabled={this.state.reported}
              className="inline-flex items-center gap-2 px-4 py-2 text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted transition-all active:scale-95 disabled:opacity-50"
            >
              <Bug className="w-4 h-4" />
              {this.state.reported ? "Reported" : "Report issue"}
            </button>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <details className="mt-5 text-left max-w-lg w-full">
              <summary className="text-xs text-muted-foreground/60 cursor-pointer hover:text-muted-foreground">Error details (dev only)</summary>
              <pre className="mt-2 text-xs text-destructive bg-destructive/8 p-3 rounded-lg overflow-auto max-h-48">
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
