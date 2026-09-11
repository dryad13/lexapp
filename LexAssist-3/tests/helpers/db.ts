import pg from "pg";
import { DATABASE_URL } from "./env.js";

export async function withTestDb<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('app.rls_bypass', 'on', false)");
    return await fn(client);
  } finally {
    client.release();
    await pool.end();
  }
}
