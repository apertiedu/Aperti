/**
 * Shared Redis client — used by rate-limit-redis and connect-redis.
 *
 * createClient() is synchronous; connect() is async.
 * By exporting the client before connect() resolves, stores can be
 * constructed synchronously at module load time and will start working
 * once the connection is established (typically < 50 ms on the same host).
 *
 * Falls back gracefully: if REDIS_URL is not set, redisClient stays null
 * and all callers fall back to their in-process alternatives.
 */
import { createClient } from "redis";
import { logger } from "./logger";

export type RedisClientInstance = ReturnType<typeof createClient>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let redisClient: any = null;
export let redisConnected = false;

if (process.env.REDIS_URL) {
  const client = createClient({
    url: process.env.REDIS_URL,
    socket: {
      reconnectStrategy: (retries: number) => {
        if (retries > 10) {
          logger.warn("[redis-client] Too many reconnect attempts — giving up");
          return new Error("Redis reconnect limit reached");
        }
        return Math.min(retries * 100, 3000);
      },
    },
  });

  // Export client immediately so stores can be built synchronously
  redisClient = client;

  client.on("error", (err: Error) => {
    redisConnected = false;
    logger.warn({ err: err.message }, "[redis-client] error");
  });
  client.on("ready", () => {
    redisConnected = true;
    logger.info("[redis-client] connected");
  });
  client.on("reconnecting", () =>
    logger.info("[redis-client] reconnecting…")
  );

  // Non-blocking background connect — does not stall app startup
  client.connect().catch((err: Error) => {
    logger.warn({ err: err.message }, "[redis-client] connect failed — falling back to in-process stores");
    redisClient = null;
  });
}
