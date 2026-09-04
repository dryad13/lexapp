# LexAssist — Product Requirements Document

**Product:** UK legal onboarding + post-completion (MVP)  
**Codename / repo:** LexApp / LexAssist  
**Status:** MVP specified by current implementation  
**Last updated:** 2026-09-03

This PRD describes how the product is supposed to work: who uses it, the end-to-end workflow, and the rules that make a matter “done”.

---

## 1. Problem

UK conveyancing firms collect AML / ID / source-of-funds information from clients, take money on account, then chase Land Registry and HMRC work after completion.

Today that work is split across email, paper packs, shared drives, and fee-earner memory. Clients get a long list of asks with no progress. Staff cannot see, on one file, whether onboarding is complete, whether money is in, or which post-completion tasks are still open.

## 2. Solution

LexAssist is a matter-centric workspace with two surfaces:

| Surface | Who | How they get in |
|---|---|---|
| **Firm portal** | Solicitors and assistants | Email + password (JWT) |
| **Client portal** | The client on a file | Private link `/o/{token}` (no account) |

Both talk to one API. The unit of work is a **Matter** (a conveyancing file). Onboarding, documents, payments, and post-completion tasks all hang off that matter.

## 3. Goals (MVP)

1. A fee earner can open a new file and send the client a secure onboarding pack in under two minutes.
2. The client can complete ID, address history, source of funds, consents, and document uploads without creating an account.
3. The client can pay money on account by card (Stripe).
4. Staff can see live onboarding progress, documents, and payment status on the matter.
5. After completion, staff can work a type-specific checklist (SDLT, AP1, discharges, etc.) and export a PDF.

**Non-goals (MVP)**

- Multi-firm SaaS admin, billing of firms, or white-label theming
- Real SMTP / production email (console mailer only)
- IDV vendor (Onfido / LexisNexis); uploads are stored, not verified
- Full accounts / ledgers / client-account reconciliation
- eSigning of deeds
- Automatic Land Registry or HMRC filing
- Client messaging / chat
- Matter status machine beyond the initial `ONBOARDING` value
- The leftover `onboarding-api` Java service (not part of this product)

## 4. Users and roles

### 4.1 Firm staff

| Role | Can create matters | Can send onboarding | Can view file, tasks, PDF |
|---|---|---|---|
| `ADMIN` | Yes | Yes | Yes |
| `FEE_EARNER` | Yes | Yes | Yes |
| `ASSISTANT` | No | Yes | Yes |

All staff actions are scoped to their **firm**. A user cannot see another firm’s matters.

Auth: email + password → access token (15 min) + refresh token (14 days). Login is rate-limited to 10 requests/minute per IP.

### 4.2 Client

No login. Possession of a valid, unexpired onboarding token is authentication.

- Link shape: `{client_portal}/o/{token}`
- Token lifetime: **14 days** from creation
- Optional **6-digit backup code** (seeded demo uses `123456`)
- Client onboarding endpoints are rate-limited to 30 requests/minute per IP

Error contract:

| Condition | HTTP |
|---|---|
| Unknown token | 404 Invalid link |
| Expired token | 410 Link expired |
| Wrong backup code | 401 Invalid backup code |

Clients may also paste the token on the client-portal home page if they were given the token rather than the full URL.

## 5. Domain model

```
Firm 1──* User
Firm 1──* Client
Firm 1──* Matter
Matter *──1 Client (optional)
Matter 1──* OnboardingRequest   (token + expiry + backup code)
Matter 1──1 OnboardingSubmission (form answers)
Matter 1──* Document
Matter 1──* Payment
Matter 1──* PostCompletionTask
Firm 1──* AuditLog
```

**Matter types:** `PURCHASE` | `SALE` | `REMORTGAGE` | `TRANSFER`  
**Matter status (current):** created as `ONBOARDING`. Status is not auto-advanced in MVP.  
**Document categories:** `ID` | `SELFIE` | `POA` | `SOF` | `MORTGAGE_OFFER` | `SIGNED_DEED` | `OTHER`  
**Payment status:** Stripe-aligned (`REQUIRES_PAYMENT_METHOD` → `PROCESSING` / `SUCCEEDED` / `FAILED` / `CANCELED`)  
**Task status:** `PENDING` | `IN_PROGRESS` | `COMPLETED`

Every staff and client mutation writes an **audit log** row (login, matter created, link created, email queued, onboarding updated, document uploaded, payment created/updated, task updated, report exported).

---

## 6. End-to-end workflow

This is the product workflow. Happy path is numbered. Branches are called out under each step.

```
[Staff] login
    → create matter (client + type + address)
    → system plants post-completion checklist for that type
    → create onboarding link (token, 14 days, backup code)
    → send email (queued)  ──────────────┐
                                         ▼
[Client] opens /o/{token}
    → 1 personal details
    → 2 address history (3 years)
    → 3 upload ID + selfie + proof of address
    → 4 source of funds
    → 5 consents
    → pack marked complete when 1–5 + three docs exist
    → 6 pay money on account (Stripe)   [optional vs completeness]
                                         │
                                         ▼
[Staff] matter dashboard
    → watch % / missing items / docs / payments
    → work post-completion tasks
    → download post-completion PDF
```

### Step 1 — Staff sign in

**Portal:** Firm portal `http://localhost:3000` (prod: firm origin).  
Unauthenticated users are sent to `/login`. Successful login stores tokens and lands on `/matters`.

**Demo credentials (seeded on empty database):**

- Email: `admin@demo-firm.co.uk`
- Password: `Password123!`
- Firm: Demo Firm LLP

### Step 2 — Open a matter

Staff create a file with:

- Reference (3–64 chars), e.g. `DEMO-0001`
- Type: Purchase / Sale / Remortgage / Transfer
- Property address
- Client: first name, last name, email (phone and joint-party names are in the data model)

On create:

1. A `Client` row is created for the firm.
2. A `Matter` is created, `status = ONBOARDING`.
3. A **post-completion checklist** is generated from the type template (see §7). Tasks start as `PENDING`.

**Seeded demo matter:** `DEMO-0001`, purchase, 1 Demo Street, London, client John Buyer.

Assistants cannot create matters (403). They can still open existing ones.

### Step 3 — Invite the client

On the matter page, staff click **Create link**.

System:

1. Generates a URL-safe token and a 6-digit backup code.
2. Stores `OnboardingRequest` with `expires_at = now + 14 days`.
3. Returns `link = {client_portal_origin}/o/{token}`.
4. Audits `ONBOARDING_REQUEST_CREATED`.

Staff then click **Send email**. System queues Celery task `app.tasks.send_onboarding_email`.

**MVP email behaviour:** console mailer only. Body includes firm name, matter reference, link, and backup code. Recipient is the client email, or `client@example.com` if missing. No SMTP, no delivery tracking.

Staff can also copy the link and send it themselves (WhatsApp, existing mail).

Multiple links may be created over time; the email worker uses the **latest** request for that matter.

### Step 4 — Client completes the onboarding pack

Client opens the link (or pastes the token on the client home page).

The pack shows a **progress bar**. Completeness is **7 equal parts** (each ~14%):

| # | Step | Stored as | Required for “complete”? |
|---|---|---|---|
| 1 | Personal details (first name, last name, DOB) | `personal_details` JSON | Yes |
| 2 | Address history, 3 years (line, city, from, to; multiple rows) | `address_history` JSON | Yes |
| 3 | Photo ID (passport or driving licence) | Document `ID` | Yes |
| 4 | Selfie | Document `SELFIE` | Yes |
| 5 | Proof of address | Document `POA` | Yes |
| 6 | Source of funds (savings / gift / sale proceeds / inheritance / other + details) | `sof` JSON | Yes |
| 7 | Consents (checkbox + typed full name) | `consents` JSON | Yes |

Each form step is saved independently (partial upsert). Missing items are listed as “Still needed”.

When all four JSON blocks are present **and** `{ID, SELFIE, POA}` exist, the submission is marked `is_complete = true` and `completed_at` is set. That flag is sticky (not unset if a later save happens).

**Document rules (client and staff uploads):**

- MIME: PDF, JPEG, PNG only (415 otherwise)
- Max size: 10 MB (413 otherwise)
- Stored on local disk under the API upload directory
- Staff can download; clients cannot download after upload in MVP
- Staff upload API exists for the same categories; the matter UI in MVP is download-only

### Step 5 — Client pays money on account

Separate from pack completeness. Default amount in UI: **50000 pence (£500.00)**. API allows 1–5,000,000 pence, currency `gbp`.

Flow:

1. Client submits amount → API creates a `Payment` row and a Stripe PaymentIntent, tagged with `matter_id` and `payment_id`.
2. Client confirms with Stripe.js (`confirmPayment`, return URL is the same onboarding page).
3. Stripe webhook `POST /api/v1/stripe/webhook` updates payment status on `succeeded` / `failed` / `canceled` / `processing`.

Local webhook: `stripe listen --forward-to localhost:8000/api/v1/stripe/webhook`. Test card `4242 4242 4242 4242`.

Payment is **not** a required step for `is_complete`. Staff see it on the matter as amount + status.

### Step 6 — Staff monitor the file

Matter dashboard (`/matters/{id}`) is the single staff view:

- Reference, address, type pill, status pill
- Onboarding percent + missing list (same calculator as the client pack)
- Onboarding link actions
- Document list with download
- Payments list
- Post-completion task board
- Post-completion PDF download

List view (`/matters`) shows all firm matters, newest first.

### Step 7 — Post-completion work

Tasks were planted at matter creation. Staff, including assistants, can:

- Mark `IN_PROGRESS` or `COMPLETED`
- Add free-text notes
- (API also supports changing `due_date`; UI does not expose it)

**Download post-completion PDF:** firm name, matter ref, type, status, and one line per task (title, status, due, notes). Audited as `REPORT_EXPORTED`.

This is a **tracker**, not an electronic filing product. Completing a task does not submit SDLT or AP1.

---

## 7. Post-completion templates

Generated when the matter is created. Not regenerated if type later changes (type is immutable in MVP UI).

| Type | Tasks |
|---|---|
| **PURCHASE** | SDLT submission; AP1 lodgement; OS1 priority expiry tracking; Requisitions handling; Registration completed |
| **SALE** | Redemption statement; Mortgage discharge evidence (DS1/END); Undertakings tracker; Completion statement issued |
| **REMORTGAGE** | Redemption statement; Mortgage discharge evidence (DS1/END); AP1 lodgement; Registration completed |
| **TRANSFER** | ID/AML checks completed; AP1 lodgement; Restrictions / notices handling; Registration completed |

Seeded demo uses PURCHASE with due dates 7 days out.

---

## 8. Functional requirements

### Firm portal

- FR-1 Staff can log in and persist a session (access + refresh).
- FR-2 Unauthenticated visits redirect to login; authenticated root redirects to matters.
- FR-3 `ADMIN` / `FEE_EARNER` can create a matter with client and type.
- FR-4 All staff roles can list firm matters and open a dashboard.
- FR-5 Staff can create an onboarding link and queue an invite email.
- FR-6 Dashboard shows live onboarding %, missing items, documents, payments, tasks.
- FR-7 Staff can update task status and notes.
- FR-8 Staff can download a post-completion PDF for the matter.
- FR-9 Staff can download uploaded documents for their firm only.

### Client portal

- FR-10 Client can open a pack by full link or by pasting a token.
- FR-11 Client can save each of the four form sections independently and resume later (until expiry).
- FR-12 Client can upload ID, selfie, and proof of address.
- FR-13 Client sees percent complete and remaining items after every save/upload.
- FR-14 Pack is marked complete only when §6 step 4 rules are met.
- FR-15 Client can create a Stripe payment for money on account and return to the same pack.

### Platform

- FR-16 All mutations are audit-logged with firm, actor (or null for client), action, entity.
- FR-17 Auth and onboarding endpoints are rate-limited.
- FR-18 CORS only allows the configured firm and client origins.
- FR-19 Empty database seeds one demo firm, admin, client, matter, link, and purchase tasks.
- FR-20 Health check reports API + database availability.

---

## 9. Workflow acceptance criteria

A reviewer can run this path and call the MVP workflow “working”:

1. `docker compose up --build`; API healthy at `/health`.
2. Firm portal login with demo credentials succeeds.
3. Create a `PURCHASE` matter; five purchase tasks appear on the dashboard, all `PENDING`.
4. Create onboarding link; URL is `{client origin}/o/{token}`.
5. Open the link; progress starts below 100% with missing personal details, addresses, SoF, consents, and three documents.
6. Save all four form sections and upload ID, selfie, POA (PDF/JPEG/PNG, ≤10 MB). Pack shows 100% and “complete”.
7. Pay £500 with test card; after webhook, matter dashboard shows a `SUCCEEDED` (or `PROCESSING`) payment.
8. Mark one task completed with a note; PDF download includes that line.
9. Expired or invented tokens do not load a pack.
10. An `ASSISTANT` cannot create a matter but can open one and update tasks.

`scripts/smoke-test.sh` covers login + list matters only; it is not a full workflow test.

---

## 10. Known MVP gaps (explicit)

These are true of the current product and should not be treated as bugs unless scheduled:

| Gap | Implication |
|---|---|
| Matter status never leaves `ONBOARDING` | No “in conveyancing” / “completed” workflow yet |
| Invite email is console-only | Staff must copy the link for a real client |
| Backup code is not prompted in the client UI | Backup code is API-ready, unused in the happy-path UI |
| Payment is optional for completeness | A “complete” pack may have £0 on account |
| No ID verification | Uploads are stored, not checked against a person |
| Staff cannot upload from the matter page | API exists; UI does not |
| Joint client fields unused in create form | Data model supports joint names; UI does not |
| No matter search / filters | List is newest-first only |
| `onboarding-api` Java tree is unrelated | Ignore for this product |

---

## 11. Surfaces and local URLs

| Piece | URL |
|---|---|
| Firm portal | http://localhost:3000 |
| Client portal | http://localhost:3002 |
| API | http://localhost:8000 |
| OpenAPI | http://localhost:8000/docs |
| Stripe webhook | http://localhost:8000/api/v1/stripe/webhook |

Stack: Next.js PWAs (firm + client), FastAPI, Postgres, Redis, Celery worker, Stripe, local file storage.

---

## 12. Success metrics (MVP)

Qualitative until instrumentation exists:

- Time from “new matter” to “link in client’s hand” < 2 minutes for a trained user.
- Client can finish the pack in one sitting without staff intervention.
- Staff can answer “what is still missing on this file?” from the dashboard without opening email.
- Zero cross-firm data leaks (firm_id on every query).
- Webhook-updated payment status matches Stripe for test payments.

---

## 13. Open product questions

1. Should money on account be required for pack completeness, or stay optional?
2. When should matter status move (onboarding complete → in progress → completed)? Who flips it?
3. Should creating a new link revoke older tokens?
4. Should the client be forced to enter the backup code, or is the URL enough?
5. Is staff document upload in-scope for the next slice (mortgage offer, signed deed)?
6. When do we replace the console mailer with real email?

---

## 14. Competitive landscape

Research date: 2026-09-03. Sources: vendor sites plus a Perplexity pass. Perplexity correctly said **no specialist SKU matches our exact three-step package**. It then named the wrong “closest five” (CMS brands) and stayed too generic on URLs.

### 14.1 What “none in one SKU” actually means

Two different claims get mixed:

| Claim | Verdict |
|---|---|
| No **lightweight** product that is *only* magic-link pack + optional card pay + **tracker** (no HMRC/HMLR filing) | **True.** That is LexAssist’s shape. |
| No **platform** that covers onboarding + taking money + post-completion | **False.** Full conveyancing CMS already claims this — they file SDLT/AP1 rather than tick a PDF checklist. |

So: we are not inventing the workflow. We are inventing a **thin, single-file version** of a workflow firms already buy as LEAP/Hoowla/Redbrick **plus** Legl/Thirdfort/eCOS **plus** InfoTrack.

### 14.2 Market split (named)

**(1) Client CDD / onboarding** — send a link, collect ID / SoF / forms, often *verify* them.

| Product | URL | Notes |
|---|---|---|
| Legl | https://legl.com/solutions/client-onboarding | Closest client journey: ID, SoF, questionnaires, eSign, payment step in the same workflow. Not a CMS; not post-completion filing. |
| InfoTrack eCOS | https://www.infotrack.co.uk/solutions/conveyancing/electronic-client-onboarding-solutions/ | Conveyancing-specific pack: questionnaires, digital ID/AML, SoF/SoW, TA forms, eSign. Integrates Perfect Portal / CMS. |
| Thirdfort | https://www.thirdfort.com/ | ID (HMLR Digital ID / DVS), Open Banking SoF, AML screening, CMS integrations. FCA-regulated. No matter CMS, no AP1. |
| Amiqus | https://amiqus.co/ | IDSP, Safe Harbour, SoF, PEPs/sanctions, audit trail. Compliance tool, not a file. |
| Verify 365 | https://verify365.app/sectors/conveyancing-aml-for-law-firms-solicitors/ | Biometric ID, Open Banking SoF, eSign, ePayments, white-label. |
| ProConvey | https://www.proconvey.co.uk/components/digital-onboarding | Branded portal; plugs in Thirdfort/Yoti rather than owning ID. |

**(2) Payments / money on account**

| Product | URL | Notes |
|---|---|---|
| Legl Pay | https://legl.com/solutions/payments | Best analogue: payment *inside* onboarding; client vs office account; reminders; can make pack incomplete until paid. |
| Stripe (what we use) | — | Card only. Not SRA client-account compliant by itself. |

**(3) Client portals / quote-to-instruct**

| Product | URL | Notes |
|---|---|---|
| Perfect Portal | https://www.perfectportal.co.uk/ | Quote → instruct → branded app. Pairs with eCOS for ID/SoF/TA forms. Not post-completion. |
| Minerva | (Today’s Conveyancer listings) | Quotes, ID/AML, SoF, payments, eSign, CMS sync. Onboarding layer, not AP1. |

**(4) Post-completion / SDLT / AP1**

| Product | URL | Notes |
|---|---|---|
| InfoTrack post-completion | https://www.infotrack.co.uk/solutions/conveyancing/post-completion/ | Owns this layer: SDLT pre-fill, digital AP1, OS priority dates, requisitions, firm-wide dashboard (2025/26 launch). |

**(5) Full conveyancing CMS** — one product *does* span all three stages, but as a heavy case-and-accounts system, not our SKU.

| Product | URL | Notes |
|---|---|---|
| LEAP + InfoTrack | https://www.leaplegalsoftware.com/uk/area-of-law/conveyancing-software/ | Matter CMS + accounts; InfoTrack for searches, eCOS, SDLT, AP1. |
| Hoowla | https://www.hoowla.com/conveyancing-software/ | Quote → portal → SDLT/HMLR in one cloud CMS. |
| Redbrick | https://redbricksolutions.co.uk/what-we-do/ | CMS + biometric AML/SoF + SDLT + digital AP1. |
| Access Legal | https://www.theaccessgroup.com/en-gb/legal/software/case-management/conveyancing/ | CMS + portal + SDLT/HMLR integrations. |
| Convey365 | https://www.convey365.com/conveyancers/ | Volume CMS; HMLR/SDLT, payments, onboarding. |

Osprey / Proclaim are general UK practice CMS. They overlap “have a matter and tasks”; they are **not** the closest products to a magic-link AML pack.

### 14.3 Five closest to *our* workflow (corrected)

Ranked by overlap with the PRD journey (link pack + pay + post-comp list), not by CMS market share.

1. **Legl** — same client story (pack + money on account). We lose on verified ID, Open Banking SoF, eSign, client-account routing, payment-required completeness. They have no SDLT/AP1 tracker.
2. **InfoTrack eCOS + post-completion** — same two ends of the file, usually sold as one vendor, two modules, often with Perfect Portal in the middle. We lose on ID/AML/TA forms *and* real filings.
3. **Perfect Portal + eCOS** — quote-to-pack experience firms actually buy. We have no quoting, no branded app, no TA forms.
4. **Hoowla / Redbrick** (tie) — true one-platform onboarding + portal + pay + post-completion **filing**. We lose on depth; we win on simplicity if the buyer refuses a CMS migration.
5. **Thirdfort / Amiqus / Verify 365** — crush us on CDD quality; they do not try to be the matter file or the AP1 board.

Perplexity’s list (LEAP, Osprey, Proclaim, Redbrick, InfoTrack) is “who is big in UK legal software,” not “who matches this PRD.”

### 14.4 Bake-off: where we lose vs where we can stand

**We lose (do not pretend otherwise):**

1. In-line **IDSP verification** (HMLR Digital ID / Safe Harbour) and **Open Banking SoF**.
2. **SRA client-account** payments vs Stripe cards.
3. **Actual SDLT/AP1 submission**, OS1 dates, requisitions, SDLT5 attached to AP1.
4. TA forms, client-care eSign, branded apps, CMS/accounts.

**We can stand only if the buyer wants:**

- One screen for “is the pack done, is money in, what’s left after completion?”
- No LEAP/InfoTrack stack, no per-check IDSP fees
- A tracker PDF, not electronic filing

That is a **small-firm / greenfield** wedge, not a replacement for Legl or InfoTrack.

### 14.5 2025–2026 launches (confirmed enough to track)

- InfoTrack unified post-completion dashboard (SDLT + OS priority + AP1 risk)
- Legl Pay (money on account inside the onboarding workflow)
- Perfect Portal + InfoTrack eCOS (quote → app → ID/SoF/TA forms)

### 14.6 Who owns the workflow today

**The workflow is owned as a stack, not a SKU:** Perfect Portal or CMS for the file → Legl / eCOS / Thirdfort for the pack → Stripe/Legl Pay for money → InfoTrack for post-completion.

**No vendor owns our exact thin SKU.** Full CMS vendors own a *thicker* version of the same story. That is the real competitive fact: uniqueness is packaging, not the job-to-be-done.
