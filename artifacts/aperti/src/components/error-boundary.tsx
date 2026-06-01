import { Component } from "react";

export default class ErrorBoundary extends Component<{ children: React.ReactNode }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <div className="min-h-screen flex items-center justify-center">Something went wrong. Please refresh.</div>;
    return this.props.children;
  }
}
