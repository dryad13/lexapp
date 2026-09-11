# LexAssist-3 Broken / Incomplete Workflows (G12)

Tracked known-bad contracts. **Not merge-blocking** until fixed. Prefer encoding correct behaviour in failing/`@broken` tests.

See the full gate list in [docs/QA_MATRIX.md](../docs/QA_MATRIX.md).

## Critical (tests encode correct contract)

| Issue | Evidence | Impact | Test |
|-------|----------|--------|------|
| Reminder complete returns stale object | [`routes.ts`](../artifacts/api-server/src/lexassist/routes.ts) completes via `reminder2` but `res.json(reminder)` | UI may show incomplete until refresh | `tests/api/reminders.spec.ts` |
| Immigration AI calls Anthropic from browser | `immigration-tool.html` / `immigration-manual.html` — no API key / CORS | AI panel always fails | `tests/e2e/pages.spec.ts` `@broken` |

## High

| Issue | Evidence | Impact |
|-------|----------|--------|
| `ENCRYPTION_KEY` required | `encryption.ts` throws if missing/invalid 64-char hex | Matter create/update fails without key |
| AI placeholder key fallback | routes use `"placeholder"` without mock | OpenAI flows fail without keys or mock |
| Immigration matters skip compliance seeding | create path in `routes.ts` | Empty compliance tab for visa/asylum/etc. |
| Audio/image Replit routes never registered | Only chat routes registered | image/voice → 404 (`unregistered.spec.ts`) |
| Production requires Redis | Sessions + BullMQ; in-memory only when Redis down outside production | Multi-instance durability |

## Medium / incomplete UX

| Issue | Notes |
|-------|-------|
| Chat `/api/conversations/*` unused by UI | AI Assistant uses `/api/ai/suggest` |
| Knowledge + audit APIs | Backend only; Resources page is static |
| Time entries API | No UI |
| RLS residual | Tables without `organisation_id` (conversations, knowledge, journal, etc.) |

## Fixed (do not re-open)

- HTTP-only cookie sessions + Redis (when available)
- `/api/auth/me` includes `displayName`
- Enquiry-pack / financial-item org access checks
- Idempotent Stripe org billing webhooks
- Async PDF jobs (`202` + `GET /api/jobs/:id`)

## How to run G12

```bash
cd LexAssist-3
pnpm test:broken   # Playwright @broken only
```
