import { pool } from "@workspace/db";

interface RouteStats {
  route: string;
  method: string;
  count: number;
  totalMs: number;
  p95Ms: number;
  maxMs: number;
  lastSlowAt: Date | null;
  samples: number[];
}

const routeMap = new Map<string, RouteStats>();
const MAX_SAMPLES = 200;

export function recordRequest(method: string, route: string, durationMs: number): void {
  const key = `${method}:${route}`;
  let stats = routeMap.get(key);
  if (!stats) {
    stats = { route, method, count: 0, totalMs: 0, p95Ms: 0, maxMs: 0, lastSlowAt: null, samples: [] };
    routeMap.set(key, stats);
  }

  stats.count++;
  stats.totalMs += durationMs;
  if (durationMs > stats.maxMs) stats.maxMs = durationMs;
  if (durationMs > 500) stats.lastSlowAt = new Date();

  stats.samples.push(durationMs);
  if (stats.samples.length > MAX_SAMPLES) stats.samples.shift();

  const sorted = [...stats.samples].sort((a, b) => a - b);
  const p95idx = Math.floor(sorted.length * 0.95);
  stats.p95Ms = sorted[p95idx] ?? durationMs;
}

export function getTopSlowest(n = 10): RouteStats[] {
  return [...routeMap.values()]
    .sort((a, b) => b.p95Ms - a.p95Ms)
    .slice(0, n);
}

export async function flushToDb(): Promise<void> {
  const rows = getTopSlowest(50);
  if (rows.length === 0) return;
  try {
    for (const r of rows) {
      await pool.query(
        `INSERT INTO route_perf_log (route, method, hit_count, avg_ms, p95_ms, max_ms, last_slow_at, recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
         ON CONFLICT (route, method)
         DO UPDATE SET
           hit_count    = route_perf_log.hit_count + EXCLUDED.hit_count,
           avg_ms       = EXCLUDED.avg_ms,
           p95_ms       = EXCLUDED.p95_ms,
           max_ms       = GREATEST(route_perf_log.max_ms, EXCLUDED.max_ms),
           last_slow_at = COALESCE(EXCLUDED.last_slow_at, route_perf_log.last_slow_at),
           recorded_at  = NOW()`,
        [
          r.route.substring(0, 200),
          r.method,
          r.count,
          r.count > 0 ? Math.round(r.totalMs / r.count) : 0,
          r.p95Ms,
          r.maxMs,
          r.lastSlowAt,
        ],
      );
    }
    routeMap.clear();
  } catch {
    // non-fatal
  }
}

export function startPerfFlushInterval(): void {
  setInterval(() => { flushToDb().catch(() => {}); }, 5 * 60 * 1000);
}
