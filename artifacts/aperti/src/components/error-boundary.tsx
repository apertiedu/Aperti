import { Component, ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const TEAL = "#0D9488";

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; errorInfo: string; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: "" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ errorInfo: info.componentStack?.slice(0, 300) ?? "" });
    console.error("[ErrorBoundary]", error, info);
  }

  reset = () => this.setState({ hasError: false, error: null, errorInfo: "" });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-md w-full bg-card border border-border rounded-2xl shadow-lg p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 20 }}
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "#FEF2F2" }}
          >
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </motion.div>

          <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-6">
            An unexpected error occurred. Your work has been preserved — try refreshing or returning to the dashboard.
          </p>

          {this.state.error?.message && (
            <div className="mb-5 p-3 rounded-lg bg-muted text-left">
              <p className="text-xs font-mono text-muted-foreground break-all">
                {this.state.error.message}
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <Button
              onClick={this.reset}
              className="gap-2 font-medium"
              style={{ background: TEAL, color: "white" }}
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => { this.reset(); window.location.href = "/"; }}
            >
              <Home className="w-4 h-4" />
              Go home
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }
}
