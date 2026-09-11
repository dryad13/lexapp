import type { PoolConfig } from "pg";

export function buildPoolConfig(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  const config: PoolConfig = {
    connectionString: env.DATABASE_URL,
    max: Number(env.PG_POOL_MAX || 10),
    idleTimeoutMillis: Number(env.PG_IDLE_TIMEOUT_MS || 30_000),
    connectionTimeoutMillis: Number(env.PG_CONNECTION_TIMEOUT_MS || 5_000),
  };
  if (env.DATABASE_SSL === "true") {
    config.ssl = {
      rejectUnauthorized: true,
      minVersion: "TLSv1.3",
    } as PoolConfig["ssl"];
  }
  return config;
}
