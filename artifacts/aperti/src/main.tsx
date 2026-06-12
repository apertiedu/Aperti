import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import ErrorBoundary from "@/components/error-boundary";

// ── Global unhandled error capture ───────────────────────────────────────────
function reportToBackend(payload: Record<string, unknown>) {
  try {
    const token = localStorage.getItem("aperti_token") || "";
    fetch("/api/founder/frontend-errors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ...payload, ts: new Date().toISOString() }),
    }).catch(() => {});
  } catch {}
}

window.addEventListener("error", (e) => {
  if (!e.error) return; // suppress noise from browser extensions
  reportToBackend({
    message: e.message,
    stack: e.error?.stack ?? "",
    componentStack: "",
    route: window.location.pathname,
    browserInfo: navigator.userAgent.slice(0, 300),
    source: "window.error",
    filename: e.filename,
  });
});

window.addEventListener("unhandledrejection", (e) => {
  const err = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
  reportToBackend({
    message: err.message,
    stack: err.stack ?? "",
    componentStack: "",
    route: window.location.pathname,
    browserInfo: navigator.userAgent.slice(0, 300),
    source: "unhandledrejection",
  });
});

// ── Service Worker registration ───────────────────────────────────────────────
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
