import React, { Component, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Brain, RefreshCw, WifiOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  featureName?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorType: "network" | "timeout" | "quota" | "unknown";
  retrying: boolean;
}

const TEAL = "#0D9488";

export class AIErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorType: "unknown", retrying: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const msg = (error?.message ?? "").toLowerCase();
    let errorType: State["errorType"] = "unknown";
    if (msg.includes("timeout") || msg.includes("timed out")) errorType = "timeout";
    else if (msg.includes("quota") || msg.includes("429") || msg.includes("rate limit")) errorType = "quota";
    else if (msg.includes("network") || msg.includes("failed to fetch") || msg.includes("offline")) errorType = "network";
    return { hasError: true, errorType };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const tok = () => localStorage.getItem("aperti_token") ?? "";
    fetch("/api/ai/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok()}` },
      body: JSON.stringify({
        feature: this.props.featureName ?? "unknown",
        error: error.message?.slice(0, 500),
        stack: info.componentStack?.slice(0, 1000),
      }),
    }).catch(() => {});
  }

  handleRetry = () => {
    this.setState({ retrying: true });
    setTimeout(() => {
      this.setState({ hasError: false, retrying: false });
    }, 800);
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const { errorType } = this.state;

    const messages: Record<State["errorType"], { title: string; desc: string; icon: any }> = {
      timeout: {
        title: "AI is taking longer than expected",
        desc: "The AI response timed out. This is usually temporary — try again in a moment.",
        icon: RefreshCw,
      },
      quota: {
        title: "AI quota temporarily reached",
        desc: "We've hit our AI usage limit for this period. Access will restore shortly.",
        icon: Brain,
      },
      network: {
        title: "Cannot reach AI service",
        desc: "A network issue is preventing AI from responding. Check your connection and retry.",
        icon: WifiOff,
      },
      unknown: {
        title: "AI is temporarily unavailable",
        desc: `${this.props.featureName ? `The ${this.props.featureName} AI feature` : "This AI feature"} encountered an issue. Our team has been notified.`,
        icon: AlertTriangle,
      },
    };

    const { title, desc, icon: Icon } = messages[errorType];

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 text-center"
      >
        <div
          className="h-12 w-12 rounded-2xl flex items-center justify-center"
          style={{ background: `${TEAL}12` }}
        >
          <Icon className="h-6 w-6" style={{ color: TEAL }} />
        </div>
        <div>
          <p className="font-semibold text-sm text-gray-800 mb-1">{title}</p>
          <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">{desc}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={this.handleRetry}
          disabled={this.state.retrying}
          className="gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${this.state.retrying ? "animate-spin" : ""}`} />
          {this.state.retrying ? "Retrying…" : "Try Again"}
        </Button>
      </motion.div>
    );
  }
}

export function withAIErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  featureName?: string,
) {
  return function WrappedWithAI(props: P) {
    return (
      <AIErrorBoundary featureName={featureName}>
        <Component {...props} />
      </AIErrorBoundary>
    );
  };
}
