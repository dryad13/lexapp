import { rateLimit, MemoryStore } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis, redisReady } from "./redis";

function isLoopback(ip: string | undefined) {
  if (!ip) return false;
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

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
  skip: (req) => process.env.APP_ENV === "test" && isLoopback(req.ip),
  store: dualStore as any,
  handler: (_req, res) => {
    res.status(429).json({ error: "Too many login attempts. Try again in a minute." });
  },
});
