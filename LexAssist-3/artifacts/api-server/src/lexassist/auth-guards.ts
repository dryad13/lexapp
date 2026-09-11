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
