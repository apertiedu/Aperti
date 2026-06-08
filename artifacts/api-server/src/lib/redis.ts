/**
 * Redis client with in-memory fallback.
 * When REDIS_URL is set, connects to real Redis.
 * Otherwise uses a lightweight in-memory store.
 */

import { logger } from "./logger";

interface Entry {
  value: string;
  expiresAt: number | null;
}

const memStore = new Map<string, Entry>();

function memIsExpired(entry: Entry): boolean {
  return entry.expiresAt !== null && Date.now() > entry.expiresAt;
}

const memCache = {
  type: "memory" as const,
  isConnected: true,
  hits: 0,
  misses: 0,

  async get(key: string): Promise<string | null> {
    const entry = memStore.get(key);
    if (!entry) { this.misses++; return null; }
    if (memIsExpired(entry)) { memStore.delete(key); this.misses++; return null; }
    this.hits++;
    return entry.value;
  },

  async set(key: string, value: string, mode?: string, ttlSeconds?: number): Promise<void> {
    const expiresAt =
      mode?.toUpperCase() === "EX" && ttlSeconds
        ? Date.now() + ttlSeconds * 1000
        : null;
    memStore.set(key, { value, expiresAt });
  },

  async del(key: string): Promise<void> {
    memStore.delete(key);
  },

  async exists(key: string): Promise<boolean> {
    const entry = memStore.get(key);
    if (!entry) return false;
    if (memIsExpired(entry)) { memStore.delete(key); return false; }
    return true;
  },

  async flush(): Promise<void> {
    memStore.clear();
  },

  getStats() {
    const total = this.hits + this.misses;
    return {
      type: this.type,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? Math.round((this.hits / total) * 100) : 0,
      size: memStore.size,
    };
  },
};

type RedisCacheType = typeof memCache;
let _redis: RedisCacheType = memCache;

if (process.env.REDIS_URL) {
  (async () => {
    try {
      const { createClient } = await import("redis");
      const client = createClient({ url: process.env.REDIS_URL });
      let connected = false;
      let hits = 0;
      let misses = 0;

      client.on("error", (err: Error) => logger.warn({ err }, "Redis error — falling back to memory cache"));
      client.on("ready", () => { connected = true; logger.info("Redis connected"); });
      await client.connect();

      _redis = {
        type: "redis",
        get isConnected() { return connected; },
        get hits() { return hits; },
        get misses() { return misses; },

        async get(key: string): Promise<string | null> {
          if (!connected) return memCache.get(key);
          const val = await client.get(key);
          if (val === null) misses++; else hits++;
          return val;
        },

        async set(key: string, value: string, mode?: string, ttlSeconds?: number): Promise<void> {
          if (!connected) return memCache.set(key, value, mode, ttlSeconds);
          if (mode?.toUpperCase() === "EX" && ttlSeconds) {
            await client.setEx(key, ttlSeconds, value);
          } else {
            await client.set(key, value);
          }
        },

        async del(key: string): Promise<void> {
          if (!connected) return memCache.del(key);
          await client.del(key);
        },

        async exists(key: string): Promise<boolean> {
          if (!connected) return memCache.exists(key);
          const n = await client.exists(key);
          return n > 0;
        },

        async flush(): Promise<void> {
          if (!connected) return memCache.flush();
          await client.flushDb();
        },

        getStats() {
          const total = hits + misses;
          return {
            type: "redis" as const,
            hits,
            misses,
            hitRate: total > 0 ? Math.round((hits / total) * 100) : 0,
            size: -1,
          };
        },
      };
    } catch (err) {
      logger.warn({ err }, "Failed to connect to Redis — using in-memory cache");
    }
  })();
}

export const redis = new Proxy({} as RedisCacheType, {
  get(_target, prop) {
    return (typeof (_redis as any)[prop] === "function")
      ? (...args: any[]) => (_redis as any)[prop](...args)
      : (_redis as any)[prop];
  },
});

export { _redis as redisClient };
