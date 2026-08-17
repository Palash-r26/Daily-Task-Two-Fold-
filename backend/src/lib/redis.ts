import { Redis } from "ioredis";
import { logger } from "./logger";

const redisUrl = process.env.REDIS_URL;

export const redis = redisUrl
  ? new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      connectTimeout: 5000,
    })
  : null;

if (redis) {
  redis.on("connect", () => {
    logger.info("Connected to Upstash Redis cloud instance.");
  });

  redis.on("error", (err) => {
    logger.warn({ err: err.message }, "Redis connection notice");
  });
}

/**
 * Cache helper to get/set JSON values in Redis with TTL expiration
 */
export const redisCache = {
  async get<T>(key: string): Promise<T | null> {
    if (!redis) return null;
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    if (!redis) return;
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch {
      // Ignore cache write errors silently
    }
  },

  async del(key: string): Promise<void> {
    if (!redis) return;
    try {
      await redis.del(key);
    } catch {
      // Ignore cache delete errors silently
    }
  },
};
