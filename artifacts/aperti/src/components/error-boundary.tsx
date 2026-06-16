import { Component, ReactNode } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Home, Bug, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";


interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; errorInfo: string; reported: boolean; }

function logErrorToBackend(error: Error, componentStack: string) {
  try {
    const payload = {
      message: error.message,
      stack: error.stack,
      componentStack,
      route: window.location.pathname,
      browserInfo: navigator.userAgent.slice(0, 300),
      source: "ErrorBoundary",
    };
    fetch("/api/errors/log", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
    fetch("/api/founder/frontend-errors", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {}
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: "", reported: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const componentStack = info.componentStack?.slice(0, 800) ?? "";
    this.setState({ errorInfo: componentStack });
    logErrorToBackend(error, componentStack);
  }

  reset = () => this.setState({ hasError: false, error: null, errorInfo: "", reported: false });

  report = () => {
    this.setState({ reported: true });
    logErrorToBackend(
      this.state.error ?? new Error("User-reported error"),
      this.state.errorInfo
    );
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-sm w-full bg-card border border-border rounded-2xl shadow-md p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 22 }}
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 bg-primary/10"
          >
            <Wifi className="w-7 h-7 text-primary" />
          </motion.div>

          <h2 className="text-lg font-bold text-foreground mb-1">We hit a small snag</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Something didn't load correctly. Your work is safe — please try again.
          </p>

          <div className="flex flex-col gap-2">
            <Button
              onClick={this.reset}
              className="w-full gap-2 font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => { this.reset(); window.location.href = "/"; }}
            >
              <Home className="w-4 h-4" />
              Go to dashboard
            </Button>
            <Button
              variant="ghost"
              className="w-full gap-2 text-slate-400 text-xs"
              onClick={this.report}
              disabled={this.state.reported}
            >
              <Bug className="w-3.5 h-3.5" />
              {this.state.reported ? "Problem reported — thank you" : "Report this problem"}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }
}
