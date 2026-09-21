import { rateLimit, MemoryStore } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis, redisReady } from "./redis";

const memoryStore = new MemoryStore();
let redisStore: RedisStore | null = null;

export function useRedisRateLimit() {
  if (!redisReady) return;
  redisStore = new RedisStore({
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as any,
  });
}

const dualStore = {
  async increment(key: string) {
    return (redisStore ?? memoryStore).increment(key);
  },
  async decrement(key: string) {
    const store = redisStore ?? memoryStore;
    if (store.decrement) return store.decrement(key);
  },
  async resetKey(key: string) {
    return (redisStore ?? memoryStore).resetKey(key);
  },
};

export const loginRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  // In APP_ENV=test, skip by default so lockout suites can exceed 5 attempts.
  // Opt in with header X-Test-Enable-Rate-Limit: 1 (see rate-limit.spec.ts).
  skip: (req) =>
    process.env.APP_ENV === "test" && req.get("x-test-enable-rate-limit") !== "1",
  store: dualStore as any,
  handler: (_req, res) => {
    res.status(429).json({ error: "Too many login attempts. Try again in a minute." });
  },
});
