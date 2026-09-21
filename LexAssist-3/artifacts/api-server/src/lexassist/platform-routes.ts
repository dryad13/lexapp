import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { eq, and, gte, count, inArray, desc, max, sql, asc } from "drizzle-orm";
import { db, withRlsBypass } from "./db";
import {
  organisations,
  users,
  matters,
  processedStripeEvents,
  auditLogs,
  ORG_STATUSES,
  FIRM_USER_ROLES,
} from "../shared/schema";
import type { OrgStatus } from "../shared/schema";
import { requirePlatformAdmin } from "./auth-guards";
import { storage } from "./storage";
import { provisionOrganisation } from "./provision-organisation";
import { generateTempPassword } from "./password-policy";
import { clearLoginFailures } from "./auth-lockout";

function username(req: Request): string {
  return (req as any).username || "platform";
}

async function orgListRow(org: typeof organisations.$inferSelect) {
  const [userCount] = await db
    .select({ n: count() })
    .from(users)
    .where(eq(users.organisationId, org.id));
  const [matterCount] = await db
    .select({ n: count() })
    .from(matters)
    .where(eq(matters.organisationId, org.id));
  const [loginAgg] = await db
    .select({ last: max(users.lastLoginAt) })
    .from(users)
    .where(eq(users.organisationId, org.id));
  const [matterAgg] = await db
    .select({
      last: sql<Date | null>`max(coalesce(${matters.lastViewedAt}, ${matters.createdAt}))`,
    })
    .from(matters)
    .where(eq(matters.organisationId, org.id));

  return {
    id: org.id,
    name: org.name,
    subscriptionPlan: org.subscriptionPlan,
    status: org.status,
    stripeCustomerId: org.stripeCustomerId,
    stripeSubscriptionId: org.stripeSubscriptionId,
    createdAt: org.createdAt,
    userCount: Number(userCount?.n || 0),
    matterCount: Number(matterCount?.n || 0),
    lastLoginAt: loginAgg?.last ?? null,
    lastMatterAt: matterAgg?.last ?? null,
  };
}

export function registerPlatformRoutes(app: Express) {
  app.get("/api/platform/summary", requirePlatformAdmin, async (_req, res: Response) => {
    try {
      const summary = await withRlsBypass(async () => {
        const firms = await storage.getFirmOrganisations();
        const active = firms.filter((o) => o.status === "active").length;
        const suspended = firms.filter((o) => o.status === "suspended").length;
        const planMix: Record<string, number> = {};
        for (const o of firms) {
          planMix[o.subscriptionPlan] = (planMix[o.subscriptionPlan] || 0) + 1;
        }

        const firmIds = firms.map((o) => o.id);
        let userTotal = 0;
        let mfaEnabled = 0;
        let matterTotal = 0;
        if (firmIds.length > 0) {
          const [u] = await db
            .select({ n: count() })
            .from(users)
            .where(inArray(users.organisationId, firmIds));
          userTotal = Number(u?.n || 0);
          const [mfa] = await db
            .select({ n: count() })
            .from(users)
            .where(and(eq(users.mfaEnabled, true), inArray(users.organisationId, firmIds)));
          mfaEnabled = Number(mfa?.n || 0);
          const [m] = await db
            .select({ n: count() })
            .from(matters)
            .where(inArray(matters.organisationId, firmIds));
          matterTotal = Number(m?.n || 0);
        }

        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const [stripeFails] = await db
          .select({ n: count() })
          .from(processedStripeEvents)
          .where(and(eq(processedStripeEvents.status, "failed"), gte(processedStripeEvents.createdAt, since)));

        return {
          organisationCount: firms.length,
          activeOrganisations: active,
          suspendedOrganisations: suspended,
          planMix,
          userCount: userTotal,
          mfaEnabledUsers: mfaEnabled,
          matterCount: matterTotal,
          stripeWebhookFailures7d: Number(stripeFails?.n || 0),
        };
      });
      res.json(summary);
    } catch (err) {
      console.error("platform summary error:", err);
      res.status(500).json({ error: "Failed to load platform summary" });
    }
  });

  app.get("/api/platform/organisations", requirePlatformAdmin, async (_req, res: Response) => {
    try {
      const rows = await withRlsBypass(async () => {
        const firms = await storage.getFirmOrganisations();
        return Promise.all(firms.map(orgListRow));
      });
      res.json(rows);
    } catch (err) {
      console.error("platform organisations list error:", err);
      res.status(500).json({ error: "Failed to list organisations" });
    }
  });

  app.get("/api/platform/organisations/:id", requirePlatformAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

      const detail = await withRlsBypass(async () => {
        const org = await storage.getOrganisation(id);
        if (!org || org.isPlatform) return null;
        const base = await orgListRow(org);
        const roleRows = await db
          .select({ role: users.role, n: count() })
          .from(users)
          .where(eq(users.organisationId, id))
          .groupBy(users.role);
        const roles: Record<string, number> = {};
        for (const r of roleRows) roles[r.role] = Number(r.n);
        return { ...base, roles };
      });

      if (!detail) return res.status(404).json({ error: "Organisation not found" });
      res.json(detail);
    } catch (err) {
      console.error("platform organisation detail error:", err);
      res.status(500).json({ error: "Failed to load organisation" });
    }
  });

  app.post("/api/platform/organisations", requirePlatformAdmin, async (req: Request, res: Response) => {
    try {
      const { name, adminUser, adminPass, adminDisplay, plan } = req.body || {};
      const result = await withRlsBypass(async () => {
        const provisioned = await provisionOrganisation({
          name,
          adminUser,
          adminPass,
          adminDisplay,
          plan,
        });
        await storage.createAuditLog({
          organisationId: provisioned.organisation.id,
          entityType: "platform",
          entityId: provisioned.organisation.id,
          action: "ORG_CREATED",
          details: `Created org ${provisioned.organisation.name} with admin ${provisioned.admin.username}`,
          performedBy: username(req),
        });
        return provisioned;
      });
      res.status(201).json(result);
    } catch (err: any) {
      const status = err?.status || 500;
      if (status < 500) return res.status(status).json({ error: err.message });
      console.error("platform create org error:", err);
      res.status(500).json({ error: "Failed to create organisation" });
    }
  });

  app.patch("/api/platform/organisations/:id", requirePlatformAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

      const updates: { status?: string; subscriptionPlan?: string } = {};
      if (req.body?.status !== undefined) {
        if (!ORG_STATUSES.includes(req.body.status as OrgStatus)) {
          return res.status(400).json({ error: "status must be active or suspended" });
        }
        updates.status = req.body.status;
      }
      if (req.body?.subscriptionPlan !== undefined) {
        if (req.body.subscriptionPlan !== "basic" && req.body.subscriptionPlan !== "pro") {
          return res.status(400).json({ error: "subscriptionPlan must be basic or pro" });
        }
        updates.subscriptionPlan = req.body.subscriptionPlan;
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const updated = await withRlsBypass(async () => {
        const org = await storage.getOrganisation(id);
        if (!org) return { notFound: true as const };
        if (org.isPlatform) return { forbidden: true as const };

        const row = await storage.updateOrganisation(id, updates);
        await storage.createAuditLog({
          organisationId: id,
          entityType: "platform",
          entityId: id,
          action:
            updates.status === "suspended"
              ? "ORG_SUSPENDED"
              : updates.status === "active"
                ? "ORG_ACTIVATED"
                : "ORG_UPDATED",
          details: JSON.stringify(updates),
          performedBy: username(req),
        });
        return { org: row };
      });

      if ("notFound" in updated) return res.status(404).json({ error: "Organisation not found" });
      if ("forbidden" in updated) return res.status(403).json({ error: "Cannot modify platform organisation" });
      res.json(await withRlsBypass(() => orgListRow(updated.org!)));
    } catch (err) {
      console.error("platform patch org error:", err);
      res.status(500).json({ error: "Failed to update organisation" });
    }
  });

  app.post(
    "/api/platform/organisations/:id/reset-admin-password",
    requirePlatformAdmin,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(String(req.params.id), 10);
        if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

        const result = await withRlsBypass(async () => {
          const org = await storage.getOrganisation(id);
          if (!org || org.isPlatform) return { notFound: true as const };

          const [admin] = await db
            .select()
            .from(users)
            .where(and(eq(users.organisationId, id), eq(users.role, "admin")))
            .orderBy(asc(users.id))
            .limit(1);
          if (!admin) return { noAdmin: true as const };

          const temporaryPassword = generateTempPassword(16);
          const passwordHash = await bcrypt.hash(temporaryPassword, 10);
          await storage.updateUser(admin.id, {
            passwordHash,
            mustChangePassword: true,
          } as any);

          await clearLoginFailures(admin.username, org.name);
          await clearLoginFailures(admin.username);

          await storage.createAuditLog({
            organisationId: id,
            entityType: "platform",
            entityId: id,
            action: "ADMIN_PASSWORD_RESET",
            details: `Reset password for admin ${admin.username}`,
            performedBy: username(req),
          });

          return {
            adminUsername: admin.username,
            temporaryPassword,
          };
        });

        if ("notFound" in result) return res.status(404).json({ error: "Organisation not found" });
        if ("noAdmin" in result) return res.status(404).json({ error: "No admin user for organisation" });
        res.json(result);
      } catch (err) {
        console.error("platform reset admin password error:", err);
        res.status(500).json({ error: "Failed to reset admin password" });
      }
    },
  );

  app.get("/api/platform/audit-logs", requirePlatformAdmin, async (req: Request, res: Response) => {
    try {
      const limitRaw = parseInt(String(req.query.limit || "50"), 10);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
      const organisationId = req.query.organisationId
        ? parseInt(String(req.query.organisationId), 10)
        : undefined;
      const action = req.query.action ? String(req.query.action) : undefined;

      const rows = await withRlsBypass(async () => {
        const conditions = [inArray(auditLogs.entityType, ["platform", "auth"])];
        if (organisationId && Number.isFinite(organisationId)) {
          conditions.push(eq(auditLogs.organisationId, organisationId));
        }
        if (action) {
          conditions.push(eq(auditLogs.action, action));
        }
        const list = await db
          .select({
            id: auditLogs.id,
            organisationId: auditLogs.organisationId,
            entityType: auditLogs.entityType,
            action: auditLogs.action,
            details: auditLogs.details,
            performedBy: auditLogs.performedBy,
            createdAt: auditLogs.createdAt,
          })
          .from(auditLogs)
          .where(and(...conditions))
          .orderBy(desc(auditLogs.createdAt))
          .limit(limit);
        return list;
      });
      res.json(rows);
    } catch (err) {
      console.error("platform audit logs error:", err);
      res.status(500).json({ error: "Failed to load audit logs" });
    }
  });
}

/** Reject platform_admin role on firm user APIs. */
export function assertFirmAssignableRole(role: string | undefined): string | null {
  if (!role) return null;
  if (!(FIRM_USER_ROLES as string[]).includes(role)) {
    return "Invalid role";
  }
  return null;
}
