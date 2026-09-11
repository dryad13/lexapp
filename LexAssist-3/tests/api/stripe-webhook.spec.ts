import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, json, type AuthSession } from "../helpers/api.js";
import { signedStripeRequest } from "../helpers/stripe.js";
import { withTestDb } from "../helpers/db.js";
import { randomSuffix } from "../helpers/env.js";

async function postWebhook(event: Record<string, unknown>, secret?: string) {
  const { payload, signature } = signedStripeRequest(event, secret);
  return apiFetch("/api/stripe/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": signature,
    },
    body: payload,
  });
}

describe("stripe webhook", () => {
  let admin: AuthSession;
  let orgId: number;

  beforeAll(async () => {
    admin = await login();
    orgId = admin.organisationId;
  });

  it("returns 400 for missing signature", async () => {
    const res = await apiFetch("/api/stripe/webhook", {
      method: "POST",
      body: JSON.stringify({ id: "evt_missing", type: "ping" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid signature", async () => {
    const res = await postWebhook(
      { id: `evt_bad_${randomSuffix()}`, object: "event", type: "ping", data: { object: {} } },
      "whsec_wrong_secret",
    );
    expect(res.status).toBe(400);
  });

  it("checkout.session.completed sets subscription_plan once", async () => {
    const evtId = `evt_co_${randomSuffix()}`;
    const event = {
      id: evtId,
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: `cs_${randomSuffix()}`,
          customer: `cus_${randomSuffix()}`,
          subscription: `sub_${randomSuffix()}`,
          metadata: { organisationId: String(orgId), plan: "pro" },
        },
      },
    };
    const res = await postWebhook(event);
    expect(res.status).toBe(200);

    const status = await apiFetch("/api/billing/status", { token: admin.token });
    expect(status.status).toBe(200);
    const body = await json(status);
    expect(body.subscriptionPlan).toBe("pro");

    const events = await withTestDb(async (c) => {
      return c.query("SELECT * FROM processed_stripe_events WHERE id = $1", [evtId]);
    });
    expect(events.rowCount).toBe(1);
    expect(events.rows[0].status).toBe("processed");
  });

  it("customer.subscription.updated sets plan from price metadata", async () => {
    const evtId = `evt_sub_${randomSuffix()}`;
    const res = await postWebhook({
      id: evtId,
      object: "event",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: `sub_${randomSuffix()}`,
          customer: `cus_${randomSuffix()}`,
          status: "active",
          metadata: { organisationId: String(orgId) },
          items: { data: [{ price: { metadata: { plan: "pro" } } }] },
        },
      },
    });
    expect(res.status).toBe(200);
    const status = await json(await apiFetch("/api/billing/status", { token: admin.token }));
    expect(status.subscriptionPlan).toBe("pro");
  });

  it("replay of the same evt_ is a no-op", async () => {
    const evtId = `evt_replay_${randomSuffix()}`;
    const event = {
      id: evtId,
      object: "event",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: `sub_replay_${randomSuffix()}`,
          metadata: { organisationId: String(orgId) },
          items: { data: [{ price: { metadata: { plan: "pro" } } }] },
        },
      },
    };
    const first = await postWebhook(event);
    expect(first.status).toBe(200);
    const before = await json(await apiFetch("/api/billing/status", { token: admin.token }));

    const second = await postWebhook(event);
    expect(second.status).toBe(200);
    const after = await json(await apiFetch("/api/billing/status", { token: admin.token }));
    expect(after.subscriptionPlan).toBe(before.subscriptionPlan);

    const rows = await withTestDb(async (c) =>
      c.query("SELECT * FROM processed_stripe_events WHERE id = $1", [evtId]),
    );
    expect(rows.rowCount).toBe(1);
  });

  it("unknown organisationId fails the event and does not create an org", async () => {
    const before = await withTestDb(async (c) => c.query("SELECT COUNT(*)::int AS n FROM organisations"));
    const evtId = `evt_unknown_${randomSuffix()}`;
    const res = await postWebhook({
      id: evtId,
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { organisationId: "99999999" },
          customer: "cus_missing",
        },
      },
    });
    expect(res.status).toBe(200);
    const row = await withTestDb(async (c) =>
      c.query("SELECT status, error FROM processed_stripe_events WHERE id = $1", [evtId]),
    );
    expect(row.rows[0].status).toBe("failed");
    const after = await withTestDb(async (c) => c.query("SELECT COUNT(*)::int AS n FROM organisations"));
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });
});
