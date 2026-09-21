# LexAssist-3 Security runbook

Operational checklist for production. Multi-tenant isolation details: [MULTI_TENANT_ONBOARDING.md](./MULTI_TENANT_ONBOARDING.md).

## Required secrets and env

| Variable | Purpose |
|----------|---------|
| `ENCRYPTION_KEY` | 64-char hex AES-256-GCM key for client PII fields and MFA secrets |
| `SESSION_SECRET` | Signed session cookie |
| `DATABASE_URL` | Postgres |
| `REDIS_URL` | Sessions, rate limit, login lockout, queues |
| `REQUIRE_REDIS` | Must be `1` in production (boot fails if Redis is down) |
| `CORS_ORIGINS` | Comma-separated allowlist (required in production) |
| `SEED_DEMO_USERS` | Must be `0` in production |
| `MFA_REQUIRED_FOR_ADMINS` | `1` in production — firm admins enroll TOTP before full access |
| `PLATFORM_ADMIN_USER` / `PLATFORM_ADMIN_PASS` | Bootstrap LexAssist platform console operator (optional `SEED_PLATFORM_ADMIN=1`) |
| Stripe keys | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` |

Optional uploads: set `S3_BUCKET` (+ `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, optional `S3_ENDPOINT` / `S3_REGION`) for S3-compatible object storage. Otherwise files stay under `uploads/org-{id}/`.

`platform_admin` MFA is always required outside `APP_ENV=test` (override with `MFA_REQUIRED_FOR_PLATFORM=0` only for break-glass).

## Before first live firm

1. Provision Redis and set `REDIS_URL` + `REQUIRE_REDIS=1`.
2. Set `CORS_ORIGINS` to the real SPA origin(s).
3. Confirm `SEED_DEMO_USERS=0` — create firms via `/platform` (or break-glass `create-org`), not demo passwords.
4. Bootstrap a platform admin (`PLATFORM_ADMIN_USER` / `PLATFORM_ADMIN_PASS`) and enroll MFA.
5. Rotate any credentials that ever appeared in seed/`AUTH_PASSWORD`.
6. Confirm MFA enrollment works for the first firm admin.
7. Postgres backup + restore drill.
8. Dual-org isolation smoke (`admin` vs `other.admin` only on non-prod).

## Platform console

- Route: `/platform` (SPA) and `/api/platform/*`.
- Role: `platform_admin` on the reserved LexAssist Platform org (`is_platform=true`).
- Capabilities: firm create, suspend/activate, admin password reset (temp + must-change), aggregate counts, last-activity timestamps, platform/auth audit viewer.
- Firm matter/user APIs are blocked for platform sessions; platform APIs are blocked for firm sessions.
- Actions are audited (`entity_type=platform`); logins write `entity_type=auth` (`LOGIN_SUCCESS` / `LOGIN_FAILURE` / `PASSWORD_CHANGED`).
- Password handoff is out-of-band only — never store temp passwords in tickets or chat.

## AI data egress

Server-side AI (email draft, suggest, enquiry packs, chat) redacts NI/passport/DOB/bank patterns before prompts leave the API. Cloud providers still process residual matter text — treat as third-party processing under your DPIA. Browser Anthropic calls in immigration static tools are disabled.

## GDPR / compliance programme

This runbook is **not** a GDPR programme. Lawful basis, retention, DSAR, DPIA, and processor contracts remain a separate workstream.

## Incident contacts

Document owner on-call and hosting (Render) access in your ops wiki. Revoke sessions by rotating `SESSION_SECRET` and flushing Redis `sess:*` keys if needed.
