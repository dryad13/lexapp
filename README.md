# UK Legal Onboarding + Post-Completion MVP (Monorepo)

This repo contains:
- `apps/api`: FastAPI + Postgres (async SQLAlchemy 2.0) + Alembic + Celery + Stripe webhook + PDF report
- `apps/firm-portal`: Next.js PWA for staff (admin/fee earner/assistant)
- `apps/client-portal`: Next.js PWA for client onboarding via secure link token
- `packages/shared`: shared TS types (minimal)
- `docker-compose.yml`: postgres + redis + api + worker

## Quick start

### 1) Prereqs
- Docker + Docker Compose
- Node 18+ (or 20+)

### 2) Configure env
```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/firm-portal/.env.example apps/firm-portal/.env
cp apps/client-portal/.env.example apps/client-portal/.env
```

Edit Stripe variables in `.env` / `apps/api/.env`:
- `STRIPE_SECRET_KEY` (test)
- `STRIPE_PUBLISHABLE_KEY` (test)
- `STRIPE_WEBHOOK_SECRET` (test)

### 3) Start backend stack
```bash
docker compose up --build
```

API: http://localhost:8000  
Docs: http://localhost:8000/docs

On first boot, the API:
- runs Alembic migrations
- seeds demo firm + user + matter + onboarding request

### 4) Start frontends
From repo root:
```bash
npm install
npm run dev:firm
```

In another terminal:
```bash
npm run dev:client
```

Firm Portal: http://localhost:3000  
Client Portal: http://localhost:3002

## Demo credentials (seeded)
Firm portal login:
- Email: `admin@demo-firm.co.uk`
- Password: `Password123!`

## Stripe webhook (local)
Recommended: Stripe CLI
```bash
stripe listen --forward-to localhost:8000/api/v1/stripe/webhook
```
Copy the signing secret into `apps/api/.env` as `STRIPE_WEBHOOK_SECRET`.

Test card:
- `4242 4242 4242 4242`
- any future expiry / any CVC / any postcode

## Smoke test
```bash
bash scripts/smoke-test.sh
```

## Environment variables
See:
- `.env.example` (root)
- `apps/api/.env.example`
- `apps/firm-portal/.env.example`
- `apps/client-portal/.env.example`
