/**
 * In-memory Redis stub.
 * Satisfies the same interface as ioredis for simple get/set/del with TTL.
 * Replace with a real Redis client when a Redis instance is available.
 */

interface Entry {
  value: string;
  expiresAt: number | null;
}

const store = new Map<string, Entry>();

function isExpired(entry: Entry): boolean {
  return entry.expiresAt !== null && Date.now() > entry.expiresAt;
}

export const redis = {
  async get(key: string): Promise<string | null> {
    const entry = store.get(key);
    if (!entry) return null;
    if (isExpired(entry)) {
      store.delete(key);
      return null;
    }
    return entry.value;
  },

  async set(key: string, value: string, mode?: string, ttlSeconds?: number): Promise<void> {
    const expiresAt =
      mode?.toUpperCase() === "EX" && ttlSeconds
        ? Date.now() + ttlSeconds * 1000
        : null;
    store.set(key, { value, expiresAt });
  },

  async del(key: string): Promise<void> {
    store.delete(key);
  },

  async exists(key: string): Promise<boolean> {
    const entry = store.get(key);
    if (!entry) return false;
    if (isExpired(entry)) {
      store.delete(key);
      return false;
    }
    return true;
  },
};
