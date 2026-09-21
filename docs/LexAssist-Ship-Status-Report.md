# LexAssist-3 — Ship Status Report

**Date:** 21 September 2026  
**Scope:** Security + G12 close, graphify re-validation, full test re-run  
**Verdict:** **Code is pilot-ready.** Remaining go-live work is **ops config + Laya**, not open Critical defects.

---

## Executive summary

Security hardening and previously broken Critical workflows are closed in code. After a fresh graphify rebuild and a concrete test pass against real graph nodes:

| Suite | Result |
|-------|--------|
| API (`vitest` `tests/api`) | **111 / 111 passed** |
| Playwright e2e (excl. `@broken`) | **34 / 34 passed** |
| Playwright `@broken` (G12) | **0 tests** (empty — expected) |
| G3 Redis hardening | **Not re-run** — Redis not listening on `:63799` in this environment |

**Ready to ship (product code):** Yes, for a controlled pilot once production env vars and Redis are set.  
**Ready for full multi-firm go-live:** No — **Laya** is still the remaining product track; solicitor AI/privacy wording remains parallel.

---

## Where the app is now

### Working (verified)

- **Auth & sessions:** HTTP-only cookie sessions (`lexassist.sid`); `/api/auth/me` returns `displayName`; login / logout / refresh e2e green.
- **Lockout & rate limit:** 10 failed logins → **423**; rate-limit opt-in in test via `X-Test-Enable-Rate-Limit`.
- **MFA (TOTP):** setup → confirm → login challenge → verify covered in `security-hardening.spec.ts`.
- **Platform console:** org create/suspend, password reset, role guardrails (`platform.spec.ts`).
- **Multi-tenant isolation:** cross-org 404; shared usernames across orgs (`isolation.spec.ts` + e2e).
- **Matters / immigration:** practice-area create flow, immigration stages + compliance seed, conveyancing still distinct; read-only cannot mutate.
- **Reminders:** `POST /api/reminders/:id/complete` returns completed row (API + e2e reminders page).
- **AI fail-closed:** no `"placeholder"` key; missing config → **503** `AI_NOT_CONFIGURED` via `ai-config.ts`.
- **Immigration browser AI:** Anthropic calls disabled in static tools (e2e asserts).
- **PDF jobs:** async journal export path (hardening e2e).
- **Billing:** Stripe webhook stubs + admin vs fee-earner checkout gates.
- **A11y (G7):** login / dashboard / matters — no serious/critical axe violations.
- **G12 Critical list:** empty (`tests/BROKEN_WORKFLOWS.md`).

### Intentionally not product surfaces (OOS)

| Area | Notes |
|------|--------|
| Audio / image Replit routes | Not registered; API expects 404 |
| Knowledge + audit UI | API only; Resources page static |
| Time entries UI | API only |
| Chat `/api/conversations/*` | Unused by AI Assistant UI |

### High (ops / config — not code defects)

| Item | Required for production |
|------|-------------------------|
| `ENCRYPTION_KEY` | Set in Render (`sync: false`) |
| `REDIS_URL` + `REQUIRE_REDIS=1` | No in-memory session fallback in prod |
| AI provider keys | Real keys or AI routes stay 503 |
| `PLATFORM_ADMIN_USER` / `PLATFORM_ADMIN_PASS` | Bootstrap when `SEED_DEMO_USERS=0` |
| `CORS_ORIGINS`, `SEED_DEMO_USERS=0`, `MFA_REQUIRED_FOR_ADMINS=1` | Hardening checklist |

---

## Graphify validation (concrete tests)

**Rebuild:** `graphify update` on LexAssist-3 — **2578 nodes, ~4934 edges, 262–264 communities** (AST extract succeeded outside sandbox).

Tests map to real implementation nodes (not orphan stubs):

| Concern | Graph evidence |
|---------|----------------|
| Lockout / MFA | `security-hardening.spec.ts` → `auth-lockout.ts`, `totp.ts`, `mfa.ts` |
| Reminder complete | `reminders.spec.ts` → … → `DatabaseStorage.completeReminder()` |
| AI fail-closed | `ai-config.ts` ↔ `enquiries-ai.ts` (`resolveAi*`, `aiNotConfiguredError`) |
| Sessions | `sessions.ts`, `SESSION_COOKIE`, hardening e2e |
| Platform | `platform-routes.ts`, `requirePlatformAdmin()`, `platform.tsx` |

**Spec hygiene:** no `test.fix` / `describe.fix` / `@broken` markers remain in `*.spec.ts`.

**Fix during this run:** `tests/e2e/immigration.spec.ts` still used hardcoded `TEST_API_BASE` `:8080` + Bearer token. Reworked to **cookie + `credentials: "include"`** (same pattern as isolation e2e). That was a stale test contract, not an app regression.

---

## Test results (this run)

```
API:   31 files, 111 tests — all passed (~12.5s)
E2E:   34 tests — all passed (~1.2m)
G12:   No tests found for @broken
```

**Environment notes from the run**

- Postgres: `lexassist_test` on local `:5432`
- Redis: unavailable → API correctly fell back to in-memory stores (fine for G2/G5/G6/G7; **not** a G3 pass)
- Node: 20.14.0 (Vite warns ≥20.19 recommended; did not block e2e)
- Playwright config: Vite bound to `127.0.0.1`

---

## Ready-to-ship status

| Question | Answer |
|----------|--------|
| Can we pilot with a firm on this build? | **Yes**, after Render secrets + Redis + AI keys + platform admin bootstrap |
| Are Critical G12 defects open? | **No** |
| Are merge gates G2/G5/G6/G7 green here? | **Yes** (G3 Redis hardening skipped — Redis down) |
| Is multi-tenant go-live “done”? | **Almost on platform code; Laya still outstanding as product** |

### Blockers (ordered)

1. **Laya (product)** — UK-hosted decision layer for document type / enquiry triage / risk assist. Stakeholder track; not a failing test today.
2. **Production Redis** — must be provisioned; `REQUIRE_REDIS=1` already in `render.yaml`.
3. **Secrets & bootstrap** — `ENCRYPTION_KEY`, AI keys, `PLATFORM_ADMIN_*`, CORS, `SEED_DEMO_USERS=0`, MFA for admins.
4. **G3 local/CI Redis gate** — re-run `REQUIRE_REDIS=1 pnpm test:hardening` once `docker compose -f docker-compose.test.yml up` (or CI Redis) is available.
5. **Solicitor AI / privacy wording** — parallel compliance track (not engineering defect).
6. **Dev hygiene (non-blocking)** — upgrade Node for Vite; some e2e helpers still mention legacy localStorage token strings (cookie path is what prod uses).

### Not blockers

- Missing audio/image/knowledge UI  
- In-memory Redis fallback in this laptop test run  
- Stakeholder “Laya left” narrative (expected)

---

## Closed in this security + G12 pass (code)

- Reminder complete returns completed entity  
- AI placeholder removed; 503 when unconfigured  
- Lockout 423 + MFA setup/confirm/verify API coverage  
- `PLATFORM_ADMIN_*` in `render.yaml`  
- Immigration AI browser disable + cookie-session e2e cleanup  
- Rate-limit skipped under `APP_ENV=test` unless `X-Test-Enable-Rate-Limit`  
- Playwright Vite host bind for stable local e2e  

---

## Recommended next commands (ops / CI)

```bash
cd LexAssist-3
pnpm test:db:up                    # Postgres + Redis for G3
export REQUIRE_REDIS=1
pnpm test:qa                       # typecheck + hardening + api + coverage + e2e smoke
pnpm test:e2e                      # full e2e (34)
pnpm test:broken                   # expect: no tests
```

---

## Bottom line

**LexAssist-3 application code is in ship shape for a Redis-backed pilot:** Critical defects cleared, security controls covered by concrete tests tied to the knowledge graph, API **111/111** and e2e **34/34** green.

**Do not call full go-live complete** until production Redis/secrets are live **and** the Laya triage track (plus solicitor wording) lands. Those are the remaining blockers — not open G12 Critical bugs.
