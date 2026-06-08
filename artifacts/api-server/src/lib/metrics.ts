import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from "prom-client";

export const register = new Registry();

collectDefaultMetrics({ register });

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

export const dbQueryDuration = new Histogram({
  name: "db_query_duration_seconds",
  help: "Database query duration in seconds",
  labelNames: ["operation"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

export const activeUsers = new Gauge({
  name: "active_users_total",
  help: "Number of active user sessions",
  registers: [register],
});

export const aiCallDuration = new Histogram({
  name: "ai_call_duration_seconds",
  help: "AI API call duration in seconds",
  labelNames: ["provider", "model"],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30],
  registers: [register],
});

export const cacheHitRate = new Gauge({
  name: "cache_hit_rate_percent",
  help: "Cache hit rate percentage",
  registers: [register],
});

export const errorTotal = new Counter({
  name: "errors_total",
  help: "Total application errors",
  labelNames: ["type"],
  registers: [register],
});

/** Express middleware that records HTTP metrics per request. */
export function metricsMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    res.on("finish", () => {
      const route = req.route?.path ?? req.path ?? "unknown";
      const duration = (Date.now() - start) / 1000;
      const labels = { method: req.method, route, status_code: String(res.statusCode) };
      httpRequestDuration.observe(labels, duration);
      httpRequestTotal.inc(labels);
    });
    next();
  };
}
