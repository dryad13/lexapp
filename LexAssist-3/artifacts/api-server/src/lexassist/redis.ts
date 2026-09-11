import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

export let redisReady = false;

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: true,
  connectTimeout: 1500,
  retryStrategy(times) {
    if (!redisReady) return null;
    return Math.min(times * 200, 2000);
  },
});

export function bullmqConnection() {
  return {
    url: REDIS_URL,
    maxRetriesPerRequest: null as null,
    lazyConnect: true,
  };
}

export async function pingRedis(): Promise<boolean> {
  try {
    if (redis.status === "wait" || redis.status === "end") {
      await redis.connect();
    }
    await redis.ping();
    redisReady = true;
    return true;
  } catch (err) {
    redisReady = false;
    if (process.env.REQUIRE_REDIS === "1") {
      throw err;
    }
    console.warn("Redis unavailable; using in-memory session/job stores");
    try {
      redis.disconnect();
    } catch {
      /* ignore */
    }
    return false;
  }
}
