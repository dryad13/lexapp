/**
 * Vitest global setup: OpenAI mock + API server process.
 */
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { startOpenAIMock } from "./openai-mock.js";
import { apiEnv, ROOT, API_PORT, OPENAI_MOCK_PORT, REDIS_URL } from "./env.js";
import { waitForHealth } from "./api.js";
import type http from "node:http";
import Redis from "ioredis";

const PID_DIR = path.join(ROOT, ".tests-pids");

function writePid(name: string, pid: number) {
  fs.mkdirSync(PID_DIR, { recursive: true });
  fs.writeFileSync(path.join(PID_DIR, `${name}.pid`), String(pid));
}

async function ensureRedisIfRequired() {
  const required = process.env.REQUIRE_REDIS === "1" || process.env.CI === "true";
  if (!required) return;
  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    lazyConnect: true,
  });
  try {
    await client.connect();
    const pong = await client.ping();
    if (pong !== "PONG") throw new Error(`Unexpected PING response: ${pong}`);
    console.log(`[test-setup] Redis OK at ${REDIS_URL}`);
  } catch (err: any) {
    throw new Error(
      `REQUIRE_REDIS=1 but Redis is unavailable at ${REDIS_URL}: ${err?.message || err}. ` +
        `Run: pnpm test:db:up`,
    );
  } finally {
    try {
      client.disconnect();
    } catch {
      /* ignore */
    }
  }
}

let mockServer: http.Server | null = null;
let apiProc: ChildProcess | null = null;

export async function setup() {
  await ensureRedisIfRequired();

  mockServer = await startOpenAIMock(OPENAI_MOCK_PORT);
  console.log(`[test-setup] OpenAI mock on :${OPENAI_MOCK_PORT}`);

  const env = {
    ...apiEnv(),
    REQUIRE_REDIS: process.env.REQUIRE_REDIS || (process.env.CI === "true" ? "1" : ""),
    PATH: `${process.env.HOME}/.local/bin:/usr/local/bin:/opt/homebrew/bin:${process.env.PATH || ""}`,
  };
  // Prefer `node --import tsx` over the `tsx` CLI — the CLI's IPC pipe can fail with EPERM
  // in some CI/agent environments.
  const entry = path.join(ROOT, "artifacts/api-server/src/lexassist/index.ts");
  apiProc = spawn(
    process.execPath,
    ["--import", "tsx", entry],
    {
      cwd: path.join(ROOT, "artifacts/api-server"),
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    },
  );
  if (apiProc.pid) writePid("api", apiProc.pid);

  apiProc.stdout?.on("data", (d) => {
    const s = d.toString();
    if (process.env.TEST_VERBOSE) process.stdout.write(`[api] ${s}`);
  });
  apiProc.stderr?.on("data", (d) => {
    const s = d.toString();
    if (process.env.TEST_VERBOSE) process.stderr.write(`[api:err] ${s}`);
  });

  await waitForHealth(90_000);
  console.log(`[test-setup] API ready on :${API_PORT}`);

  return () => teardown();
}

export async function teardown() {
  if (apiProc?.pid) {
    try {
      process.kill(-apiProc.pid, "SIGTERM");
    } catch {
      try {
        apiProc.kill("SIGTERM");
      } catch {
        /* ignore */
      }
    }
  }
  if (mockServer) {
    await new Promise<void>((resolve) => mockServer!.close(() => resolve()));
    mockServer = null;
  }
  try {
    fs.rmSync(PID_DIR, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

export default setup;
