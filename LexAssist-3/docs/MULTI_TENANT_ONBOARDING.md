# Multi-tenant onboarding (pilot firms)

LexAssist-3 is a **shared-database, organisation-scoped** product. One deployment serves many law firms. Isolation is enforced by `organisation_id` on rows plus Postgres row-level security (`app.current_org_id` per request).

## Create a firm (preferred: platform console)

LexAssist operators sign in as `platform_admin` and use **`/platform`** to:

- View aggregate firm analytics (counts only — no matter/client PII)
- Create a firm + first admin
- Suspend / activate a firm (suspended firms cannot log in)
- Reset a firm admin password (one-time temp password; admin must change on next login)
- Review platform/auth audit events and per-firm last-login / last-matter timestamps

Hand temporary passwords **out-of-band** (phone/secure channel). Do not paste them into tickets or chat logs.

Bootstrap a platform admin in non-prod via seed (`SEED_DEMO_USERS=1` creates `platform.admin` / `PlatformAdmin12`), or in production set `PLATFORM_ADMIN_USER` + `PLATFORM_ADMIN_PASS` (+ optional `SEED_PLATFORM_ADMIN=1`) on first boot.

## Create a firm (break-glass CLI)

If the console is unavailable, ops can still use the CLI:

```bash
cd LexAssist-3
DATABASE_URL="postgresql://..." pnpm --filter @workspace/api-server create-org -- \
  --name "Firm B Solicitors" \
  --admin-user firmb.admin \
  --admin-pass 'ChooseAStrongPass12' \
  --admin-display "Firm B Admin" \
  --plan basic
```

The script prints the new `organisation.id` and admin user. Keep that id for Stripe metadata.

## After create-org / console create

1. Give the firm admin their username, password, and organisation name (for login when usernames collide across firms).
2. Firm admin signs in and adds fee earners / assistants via **Users** (`POST /api/users` is scoped to their org).
3. Usernames are unique **per organisation** — two firms may both use `assistant1`. If they do, login must include the Organisation field (firm name).
4. Attach billing: Stripe Checkout / customer metadata must include `organisationId` matching the org id from create-org.

## Offboard a firm

1. Prefer **Suspend** in `/platform` (blocks login immediately).
2. Optionally disable or delete the firm’s users (org admin or ops with DB access).
3. Retain or purge data per contract; deleting the `organisations` row cascades to users and firm-owned rows.
4. Cancel the Stripe subscription for that customer.

## Production checklist

- Set `REQUIRE_REDIS=1` and provision Redis / `REDIS_URL` before deploy (see [SECURITY.md](./SECURITY.md)).
- Set `CORS_ORIGINS`, `SEED_DEMO_USERS=0`, and `MFA_REQUIRED_FOR_ADMINS=1`.
- Bootstrap platform admin via `PLATFORM_ADMIN_USER` / `PLATFORM_ADMIN_PASS` (MFA required for `platform_admin` outside test).
- Confirm boot runs `initDatabase()` (applies migrations + `applyTenantRls`).
- Postgres backups scheduled; run a restore drill before first live firm.
- Verify isolation with two orgs on non-prod (seed pattern: `admin` @ Gardner Champion vs `other.admin` @ Isolation Test Firm).
- Stripe webhooks: unknown `organisationId` must not create orgs (already enforced).

## What is shared vs firm-owned

| Data | Scope |
|------|--------|
| Matters, users, knowledge, journal, conversations | Firm only |
| Enquiry library / rule templates with `organisation_id NULL` | Shared platform seed (readable by all authed orgs) |
| Firm custom library / template rows | Firm only |
| Platform console (`/platform`, `/api/platform/*`) | LexAssist operators only (`platform_admin`) |
