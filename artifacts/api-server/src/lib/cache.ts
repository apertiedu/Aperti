import { redis } from "./redis";

/**
 * Typed cache helper – wraps redis with getOrSet, invalidate patterns.
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
  REALTIME: 30,
  DASHBOARD: 60,
  COURSES: 300,
  PAST_PAPERS: 3600,
  ANALYTICS: 120,
  LONG: 3600,
} as const;
