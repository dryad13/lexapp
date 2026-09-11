import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import type { PoolClient } from "pg";
import * as schema from "../shared/schema";
import { buildPoolConfig } from "./pool-config";

export { buildPoolConfig } from "./pool-config";

export type RlsStore = {
  client: PoolClient;
  orgId: number | null;
  bypass: boolean;
};

export const rlsAls = new AsyncLocalStorage<RlsStore>();

export const pool = new pg.Pool(buildPoolConfig());

const fallbackDb = drizzle(pool, { schema });

function activeDb() {
  const store = rlsAls.getStore();
  if (store?.client) {
    return drizzle(store.client, { schema });
  }
  return fallbackDb;
}

export const db = new Proxy(fallbackDb, {
  get(_target, prop, _receiver) {
    const current = activeDb() as unknown as Record<PropertyKey, unknown>;
    const value = current[prop];
    if (typeof value === "function") {
      return value.bind(current);
    }
    return value;
  },
}) as typeof fallbackDb;

export async function withRlsContext<T>(
  opts: { orgId?: number | null; bypass?: boolean },
  fn: () => Promise<T> | T,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (opts.bypass) {
      await client.query("SELECT set_config('app.rls_bypass', 'on', true)");
    }
    if (opts.orgId != null) {
      await client.query("SELECT set_config('app.current_org_id', $1, true)", [String(opts.orgId)]);
    }
    const result = await rlsAls.run(
      { client, orgId: opts.orgId ?? null, bypass: !!opts.bypass },
      fn,
    );
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function withRlsBypass<T>(fn: () => Promise<T> | T): Promise<T> {
  return withRlsContext({ bypass: true }, fn);
}
