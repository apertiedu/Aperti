import { pool } from "@workspace/db";

export async function logError(
  error: Error | unknown,
  context: {
    route?: string;
    method?: string;
    userId?: number | null;
    details?: Record<string, unknown>;
  } = {},
): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));
  const message = (err.message ?? "unknown").slice(0, 1000);
  const stack = (err.stack ?? "").slice(0, 5000);
  const route = context.route ?? "unknown";
  const device = context.method ? `${context.method} ${route}` : route;

  try {
    await pool.query(
      `INSERT INTO error_logs (level, message, stack, route, device, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      ["error", message, stack, route, device],
    );
  } catch {
    console.error("[logError] Failed to persist to DB:", message);
  }
}
