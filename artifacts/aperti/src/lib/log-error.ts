export function logError(
  error: Error | unknown,
  context: {
    route?: string;
    component?: string;
    userId?: number | null;
    extra?: Record<string, unknown>;
  } = {},
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error("[logError]", err.message, context);

  const payload = {
    message: err.message?.slice(0, 1000),
    stack: err.stack?.slice(0, 3000),
    route: context.route ?? (typeof window !== "undefined" ? window.location.pathname : "unknown"),
    component: context.component ?? "unknown",
    extra: context.extra,
    source: "frontend",
    browserInfo: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : "unknown",
  };

  fetch("/api/errors/log", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
