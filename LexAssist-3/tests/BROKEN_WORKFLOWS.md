# LexAssist-3 Broken / Incomplete Workflows (G12)

Tracked known-bad contracts and intentional out-of-scope surfaces. **Not merge-blocking** unless Critical returns.

See the full gate list in [docs/QA_MATRIX.md](../docs/QA_MATRIX.md).

## Critical

_None open._ Reminder complete now returns the completed row (`routes.ts` + `tests/api/reminders.spec.ts`).

## High (ops / config — not open code defects)

| Item | Status |
|------|--------|
| `ENCRYPTION_KEY` required | By design — set in Render (`sync: false`). Tests inject `TEST_ENCRYPTION_KEY`. |
| Production Redis | By design — `REQUIRE_REDIS=1` in `render.yaml`; provision `REDIS_URL` before deploy. |
| AI keys | No `"placeholder"` fail-open. Missing keys → **503** `AI_NOT_CONFIGURED` on AI routes. Tests use OpenAI mock. |

## Out of go-live scope (intentional)

| Item | Notes |
|------|-------|
| Audio / image Replit routes | Not registered; chat only. `unregistered.spec.ts` expects 404. |
| Chat `/api/conversations/*` unused by UI | AI Assistant uses `/api/ai/suggest` |
| Knowledge + audit APIs | Backend only; Resources page is static |
| Time entries API | No UI |

## Fixed (do not re-open)

- Reminder complete returns `completed: true`
- Immigration matter create seeds compliance checks
- Browser immigration Anthropic calls disabled (static tools)
- Cookie sessions (legacy `auth_token` / `conveyflow_auth_token` e2e retired)
- HTTP-only cookie sessions + Redis (when available)
- `/api/auth/me` includes `displayName`
- Enquiry-pack / financial-item org access checks
- Idempotent Stripe org billing webhooks
- Async PDF jobs (`202` + `GET /api/jobs/:id`)
- Residual RLS tables org-scoped
- Per-org username uniqueness + optional organisation on login
- Platform console + `create-org` / multi-tenant onboarding
- Security headers + CORS allowlist
- Password policy + login lockout; demo seed gated
- Admin TOTP MFA; org-prefixed uploads (+ optional S3 helpers)

## How to run G12

```bash
cd LexAssist-3
pnpm test:broken   # Playwright @broken only — expect empty / no Critical fails
```
