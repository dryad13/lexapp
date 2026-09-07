# LexAssist Workspace

## Overview

pnpm workspace monorepo hosting the LexAssist UK legal practice management platform (conveyancing + immigration). Full-stack with React frontend + Express backend + PostgreSQL.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS v4 (`artifacts/lexassist/`)
- **Backend**: Express 5 + tsx (`artifacts/api-server/src/lexassist/`)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod, drizzle-zod
- **AI**: OpenAI via Replit AI Integrations proxy (`AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY` auto-provisioned). Falls back to `OPENAI_API_KEY` if set.

## Integrations

- **OpenAI**: Connected via Replit AI Integrations (no key management needed). Powers `/api/ai/suggest`, AI email drafting, AI enquiry generation, AI document analysis.
- **Outlook / Microsoft 365**: NOT connected. User chose to skip on 2026-04-18. To enable email send + calendar push later, either reconnect via the Microsoft Outlook integration or supply `MS_TENANT_ID` / `MS_CLIENT_ID` / `MS_CLIENT_SECRET` as secrets and wire Microsoft Graph manually.

## Key Architecture

- **Frontend** runs on the port defined by `$PORT` env var (set by Replit, currently 21560)
- **API server** runs on port 8080
- **API proxy**: Vite proxies `/api/*` and `/uploads/*` to `localhost:8080`
- **Auth**: Bearer token auth — in-memory session map in `index.ts`
- **Encryption**: `ENCRYPTION_KEY` (64-char hex) must be set — encrypts `clientName`, `clientEmail`, `propertyAddress` fields

## Schema

- **Server schema**: `artifacts/api-server/src/shared/schema.ts` (Drizzle ORM — used by backend)
- **Frontend schema**: `artifacts/lexassist/src/shared/schema.ts` (TypeScript types only — no drizzle-orm, used by React app)
- Both are aliased as `@shared` in their respective build configs

## Database Tables (21 tables)

organisations, users, matters, tasks, draft_emails, reminders, journal_entries, time_entries, documents, enquiry_packs, audit_logs, knowledge_resources, enquiries_library, enquiries_builder_packs, financial_items, matter_financials, control_checks, rule_templates, risk_assessments, conversations, messages

## Features

- **Department-based views**: Users have a `department` field ("conveyancing", "immigration", or "both"). Sidebar nav, matter types, and resources are filtered by department. Admin sets department when creating/editing users.
- **Immigration matter types**: visa_application, asylum, appeal, settlement, naturalisation — each with immigration-specific workflow stages (Client Intake → Document Collection → Eligibility Assessment → Application Preparation → Application Submission → Awaiting Decision → Decision Received → Post-Decision Actions → Closed).
- **Conveyancing matter types**: purchase, sale, remortgage — with existing conveyancing workflow stages.
- **Immigration Assessment**: Navigation item linking to `/immigration` — embeds the Immigration Eligibility Assessment tool (HTML file in `public/immigration-tool.html`). Restyled to match app theme (dark green #1A4235, cream #F5F0E6, Playfair Display + Plus Jakarta Sans fonts).
- **Immigration Manual**: Listed as a Tier 1 resource in the Resources page. Restyled to match app theme. Only visible to immigration/both department users.
- **Matter deletion**: Admin users can delete matters from the detail page (red Delete button with confirmation dialog). Only `admin` role has `canDeleteMatters` permission.
- **Auto-delete on completion**: When a matter's status is changed to "completed", the matter and all associated data are automatically deleted. The frontend shows a toast and redirects to the matters list.

## Seed Data

On startup the api-server seeds:
- Organisation: "Gardner Champion"
- Users: `admin`/`admin12` (admin, dept: both), `zaid.khan`/`HU51BAN` (admin, dept: both), + 3 more (conveyancing)
- Matters: clean slate (no pre-seeded matters — users create their own)
- 61 compliance rule templates
- 105 enquiries library items

## Key Commands

- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/lexassist run dev` — run frontend locally

## Environment Secrets

- `ENCRYPTION_KEY` — 64-char hex string (set as shared env var)
- `SESSION_SECRET` — session secret (set as Replit secret)
- `OPENAI_API_KEY` or `AI_INTEGRATIONS_OPENAI_API_KEY` — for AI features (optional)
