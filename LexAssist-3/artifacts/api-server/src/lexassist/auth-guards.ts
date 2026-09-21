import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "../shared/schema";
import { ROLE_PERMISSIONS } from "../shared/schema";

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

export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  const role = (req as any).role as UserRole;
  if (role !== "platform_admin" || !ROLE_PERMISSIONS.platform_admin?.canAccessPlatform) {
    return res.status(403).json({ error: "Platform admin required" });
  }
  next();
}

/** Paths platform_admin may call outside /api/platform/*. */
const PLATFORM_ADMIN_ALLOWED = new Set([
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/mfa/setup",
  "/api/auth/mfa/confirm",
  "/api/auth/mfa/verify",
  "/api/auth/change-password",
  "/api/healthz",
  "/api/me/permissions",
]);

/**
 * Lock platform_admin to platform + auth paths; lock firm users out of /api/platform/*.
 */
export function platformAccessGuard(req: Request, res: Response, next: NextFunction) {
  const role = (req as any).role as UserRole | undefined;
  if (!role) return next();

  const path = req.originalUrl.split("?")[0];
  const isPlatformApi = path.startsWith("/api/platform");

  if (role === "platform_admin") {
    if (isPlatformApi || PLATFORM_ADMIN_ALLOWED.has(path)) return next();
    return res.status(403).json({ error: "Platform admin cannot access firm APIs" });
  }

  if (isPlatformApi) {
    return res.status(403).json({ error: "Platform admin required" });
  }
  return next();
}
