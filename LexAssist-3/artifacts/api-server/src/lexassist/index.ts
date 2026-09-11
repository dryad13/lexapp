import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { createServer } from "http";
import bcrypt from "bcryptjs";
import cors from "cors";
import cookieParser from "cookie-parser";
import { requireRole, requirePermission } from "./auth-guards";
import { loginRateLimit, useRedisRateLimit } from "./rate-limit";
import { pingRedis, redisReady } from "./redis";
import { withRlsBypass } from "./db";
import { rlsMiddleware } from "./rls-middleware";
import {
  createSession,
  destroySession,
  sessionMiddleware,
  isPublicApiPath,
} from "./sessions";
import { registerStripeWebhook } from "./stripe-billing";
import { startQueueWorkers } from "./queues";
import { storage } from "./storage";

export { requireRole, requirePermission };

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session-secret-change-me";

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(cookieParser(SESSION_SECRET));

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.set("trust proxy", 1);

app.use(sessionMiddleware);
app.use(rlsMiddleware);

app.use(async (req: Request, _res: Response, next: NextFunction) => {
  if ((req as any).sessionIpChanged && (req as any).username) {
    try {
      await storage.createAuditLog({
        organisationId: (req as any).organisationId,
        entityType: "session",
        action: "IP_CHANGE",
        details: `IP changed from ${(req as any).previousIp || "unknown"} to ${req.ip || "unknown"}`,
        performedBy: (req as any).username,
      });
    } catch (err) {
      console.error("IP change audit failed:", err);
    }
  }
  next();
});

app.post("/api/auth/login", loginRateLimit, async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  try {
    const user = await storage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const sessionId = await createSession(req, res, {
      username: user.username,
      userId: user.id,
      organisationId: user.organisationId,
      role: user.role as any,
      department: user.department || "conveyancing",
      displayName: user.displayName,
    });

    const body: Record<string, unknown> = {
      ok: true,
      username: user.username,
      role: user.role,
      organisationId: user.organisationId,
      displayName: user.displayName,
      department: user.department || "conveyancing",
      userId: user.id,
    };
    if (process.env.APP_ENV === "test") {
      body.token = sessionId;
    }
    return res.json(body);
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed" });
  }
});

app.post("/api/auth/logout", async (req: Request, res: Response) => {
  await destroySession(req, res);
  res.json({ ok: true });
});

app.get("/api/auth/me", (req: Request, res: Response) => {
  if ((req as any).userId) {
    return res.json({
      authenticated: true,
      username: (req as any).username,
      userId: (req as any).userId,
      role: (req as any).role,
      organisationId: (req as any).organisationId,
      department: (req as any).department || "conveyancing",
      displayName: (req as any).displayName,
    });
  }
  return res.status(401).json({ authenticated: false });
});

app.get("/api/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok", redis: redisReady });
});

registerStripeWebhook(app);

app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  if (isPublicApiPath(req)) return next();
  if (!(req as any).userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

const SENSITIVE_FIELDS = new Set(["clientName", "clientEmail", "propertyAddress", "recipient", "client_name", "client_email", "property_address", "password", "passwordHash", "password_hash"]);

function redactSensitive(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return `[Array(${obj.length})]`;
  const redacted: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_FIELDS.has(key)) {
      redacted[key] = "[REDACTED]";
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      redacted[key] = "[...]";
    } else {
      redacted[key] = obj[key];
    }
  }
  return redacted;
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(redactSensitive(capturedJsonResponse))}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const ok = await pingRedis();
    if (!ok && process.env.REQUIRE_REDIS === "1") {
      console.error("REQUIRE_REDIS=1 but Redis is unavailable");
      process.exit(1);
    }
    useRedisRateLimit();
  } catch (err) {
    console.error("Redis ping failed:", err);
    if (process.env.REQUIRE_REDIS === "1") {
      process.exit(1);
    }
  }

  const { initDatabase } = await import("./init-db");
  await initDatabase().catch((err) => console.error("DB init error:", err));

  const { seedDatabase } = await import("./seed");
  await withRlsBypass(async () => {
    await seedDatabase().catch((err) => console.error("Seed error:", err));
    await storage.migrateEncryption().catch((err) => console.error("Encryption migration error:", err));
  });

  const workerRole = process.env.WORKER_ROLE;
  await startQueueWorkers(workerRole || undefined);

  if (workerRole) {
    log(`worker role=${workerRole}`);
    return;
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    const { serveStatic } = await import("./static");
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
