import { redis } from "./redis";
import { pool } from "@workspace/db";

/**
 * Typed cache helper — wraps redis with getOrSet and invalidate patterns.
 */

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

export async function cacheGetOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 300,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const fresh = await fetcher();
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}

export async function cacheDel(key: string): Promise<void> {
  await redis.del(key);
}

export async function cacheInvalidatePattern(keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => redis.del(k)));
}

// TTL constants (seconds)
export const TTL = {
  REALTIME:          30,    // live dashboards, active sessions
  DASHBOARD:         60,    // teacher / student dashboards
  GRADEBOOK:         20,    // gradebook matrix — short to feel responsive
  COURSES:          300,    // course listings
  SUBJECTS:         300,    // reference: subject list per teacher
  PLANS:            600,    // subscription plan catalogue (changes rarely)
  STUDENTS:          30,    // student list per teacher (hot, but must refresh fast)
  ANALYTICS:        120,    // analytics aggregations
  PAST_PAPERS:     3600,    // past paper vault
  LONG:            3600,    // rarely-changing reference data
  REFERENCE_DATA:   900,    // global read-only config: currencies, grade scales, etc.
} as const;

// ── Reference data helpers ────────────────────────────────────────────────────

/**
 * Subscription plans — cached globally (no tenant scope: plans are public).
 * Invalidate on admin plan update.
 */
export async function getCachedPlans(): Promise<any[]> {
  return cacheGetOrSet("ref:subscription_plans", async () => {
    const { rows } = await pool.query(`
      SELECT id, name, price_egp, features, limits, type, sort_order, is_active
      FROM subscription_plans
      WHERE is_active = TRUE
      ORDER BY sort_order ASC, price_egp ASC
    `);
    return rows;
  }, TTL.PLANS);
}

/**
 * Subjects per teacher — cached per-tenant.
 * Invalidate on subject create/update/delete.
 */
export async function getCachedSubjects(teacherId: number | null, isAdmin: boolean): Promise<any[]> {
  const key = `ref:subjects:t${teacherId ?? "admin"}`;
  return cacheGetOrSet(key, async () => {
    const params: any[] = [];
    let cond = "";
    if (!isAdmin && teacherId) {
      params.push(teacherId);
      cond = `WHERE teacher_account_id = $1`;
    }
    const { rows } = await pool.query(
      `SELECT id, name FROM subjects ${cond} ORDER BY name`,
      params,
    );
    return rows;
  }, TTL.SUBJECTS);
}

/**
 * Active students per teacher — used by gradebook, check-in, reports.
 * Invalidate when student status changes.
 */
export async function getCachedStudents(teacherId: number | null, isAdmin: boolean): Promise<any[]> {
  const key = `ref:students:t${teacherId ?? "admin"}`;
  return cacheGetOrSet(key, async () => {
    const params: any[] = [];
    let cond = "";
    if (!isAdmin && teacherId) {
      params.push(teacherId);
      cond = `AND teacher_account_id = $1`;
    }
    const { rows } = await pool.query(
      `SELECT id, student_name AS "studentName", student_code AS "studentCode", status
       FROM students
       WHERE status = 'active' ${cond}
       ORDER BY student_name`,
      params,
    );
    return rows;
  }, TTL.STUDENTS);
}

/** Invalidate all cached reference data for a teacher */
export async function invalidateTeacherRefCache(teacherId: number | null): Promise<void> {
  await Promise.all([
    cacheDel(`ref:subjects:t${teacherId ?? "admin"}`),
    cacheDel(`ref:students:t${teacherId ?? "admin"}`),
  ]).catch(() => {});
}

/** Invalidate global plan cache (call after admin edits plans) */
export async function invalidatePlanCache(): Promise<void> {
  await cacheDel("ref:subscription_plans").catch(() => {});
}
