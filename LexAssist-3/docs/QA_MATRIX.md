# LexAssist-3 QA Matrix

Production-grade quality gates for the LexAssist-3 API + SPA. **G1–G8 must pass before merge/ship.** G9–G11 are scheduled/manual until baselines exist. G12 is report-only.

## Gate table

| Gate | Layer | Command / tool | Pass criteria | Cadence |
|------|--------|----------------|---------------|---------|
| **G1** | Typecheck | `pnpm typecheck` | libs + api-server + scripts + mockup exit 0 (`pnpm typecheck:spa` tracked separately until SPA schema drift is cleared) | every PR |
| **G2** | API suite | `pnpm test:api` | all pass except known `it.fails` | every PR |
| **G3** | Hardening + Redis | `REQUIRE_REDIS=1 pnpm test:hardening` | all pass; Redis must be up (no in-memory fallback) | every PR |
| **G4** | Coverage | `pnpm test:coverage` | `pool-config.ts` 100% (in-process); broader coverage via G2/G3 + G11 | every PR |
| **G5** | E2E smoke | `pnpm test:e2e:smoke` | hardening + auth pass | every PR |
| **G6** | E2E extended | `pnpm test:e2e` (excl. `@broken`) | isolation, billing, PDF flows | every PR |
| **G7** | A11y | `pnpm test:a11y` | axe: no `serious` / `critical` on login, dashboard, matters (`color-contrast` disabled pending brand palette pass) | every PR |
| **G8** | Supply chain | `pnpm run test:audit` | 0 high/critical outside [`audit-allowlist.json`](../audit-allowlist.json) | every PR |
| **G9** | Load smoke | `pnpm test:load` (k6) | `http_req_failed < 1%`, p95 &lt; 2s | nightly / manual |
| **G10** | ZAP baseline | `pnpm test:security:zap` | no High findings | weekly / manual |
| **G11** | Mutation | `pnpm test:mutate` (Stryker) | score ≥60% on target files | monthly / manual |
| **G12** | Broken contracts | `pnpm test:broken` | tracked in [BROKEN_WORKFLOWS.md](../tests/BROKEN_WORKFLOWS.md); not merge-blocking | report only |

## Environment

| Variable | Purpose | Test default |
|----------|---------|--------------|
| `DATABASE_URL` | Postgres | compose `54329` or local `lexassist_test` |
| `REDIS_URL` | Sessions + BullMQ | `redis://127.0.0.1:63799` |
| `REQUIRE_REDIS` | Fail tests if Redis down | `1` in CI |
| `ENCRYPTION_KEY` | 64-char hex AES key | fixed test key in helpers |
| `SESSION_SECRET` | Signed session cookie | `test-session-secret` |
| `STRIPE_*` | Billing stubs | `sk_test_lexassist` / `whsec_test_lexassist` / `price_test_lexassist` |
| `APP_ENV` | Enables test cookie bearer fallback | `test` |

```bash
cd LexAssist-3
pnpm test:db:up          # Postgres :54329 + Redis :63799
export REQUIRE_REDIS=1
pnpm test:qa             # local one-shot: typecheck + hardening + api + coverage + e2e smoke
```

## Production go-live (multi-tenant)

See [MULTI_TENANT_ONBOARDING.md](./MULTI_TENANT_ONBOARDING.md) and [SECURITY.md](./SECURITY.md).

- Production must set `REQUIRE_REDIS=1` (no in-memory session fallback).
- Boot must run `initDatabase()` so RLS policies stay applied.
- Onboard firms via `/platform` (or break-glass `pnpm --filter @workspace/api-server create-org`).
- Bootstrap platform admin with `PLATFORM_ADMIN_USER` / `PLATFORM_ADMIN_PASS` when `SEED_DEMO_USERS=0`.
- Stripe metadata must include `organisationId` for each firm.
- Set `CORS_ORIGINS`, `SEED_DEMO_USERS=0`, and `MFA_REQUIRED_FOR_ADMINS=1`.

## CI

GitHub Actions: [`.github/workflows/lexassist-qa.yml`](../../.github/workflows/lexassist-qa.yml) runs G1–G8 on PR/push to `main`.

Optional:

- [`.github/workflows/lexassist-load.yml`](../../.github/workflows/lexassist-load.yml) — G9 (`workflow_dispatch` / schedule)
- [`.github/workflows/lexassist-security.yml`](../../.github/workflows/lexassist-security.yml) — G10 (`workflow_dispatch` / schedule)

## Fail = do not ship (G1–G8)

If any of G1–G8 fails, do not merge or deploy. Fix or explicitly waive with a documented allowlist entry (audit only).
