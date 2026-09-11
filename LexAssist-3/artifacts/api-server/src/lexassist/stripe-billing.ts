import Stripe from "stripe";
import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, pool } from "./db";
import { organisations, processedStripeEvents } from "../shared/schema";
import { storage } from "./storage";
import { requireRole } from "./auth-guards";
import { enqueueBillingEvent, waitForTestJob } from "./queues";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_not_configured");
}

function planFromStripeObject(obj: any): string | null {
  const fromItem = obj?.items?.data?.[0]?.price?.metadata?.plan
    || obj?.items?.data?.[0]?.plan?.metadata?.plan
    || obj?.plan?.metadata?.plan
    || obj?.metadata?.plan;
  if (typeof fromItem === "string" && fromItem) return fromItem;
  return null;
}

function orgIdFromStripeObject(obj: any): number | null {
  const raw = obj?.metadata?.organisationId ?? obj?.metadata?.organisation_id;
  if (raw == null || raw === "") return null;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : null;
}

async function auditStripe(
  action: string,
  organisationId: number | null,
  details: string,
) {
  try {
    let orgId: number | undefined;
    if (organisationId != null && Number.isFinite(organisationId) && organisationId > 0) {
      const org = await storage.getOrganisation(organisationId);
      if (org) orgId = org.id;
    }
    await storage.createAuditLog({
      organisationId: orgId,
      entityType: "stripe_event",
      action,
      details,
      performedBy: "stripe",
    });
  } catch (err) {
    console.error("Stripe audit failed:", err);
  }
}

export async function insertStripeEvent(event: Stripe.Event): Promise<boolean> {
  // Autocommit on the pool so BullMQ workers can read the row before the
  // request-scoped RLS transaction commits.
  const result = await pool.query(
    `INSERT INTO processed_stripe_events (id, type, payload_json, status)
     VALUES ($1, $2, $3::jsonb, 'received')
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [event.id, event.type, JSON.stringify(event)],
  );
  return (result.rowCount ?? 0) > 0;
}

async function markEvent(id: string, status: "processed" | "failed", error?: string) {
  await db.update(processedStripeEvents)
    .set({ status, error: error || null, updatedAt: new Date() })
    .where(eq(processedStripeEvents.id, id));
}

async function findOrg(obj: any): Promise<{ id: number } | undefined> {
  const orgId = orgIdFromStripeObject(obj);
  if (orgId != null) {
    const org = await storage.getOrganisation(orgId);
    if (org) return org;
  }
  const customerId = typeof obj?.customer === "string" ? obj.customer : obj?.customer?.id;
  if (customerId) {
    const [org] = await db.select().from(organisations).where(eq(organisations.stripeCustomerId, customerId));
    if (org) return org;
  }
  const subId = typeof obj?.subscription === "string"
    ? obj.subscription
    : obj?.id && String(obj.id).startsWith("sub_")
      ? obj.id
      : undefined;
  if (subId) {
    const [org] = await db.select().from(organisations).where(eq(organisations.stripeSubscriptionId, subId));
    if (org) return org;
  }
  return undefined;
}

async function applyPlan(orgId: number, plan: string | null, extra: Record<string, unknown> = {}) {
  const updates: Record<string, unknown> = { updatedAt: new Date(), ...extra };
  if (plan) updates.subscriptionPlan = plan;
  await db.update(organisations).set(updates as any).where(eq(organisations.id, orgId));
}

export async function processStripeEvent(
  eventId: string,
  attemptsMade = 0,
  maxAttempts = 3,
  eventOverride?: Stripe.Event,
) {
  let event = eventOverride;
  if (!event) {
    const [row] = await db.select().from(processedStripeEvents).where(eq(processedStripeEvents.id, eventId));
    if (!row) {
      throw new Error(`Stripe event ${eventId} not found`);
    }
    if (row.status === "processed") {
      return;
    }
    event = (typeof row.payloadJson === "string"
      ? JSON.parse(row.payloadJson as unknown as string)
      : row.payloadJson) as Stripe.Event;
  }
  const obj: any = event.data?.object || {};

  try {
    const org = await findOrg(obj);
    if (!org) {
      const err = "Unknown organisation for Stripe event; not creating an organisation";
      await auditStripe("STRIPE_EVENT_RETRY", null, `${event.id}: ${err}`);
      if (attemptsMade + 1 >= maxAttempts) {
        await markEvent(eventId, "failed", err);
        await auditStripe("STRIPE_EVENT_PROCESSED", null, `${event.id} failed: ${err}`);
        return;
      }
      throw new Error(err);
    }

    if (event.type === "checkout.session.completed") {
      const plan = planFromStripeObject(obj) || "pro";
      const patch: Record<string, unknown> = { subscriptionPlan: plan, updatedAt: new Date() };
      if (typeof obj.customer === "string") patch.stripeCustomerId = obj.customer;
      if (typeof obj.subscription === "string") patch.stripeSubscriptionId = obj.subscription;
      await db.update(organisations).set(patch as any).where(eq(organisations.id, org.id));
    } else if (event.type === "customer.subscription.updated") {
      const plan = planFromStripeObject(obj) || (obj.status === "active" ? "pro" : "basic");
      const patch: Record<string, unknown> = { subscriptionPlan: plan, updatedAt: new Date() };
      if (obj.id) patch.stripeSubscriptionId = obj.id;
      if (typeof obj.customer === "string") patch.stripeCustomerId = obj.customer;
      await db.update(organisations).set(patch as any).where(eq(organisations.id, org.id));
    } else if (event.type === "customer.subscription.deleted") {
      await db.update(organisations).set({
        subscriptionPlan: "basic",
        stripeSubscriptionId: null,
        updatedAt: new Date(),
      } as any).where(eq(organisations.id, org.id));
    } else if (event.type === "invoice.paid") {
      const plan = planFromStripeObject(obj) || planFromStripeObject(obj?.lines?.data?.[0]) || "pro";
      await applyPlan(org.id, plan);
    } else if (event.type === "invoice.payment_failed") {
      await auditStripe("STRIPE_EVENT_PROCESSED", org.id, `${event.id} invoice.payment_failed`);
    }

    await markEvent(eventId, "processed");
    await auditStripe("STRIPE_EVENT_PROCESSED", org.id, `${event.id} ${event.type}`);
  } catch (err: any) {
    const message = err?.message || String(err);
    await auditStripe("STRIPE_EVENT_RETRY", orgIdFromStripeObject(obj), `${event.id}: ${message}`);
    if (attemptsMade + 1 >= maxAttempts) {
      await markEvent(eventId, "failed", message);
      return;
    }
    throw err;
  }
}

export function registerStripeWebhook(app: Express) {
  app.post("/api/stripe/webhook", async (req: Request, res: Response) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      return res.status(503).json({ error: "Stripe webhook is not configured" });
    }
    const sig = req.headers["stripe-signature"];
    if (!sig || typeof sig !== "string") {
      return res.status(400).json({ error: "Missing Stripe signature" });
    }
    const raw = req.rawBody;
    if (!raw || !Buffer.isBuffer(raw) && typeof raw !== "string") {
      return res.status(400).json({ error: "Missing raw body" });
    }
    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(raw as Buffer, sig, secret);
    } catch {
      return res.status(400).json({ error: "Invalid Stripe signature" });
    }

    const isNew = await insertStripeEvent(event);
    const orgId = orgIdFromStripeObject((event.data as any)?.object);
    if (isNew) {
      await auditStripe("STRIPE_EVENT_RECEIVED", orgId, `${event.id} ${event.type}`);
      try {
        const job = await enqueueBillingEvent(event.id, event);
        await waitForTestJob(job);
      } catch (err) {
        console.error("Stripe enqueue/process error:", err);
      }
    }
    return res.status(200).json({ received: true, duplicate: !isNew });
  });
}

export function registerBillingRoutes(app: Express) {
  app.get("/api/billing/status", requireRole("admin"), async (req, res) => {
    try {
      const org = await storage.getOrganisation((req as any).organisationId);
      if (!org) return res.status(404).json({ error: "Organisation not found" });
      res.json({
        organisationId: org.id,
        subscriptionPlan: org.subscriptionPlan,
        stripeCustomerId: org.stripeCustomerId,
        stripeSubscriptionId: org.stripeSubscriptionId,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to load billing status" });
    }
  });

  app.post("/api/billing/checkout", requireRole("admin"), async (req, res) => {
    try {
      if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
        return res.status(503).json({ error: "Billing is not configured" });
      }
      const orgId = (req as any).organisationId as number;
      const org = await storage.getOrganisation(orgId);
      if (!org) return res.status(404).json({ error: "Organisation not found" });
      const base = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;

      // Avoid live Stripe calls in automated tests (sk_test_lexassist stub key).
      if (
        process.env.APP_ENV === "test"
        || process.env.STRIPE_SECRET_KEY === "sk_test_lexassist"
      ) {
        const id = `cs_test_${orgId}_${Date.now()}`;
        return res.json({
          url: `${base}/dashboard?billing=success&session_id=${id}`,
          id,
        });
      }

      const session = await getStripe().checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
        success_url: `${base}/dashboard?billing=success`,
        cancel_url: `${base}/dashboard?billing=cancel`,
        metadata: { organisationId: String(orgId) },
        client_reference_id: String(orgId),
        ...(org.stripeCustomerId ? { customer: org.stripeCustomerId } : {}),
      });
      res.json({ url: session.url, id: session.id });
    } catch (error: any) {
      console.error("Stripe checkout error:", error);
      res.status(500).json({ error: error.message || "Failed to start checkout" });
    }
  });
}
