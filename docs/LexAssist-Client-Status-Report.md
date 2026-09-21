# LexAssist — Client Status Report

**Prepared for:** Client stakeholders  
**Prepared by:** Ally Abdullah Zafar  
**Date:** 22 September 2026  
**Audience:** Non-technical decision-makers  

---

## In one page

LexAssist is now a **firm-ready practice system**: staff can run conveyancing and immigration matters in one place, with proper logins, firm walls so one organisation cannot see another’s files, reliable PDF exports, and a quality bar we have verified end-to-end.

**The product is ready for a controlled pilot** once live hosting, keys, and firm setup are switched on.

**The main remaining product build before full go-live is Laya** — a UK-hosted decision engine that sorts and flags work in seconds (document types, search enquiries, checklist answers), while solicitors keep ownership of every client-facing draft. Hosting the app, client data, and Laya in the **United Kingdom** is how we meet regulated-firm expectations under UK data protection law. Laya’s heavier compute can run on **GPU capacity that turns on only when needed**, so you pay for power when the firm is actually using AI triage — not for idle machines around the clock.

---

## What LexAssist can do today

### Day-to-day practice work

- **One Matters workspace** for conveyancing and immigration — staff pick the practice area, then see the right matter types and stages for that work.
- **Immigration that matches real firm process** — induction through eligibility, advice, forms, fees / IHS, biometrics, outcome, and appeal where needed, including an AML check early in the journey.
- **Conveyancing unchanged in spirit** — purchase, sale, and remortgage keep their familiar flow and enquiry tools.
- **Reminders, draft emails, journal, compliance checks, and finances** available on the matter, with exports that complete reliably in the background rather than hanging on screen.

### Safety and multi-firm readiness

- Staff sign in with proper sessions (not a throwaway demo login).
- **Each firm only sees its own matters** — another organisation on the same platform cannot open your files.
- Roles control who can edit, who can only view, and who can manage users.
- Login protections (including stronger passwords, account lockout after repeated failures, and optional admin multi-factor checks).
- A **platform console** so LexAssist operators can open or suspend a firm and reset admin access **without** browsing client papers.
- Billing hooks are in place for firm subscriptions.

### Public face and brand

- The practice app and marketing site share LexAssist branding, so staff move from the public site into the product as one company.

### Quality we can stand behind

- Automated checks across the core journeys (login, matters, immigration, isolation between firms, reminders, exports, and accessibility on key screens) have been re-run successfully. Known critical defects on the tracked list are **closed**. What remains before a live pilot is mainly **turning on production hosting correctly** — not fixing broken core features.

---

## Honest readiness

| Question | Plain answer |
|----------|----------------|
| Can a pilot firm use this build? | **Yes**, once live servers, secure keys, and the first firm admin are set up. |
| Are critical product defects still open? | **No** — the tracked critical list is clear. |
| Is full go-live “done”? | **Not yet.** Laya (plus solicitor-approved wording on how AI is used with client data) is the remaining product track. |
| What must you arrange outside the app code? | UK hosting, Redis/session backing in production, AI keys where writing AI is used, and firm onboarding through the platform console. |

---

## What Laya is (and is not)

**Laya is a decision engine, not a chatbot and not a replacement solicitor.**

Think of two kinds of AI work inside LexAssist:

| Kind of work | What it does | Who should do it |
|--------------|--------------|------------------|
| **Decide** (Laya) | Chooses from clear options very quickly — “this looks like an EPC”, “these three enquiries look triggered”, “this risk item looks Yes / No / N/A”, “open the search workflow next” | Fast, structured, UK-hosted engine |
| **Draft** (writing AI or the fee earner) | Writes letters, packs, and narrative advice | Always under solicitor review |

Laya does **not** invent legal advice or send client letters on its own. It **sorts and flags** so staff spend less time waiting on slow “write me everything” AI for work that is really triage.

### How integrating Laya helps LexAssist

1. **Faster matter progress** — documents get typed, searches get flagged, and checklists get suggested answers while the fee earner stays in control.  
2. **Fits how conveyancing already works** — enquiry libraries, risk / GRACE-style gates, and Yes/No forms are natural homes for a decision engine.  
3. **Better drafts when you do need prose** — writing AI (or the solicitor) starts from the right document types and flags, instead of guessing.  
4. **Confidence with a human override** — when Laya is sure, it can suggest automatically; when it is unsure, it asks. Nothing silent should file a judgement call.  
5. **Pilot-friendly** — firms can switch Laya on when ready; others are unaffected.  
6. **Stronger regulated-firm story** — triage can stay on **infrastructure you control in the UK**, rather than sending every sorting decision to a third-country consumer AI service.

### First places we would switch Laya on

1. Suggesting **document type** on upload  
2. Flagging which **standard enquiries** a search pack seems to trigger  
3. Proposing **risk / checklist** answers for the fee earner to confirm  
4. **Routing** the assistant to the right workflow before any long draft  

Emails and narrative packs still use a writing model (or a human), with solicitor sign-off.

---

## UK hosting, GDPR, and client data

UK law firms handle **personal data and often special-category / sensitive client information**. Under **UK GDPR** and related professional expectations, you need a clear story on:

- **Where the data lives** (residency)  
- **Who can process it** (processors and sub-processors)  
- **Why it is processed** (purpose — running the matter, not training a public model by accident)  
- **What leaves the UK** (if anything) when AI is used  

**Our recommended operating model for LexAssist + Laya:**

| Layer | Where it should run | Why it matters to the client |
|-------|---------------------|------------------------------|
| LexAssist application and database | **United Kingdom** | Matter files, staff accounts, and firm records stay in UK hosting under your control and contracts. |
| Laya decision service | **United Kingdom**, next to the app | Triage decisions on documents and searches do not need to leave the UK to a foreign consumer AI platform. |
| Writing / drafting AI (if used) | Chosen model under a **written compliance review** | Prose may still use a writing service; that path must be named, limited, and covered in engagement / privacy wording — Laya does not replace that legal review. |

**Important clarity for the client:** putting Laya and the app in the UK is a **strong technical foundation** for UK GDPR. It does **not** by itself finish compliance. The firm’s solicitor partner still needs to approve how AI is described to clients, what is logged, retention, and which processors are used. Removing names from a file (“de-identification”) alone is **not** enough if the remaining content can still identify someone in context.

---

## On-demand GPU for Laya (cost and control)

Running a decision engine well often needs **GPU** hardware — specialised computers that answer many classification questions quickly. Keeping a large GPU switched on 24/7 can be expensive if the firm only uses AI triage during office hours or peaks.

**On-demand GPU** means:

- Capacity **starts when Laya needs it** (busy periods, batch triage, pilot spikes).  
- Capacity **scales down or off when idle**, so you are not paying full price for silent machines overnight.  
- The service still sits in the **UK hosting region** you choose for LexAssist — residency does not require leaving machines on forever; it requires that when they run, they run **in the UK under your arrangement**.

**Client benefit in plain terms:** you get fast UK-based triage when the team is working, without locking into always-on GPU cost from day one. As usage grows, the same model can stay UK-hosted and simply run more often.

---

## What we ask of you next

1. Treat **Laya on UK hosting (with on-demand GPU)** as the remaining implementation track before full go-live.  
2. Confirm the solicitor partner will own **AI and privacy wording** in parallel (decide vs draft; what data may leave UK writing services, if any).  
3. Approve pilot scope: start with **document typing + search/enquiry flags**, then risk assist.  
4. Approve **UK hosting** for the app, database, and Laya as the default architecture for regulated pilots.

---

## Bottom line for the client

LexAssist is **ready to pilot as a practice system**: immigration and conveyancing in one product, firm-safe access, reliable exports, and a verified quality bar.

**Full go-live strength for regulated firms comes from the next step:** integrate **Laya** as a fast decision layer, host the **app, data, and Laya in the United Kingdom** to meet UK GDPR expectations on residency and control, and run Laya’s compute on **on-demand GPU** so performance and cost stay aligned with real firm usage — with solicitors keeping ownership of every client-facing draft.
