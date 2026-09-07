import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { createServer } from "http";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import cors from "cors";
import type { UserRole } from "../shared/schema";
import { ROLE_PERMISSIONS } from "../shared/schema";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.set("trust proxy", 1);

interface SessionData {
  username: string;
  userId: number;
  organisationId: number;
  role: UserRole;
  department: string;
  expiresAt: number;
}

const activeSessions = new Map<string, SessionData>();

const SESSION_DURATION = 60 * 60 * 1000;

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (session.expiresAt < now) {
      activeSessions.delete(token);
    }
  }
}

setInterval(cleanExpiredSessions, 5 * 60 * 1000);

function getSessionFromRequest(req: Request): SessionData | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const session = activeSessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    activeSessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_DURATION;
  return session;
}

app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  try {
    const { storage } = await import("./storage");
    const user = await storage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = crypto.randomBytes(48).toString("hex");
    activeSessions.set(token, {
      username: user.username,
      userId: user.id,
      organisationId: user.organisationId,
      role: user.role as UserRole,
      department: user.department || "conveyancing",
      expiresAt: Date.now() + SESSION_DURATION,
    });

    return res.json({
      ok: true,
      username: user.username,
      token,
      role: user.role,
      organisationId: user.organisationId,
      displayName: user.displayName,
      department: user.department || "conveyancing",
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed" });
  }
});

app.post("/api/auth/logout", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    activeSessions.delete(authHeader.slice(7));
  }
  res.json({ ok: true });
});

app.get("/api/auth/me", (req: Request, res: Response) => {
  const session = getSessionFromRequest(req);
  if (session) {
    return res.json({
      authenticated: true,
      username: session.username,
      userId: session.userId,
      role: session.role,
      organisationId: session.organisationId,
      department: session.department || "conveyancing",
    });
  }
  return res.status(401).json({ authenticated: false });
});

// Unauthenticated health for Render / load balancers
app.get("/api/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/auth/")) return next();
  if (req.path === "/healthz") return next();
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  (req as any).username = session.username;
  (req as any).userId = session.userId;
  (req as any).organisationId = session.organisationId;
  (req as any).role = session.role;
  (req as any).department = session.department;
  next();
});

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = (req as any).role as UserRole;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

export function requirePermission(permission: keyof typeof ROLE_PERMISSIONS["admin"]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = (req as any).role as UserRole;
    if (!role || !ROLE_PERMISSIONS[role]?.[permission]) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

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
  const { initDatabase } = await import("./init-db");
  await initDatabase().catch((err) => console.error("DB init error:", err));

  const { seedDatabase } = await import("./seed");
  await seedDatabase().catch((err) => console.error("Seed error:", err));

  const { storage } = await import("./storage");
  await storage.migrateEncryption().catch((err) => console.error("Encryption migration error:", err));

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
