import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { createServer } from "http";
import bcrypt from "bcryptjs";
import cors from "cors";
import cookieParser from "cookie-parser";
import { requireRole, requirePermission, platformAccessGuard } from "./auth-guards";
import { loginRateLimit, useRedisRateLimit } from "./rate-limit";
import { pingRedis, redisReady } from "./redis";
import { withRlsBypass } from "./db";
import { rlsMiddleware } from "./rls-middleware";
import {
  createSession,
  destroySession,
  sessionMiddleware,
  isPublicApiPath,
  mfaSetupGuard,
  mustChangePasswordGuard,
} from "./sessions";
import { registerStripeWebhook } from "./stripe-billing";
import { startQueueWorkers } from "./queues";
import { storage } from "./storage";
import {
  assertProductionCorsConfig,
  buildCorsOptions,
  securityHeaders,
} from "./http-security";
import {
  clearLoginFailures,
  isLoginLocked,
  recordLoginFailure,
} from "./auth-lockout";
import { validatePassword } from "./password-policy";
import {
  beginMfaEnrollment,
  checkTotp,
  consumePendingMfaToken,
  createPendingMfaToken,
  encryptMfaSecret,
  hashBackupCode,
  mfaRequiredForAdmins,
  mfaRequiredForPlatformAdmin,
  peekPendingMfaToken,
} from "./mfa";

export { requireRole, requirePermission };

async function writeAuthAudit(
  action: string,
  opts: { organisationId?: number | null; performedBy: string; details?: string },
) {
  try {
    await storage.createAuditLog({
      organisationId: opts.organisationId ?? undefined,
      entityType: "auth",
      action,
      details: opts.details,
      performedBy: opts.performedBy,
    });
  } catch (err) {
    console.error("Auth audit write failed:", err);
  }
}

async function markLoginSuccess(userId: number, organisationId: number, username: string) {
  await storage.updateUser(userId, { lastLoginAt: new Date() } as any);
  await writeAuthAudit("LOGIN_SUCCESS", {
    organisationId,
    performedBy: username,
  });
}

function sessionBody(
  user: {
    username: string;
    role: string;
    organisationId: number;
    displayName: string;
    department?: string | null;
    id: number;
  },
  sessionId: string,
  extra: Record<string, unknown> = {},
) {
  const body: Record<string, unknown> = {
    ok: true,
    username: user.username,
    role: user.role,
    organisationId: user.organisationId,
    displayName: user.displayName,
    department: user.department || "conveyancing",
    userId: user.id,
    ...extra,
  };
  if (process.env.APP_ENV === "test") body.token = sessionId;
  return body;
}

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session-secret-change-me";

try {
  assertProductionCorsConfig();
} catch (err) {
  console.error(err);
  if (process.env.NODE_ENV === "production" && process.env.APP_ENV !== "test") {
    process.exit(1);
  }
}

app.use(securityHeaders());
app.use(cors(buildCorsOptions()));

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
  const { username, password, organisation } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const orgHint = organisation ? String(organisation) : undefined;

  try {
    if (await isLoginLocked(username, orgHint)) {
      return res.status(423).json({ error: "Account temporarily locked. Try again later." });
    }

    let user;
    if (organisation && String(organisation).trim()) {
      const org = await storage.getOrganisationByName(String(organisation));
      if (!org) {
        await recordLoginFailure(username, orgHint);
        return res.status(401).json({ error: "Invalid credentials" });
      }
      user = await storage.getUserByUsernameInOrg(username, org.id);
    } else {
      const matches = await storage.getUsersByUsername(username);
      if (matches.length > 1) {
        return res.status(401).json({ error: "Organisation required for this username" });
      }
      user = matches[0];
    }
    if (!user) {
      await recordLoginFailure(username, orgHint);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const org = await storage.getOrganisation(user.organisationId);
    if (!org) {
      await recordLoginFailure(username, orgHint);
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (org.status === "suspended" && !org.isPlatform) {
      return res.status(403).json({ error: "Organisation suspended", code: "ORG_SUSPENDED" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await recordLoginFailure(username, orgHint);
      await writeAuthAudit("LOGIN_FAILURE", {
        organisationId: user.organisationId,
        performedBy: user.username,
        details: "invalid_password",
      });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await clearLoginFailures(username, orgHint);

    const sessionBase = {
      username: user.username,
      userId: user.id,
      organisationId: user.organisationId,
      role: user.role as any,
      department: user.department || "conveyancing",
      displayName: user.displayName,
    };

    if (user.mfaEnabled && user.mfaSecret) {
      const mfaToken = await createPendingMfaToken({
        ...sessionBase,
        purpose: "verify",
      });
      return res.json({
        ok: true,
        mfaRequired: true,
        mfaToken,
        username: user.username,
      });
    }

    const needsPlatformMfa =
      user.role === "platform_admin" && mfaRequiredForPlatformAdmin() && !user.mfaEnabled;
    const needsAdminMfa =
      user.role === "admin" && mfaRequiredForAdmins() && !user.mfaEnabled;

    if (needsPlatformMfa || needsAdminMfa) {
      const sessionId = await createSession(req, res, {
        ...sessionBase,
        mfaSetupOnly: true,
      });
      return res.json(
        sessionBody(user, sessionId, { mfaSetupRequired: true }),
      );
    }

    if (user.mustChangePassword) {
      const sessionId = await createSession(req, res, {
        ...sessionBase,
        mustChangePasswordOnly: true,
      });
      return res.json(
        sessionBody(user, sessionId, { mustChangePasswordRequired: true }),
      );
    }

    await markLoginSuccess(user.id, user.organisationId, user.username);
    const sessionId = await createSession(req, res, sessionBase);
    return res.json(sessionBody(user, sessionId));
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed" });
  }
});

app.post("/api/auth/mfa/verify", loginRateLimit, async (req: Request, res: Response) => {
  const { mfaToken, code } = req.body || {};
  if (!mfaToken || !code) {
    return res.status(400).json({ error: "mfaToken and code required" });
  }
  try {
    const pending = await peekPendingMfaToken(String(mfaToken));
    if (!pending || pending.purpose !== "verify") {
      return res.status(401).json({ error: "Invalid or expired MFA token" });
    }
    const user = await storage.getUserById(pending.userId);
    if (!user?.mfaEnabled || !user.mfaSecret) {
      return res.status(401).json({ error: "MFA not enabled" });
    }

    let ok = checkTotp(user.mfaSecret, String(code));
    if (!ok && Array.isArray(user.mfaBackupCodes) && user.mfaBackupCodes.length) {
      const hash = hashBackupCode(String(code));
      if (user.mfaBackupCodes.includes(hash)) {
        ok = true;
        await storage.updateUser(user.id, {
          mfaBackupCodes: user.mfaBackupCodes.filter((c) => c !== hash),
        });
      }
    }
    if (!ok) {
      return res.status(401).json({ error: "Invalid MFA code" });
    }

    await consumePendingMfaToken(String(mfaToken));

    const sessionBase = {
      username: pending.username,
      userId: pending.userId,
      organisationId: pending.organisationId,
      role: pending.role as any,
      department: pending.department,
      displayName: pending.displayName,
    };

    if (user.mustChangePassword) {
      const sessionId = await createSession(req, res, {
        ...sessionBase,
        mustChangePasswordOnly: true,
      });
      return res.json(
        sessionBody(
          {
            username: pending.username,
            role: pending.role,
            organisationId: pending.organisationId,
            displayName: pending.displayName,
            department: pending.department,
            id: pending.userId,
          },
          sessionId,
          { mustChangePasswordRequired: true },
        ),
      );
    }

    await markLoginSuccess(pending.userId, pending.organisationId, pending.username);
    const sessionId = await createSession(req, res, sessionBase);
    return res.json(
      sessionBody(
        {
          username: pending.username,
          role: pending.role,
          organisationId: pending.organisationId,
          displayName: pending.displayName,
          department: pending.department,
          id: pending.userId,
        },
        sessionId,
      ),
    );
  } catch (err) {
    console.error("MFA verify error:", err);
    return res.status(500).json({ error: "MFA verification failed" });
  }
});

app.post("/api/auth/mfa/setup", async (req: Request, res: Response) => {
  if (!(req as any).userId) return res.status(401).json({ error: "Not authenticated" });
  try {
    const user = await storage.getUserById((req as any).userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.mfaEnabled) return res.status(400).json({ error: "MFA already enabled" });
    const enrollment = beginMfaEnrollment(user.username);
    (req as any)._mfaEnrollmentSecret = enrollment.secret;
    await storage.updateUser(user.id, {
      mfaSecret: encryptMfaSecret(enrollment.secret),
      mfaEnabled: false,
      mfaBackupCodes: enrollment.backupCodes.map(hashBackupCode),
    });
    return res.json({
      ok: true,
      secret: enrollment.secret,
      otpauthUrl: enrollment.otpauthUrl,
      backupCodes: enrollment.backupCodes,
    });
  } catch (err) {
    console.error("MFA setup error:", err);
    return res.status(500).json({ error: "MFA setup failed" });
  }
});

app.post("/api/auth/mfa/confirm", async (req: Request, res: Response) => {
  if (!(req as any).userId) return res.status(401).json({ error: "Not authenticated" });
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: "code required" });
  try {
    const user = await storage.getUserById((req as any).userId);
    if (!user?.mfaSecret) return res.status(400).json({ error: "Call /api/auth/mfa/setup first" });
    if (!checkTotp(user.mfaSecret, String(code))) {
      return res.status(401).json({ error: "Invalid MFA code" });
    }
    await storage.updateUser(user.id, { mfaEnabled: true });
    await destroySession(req, res);

    const sessionBase = {
      username: user.username,
      userId: user.id,
      organisationId: user.organisationId,
      role: user.role as any,
      department: user.department || "conveyancing",
      displayName: user.displayName,
    };

    if (user.mustChangePassword) {
      const sessionId = await createSession(req, res, {
        ...sessionBase,
        mustChangePasswordOnly: true,
      });
      return res.json(
        sessionBody(user, sessionId, { mfaEnabled: true, mustChangePasswordRequired: true }),
      );
    }

    await markLoginSuccess(user.id, user.organisationId, user.username);
    const sessionId = await createSession(req, res, sessionBase);
    return res.json(sessionBody(user, sessionId, { mfaEnabled: true }));
  } catch (err) {
    console.error("MFA confirm error:", err);
    return res.status(500).json({ error: "MFA confirm failed" });
  }
});

app.post("/api/auth/change-password", async (req: Request, res: Response) => {
  if (!(req as any).userId) return res.status(401).json({ error: "Not authenticated" });
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword required" });
  }
  const pw = validatePassword(String(newPassword));
  if (!pw.ok) return res.status(400).json({ error: pw.error });
  if (String(currentPassword) === String(newPassword)) {
    return res.status(400).json({ error: "New password must differ from current password" });
  }
  try {
    const user = await storage.getUserById((req as any).userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const valid = await bcrypt.compare(String(currentPassword), user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    await storage.updateUser(user.id, {
      passwordHash,
      mustChangePassword: false,
    } as any);

    await writeAuthAudit("PASSWORD_CHANGED", {
      organisationId: user.organisationId,
      performedBy: user.username,
    });

    await destroySession(req, res);
    await markLoginSuccess(user.id, user.organisationId, user.username);
    const sessionId = await createSession(req, res, {
      username: user.username,
      userId: user.id,
      organisationId: user.organisationId,
      role: user.role as any,
      department: user.department || "conveyancing",
      displayName: user.displayName,
    });
    return res.json(sessionBody(user, sessionId, { passwordChanged: true }));
  } catch (err) {
    console.error("Change password error:", err);
    return res.status(500).json({ error: "Failed to change password" });
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
      mfaSetupOnly: !!(req as any).mfaSetupOnly,
      mustChangePasswordOnly: !!(req as any).mustChangePasswordOnly,
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
  return mfaSetupGuard(req, res, (err?: any) => {
    if (err) return next(err);
    return mustChangePasswordGuard(req, res, (err2?: any) => {
      if (err2) return next(err2);
      return platformAccessGuard(req, res, next);
    });
  });
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
  }).catch((err) => console.error("Seed/migration transaction error:", err));

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
