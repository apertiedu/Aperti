/**
 * Redis-backed store for express-rate-limit.
 *
 * Returns a RedisStore when REDIS_URL is configured, undefined otherwise
 * (express-rate-limit will use its default in-memory store as fallback).
 *
 * The store is built once at module load and shared across all rate limiters
 * to reuse a single Redis connection.
 */
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "./redis-client";

function buildStore(): InstanceType<typeof RedisStore> | undefined {
  if (!redisClient) return undefined;
  return new RedisStore({
    // Uses the raw Redis client's sendCommand for compatibility
    sendCommand: (...args: string[]) =>
      (redisClient as any).sendCommand(args),
    prefix: "aperti:rl:",
  });
}

export const rateLimitStore = buildStore();
