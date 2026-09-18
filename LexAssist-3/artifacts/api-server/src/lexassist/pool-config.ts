import type { PoolConfig } from "pg";

export function buildPoolConfig(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  const config: PoolConfig = {
    connectionString: env.DATABASE_URL,
    max: Number(env.PG_POOL_MAX || 10),
    idleTimeoutMillis: Number(env.PG_IDLE_TIMEOUT_MS || 30_000),
    connectionTimeoutMillis: Number(env.PG_CONNECTION_TIMEOUT_MS || 5_000),
  };
  if (env.DATABASE_SSL === "true") {
    // Render (and many managed Postgres hosts) present a cert chain Node does not
    // trust by default. Opt into strict verification with DATABASE_SSL_REJECT_UNAUTHORIZED=true.
    config.ssl = {
      rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true",
    } as PoolConfig["ssl"];
  }
  return config;
}
