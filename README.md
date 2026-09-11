# LexAssist-3

UK legal practice app (conveyancing + immigration): Express API, React/Vite SPA, Postgres, Redis.

All product code lives in [`LexAssist-3/`](LexAssist-3/).

## Quick start

```bash
cd LexAssist-3
pnpm install
```

### Test database + Redis

```bash
pnpm test:db:up
# Postgres: localhost:54329 (user/pass/db: lexassist / lexassist / lexassist_test)
# Redis:    localhost:63799
```

Local Postgres fallback (no Docker): create DB `lexassist_test` and set:

```bash
export DATABASE_URL=postgresql://USER@127.0.0.1:5432/lexassist_test
export REDIS_URL=redis://127.0.0.1:63799
```

### Run the app (dev)

```bash
# Terminal 1 — API (default :8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — SPA (Vite proxies /api → :8080)
pnpm --filter @workspace/lexassist run dev
```

### Tests

```bash
cd LexAssist-3
pnpm test:db:up
pnpm test:qa          # typecheck + hardening + api + coverage + e2e smoke
pnpm test:hardening   # Stripe, sessions, rate-limit, PDF jobs, pool, isolation (set REQUIRE_REDIS=1 in CI)
pnpm test:api
pnpm test:e2e
pnpm test:a11y
```

Full gate matrix (G1–G12): [`LexAssist-3/docs/QA_MATRIX.md`](LexAssist-3/docs/QA_MATRIX.md).

## Seed credentials

| User | Password | Role |
|------|----------|------|
| `admin` | `admin12` | admin |
| `hasinah.ahmed` | `Ahmed12` | fee_earner |
| `readonly` | `Readonly12` | read_only |

## Deploy

- Docker: [`LexAssist-3/Dockerfile`](LexAssist-3/Dockerfile)
- Render: [`LexAssist-3/render.yaml`](LexAssist-3/render.yaml)

Set `ENCRYPTION_KEY` (64-char hex), `SESSION_SECRET`, `DATABASE_URL`, `REDIS_URL`, and optionally Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`).
