# PLAN.md — AI-Native CRM

Status: **Phase 0 — awaiting operator go-ahead.** No application code has been written yet. This document is the only output of Phase 0, alongside `PROGRESS.md`.

---

## 1. Recommended Tech Stack (plain-English version)

**The short version:** one web app, one database, mainstream tools, minimal moving parts.

| Layer                             | Choice                                                                                        | Why                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language                          | TypeScript (frontend + backend, one language)                                                 | You only ever have one language's ecosystem to reason about across the whole app. Every AI coding session (this one included) is more consistent and less error-prone when there's one language, not two.                                                                                                                                                           |
| App framework                     | **Next.js** (App Router), single application                                                  | Next.js serves the web pages _and_ the API/webhook endpoints from one project. That means one thing to run locally, one thing to deploy, one set of logs to check — not a frontend server and a backend server you have to keep in sync. It's one of the most widely used web frameworks in the world, so any future developer you hire can pick it up immediately. |
| Database                          | **PostgreSQL**                                                                                | The industry-standard relational database. Leads, opportunities, invoices, users — this is all naturally tabular, related data (a lead belongs to a company, an opportunity belongs to a lead), which is exactly what a relational database is built for. Every serious hosting provider supports it out of the box.                                                |
| ORM / migrations                  | **Prisma**                                                                                    | Prisma keeps the database schema in one readable file and auto-generates the code to safely change it (a "migration"). It's the most popular TypeScript database toolkit, with excellent docs — important since this project will be maintained across many independent sessions.                                                                                   |
| Styling / UI kit                  | **Tailwind CSS + shadcn/ui**                                                                  | Gives a clean, modern, consistent look out of the box without needing a designer. This directly serves the requirement that the UI must be demo-ready for prospective buyers.                                                                                                                                                                                       |
| Auth                              | Custom email/password, session stored in the database (httpOnly cookie holds a session token) | Storing sessions in the database (rather than a stateless JWT) means "log this user out" or "revoke this device" is just deleting a database row — simple to explain, simple to audit, easy to reason about for a non-engineer. Passwords hashed with bcrypt.                                                                                                       |
| Background jobs (webhook retries) | A plain Postgres table polled by a small worker loop                                          | Avoids adding Redis/a separate queue service just to retry a handful of webhook deliveries per tenant. One database to operate and back up. Can graduate to a real queue later if volume ever demands it — noted as a future upgrade, not a v1 need.                                                                                                                |
| Testing                           | **Vitest** (unit + API/integration tests via Supertest-style requests)                        | Fast, modern, near-identical API to Jest (the most common JS test runner), so it's easy for any future contributor to read.                                                                                                                                                                                                                                         |
| Local dev environment             | **Docker Compose** running just Postgres                                                      | The app itself runs with `npm run dev`; only the database needs a container. Minimizes what has to be installed on the operator's machine.                                                                                                                                                                                                                          |
| Deployment                        | **Railway** (primary recommendation) or **Render** as a fallback                              | Both take a GitHub repo and deploy a Next.js + Postgres app with almost no configuration, no Kubernetes/DevOps knowledge required, and both have generous free/cheap tiers suitable for demoing to prospects before a customer is paying.                                                                                                                           |
| Automation layer                  | **n8n** (self-hosted or n8n Cloud, operator's choice)                                         | Already specified in the product brief — the CRM talks to n8n via signed webhooks out and a token-authenticated REST API in.                                                                                                                                                                                                                                        |

### What was rejected, and why

- **Separate SPA (Vite/React) + separate Express/NestJS API** — rejected. Two servers, two deploy targets, two dev-start commands. Next.js collapses this into one without giving up anything this product needs.
- **NestJS** — rejected. Powerful, but its decorator/module/dependency-injection ceremony is overhead this project doesn't need at this scale, and it's harder for a non-engineer to have explained to them ("why are there five files for one endpoint?").
- **Django / Python backend** — rejected. Nothing wrong with it, but it would split the codebase into two languages (Python backend, JS frontend) for no benefit here, and the product's embeddable JS form snippet fits more naturally in an all-JS stack.
- **Firebase / Supabase as a full backend-as-a-service** — rejected. This product's core value is custom multi-tenant business logic, signed webhook delivery, retries, and an agent-facing API — all easier to own outright in a normal app than to bend a BaaS around. Also avoids vendor lock-in, which matters if this is ever white-labeled and resold.
- **MongoDB / a document database** — rejected. The data (accounts → contacts → leads → opportunities → invoices) is inherently relational; forcing it into documents would mean rebuilding joins by hand.
- **Redis + BullMQ for job queueing** — rejected _for v1 only_. At CRM webhook volumes (dozens to low-thousands of events/day per tenant), a Postgres-backed retry table is plenty, and it means one less service to run, monitor, and pay for. Flagged as a clean future upgrade path if a tenant's volume ever needs it.
- **GraphQL for the public API** — rejected. REST + an OpenAPI spec is what n8n's built-in HTTP Request node expects and is trivially easy to document; GraphQL adds a learning curve for the exact audience (n8n workflow builders, not developers) this API serves.

---

## 2. Full Phase List

Each phase is scoped to be buildable **and verifiable** within a fraction of one ~5-hour session. Phases are ordered so a full mock end-to-end journey (§5 of the master prompt) is working by the end of Phase 12 — after that, phases go back and deepen individual modules.

- **Phase 0 — Plan** _(this document + PROGRESS.md; no code)_
- **Phase 1 — Project scaffolding & tooling.** Next.js + TypeScript app initialized, ESLint/Prettier, Tailwind + shadcn/ui installed, Vitest wired up, Docker Compose for local Postgres, `.env.example`, `.gitignore` (with `.env` excluded from commit one), git repo initialized, first commit. Verify: `npm run dev` boots, a trivial health-check test passes.
- **Phase 2 — Database & multi-tenancy foundation.** Prisma installed, schema for `Tenant`, `User`, `Session`; first migration; a seed script that creates one demo tenant + one admin user. Verify: migration runs clean on a fresh DB, seed script runs, a test reads the seeded row back.
- **Phase 3 — Auth.** Signup, login, logout, session-cookie middleware, tenant-scoping (every query scoped to the caller's tenant), admin/member roles. Verify: automated tests for signup/login/logout/unauthorized-access-rejected.
- **Phase 4 — Core CRM data model & CRUD.** `Contact`, `Lead`, `Opportunity`, `Activity` tables; CRUD API endpoints for each, tenant-scoped; a stubbed dedupe-check interface (real matching logic deferred to Phase 14). Verify: one automated test per endpoint (create/read/update/list, and a tenant-isolation test — tenant A cannot read tenant B's data).
- **Phase 5 — Minimal UI shell.** Login/signup pages, authenticated app layout, nav, empty-state screens for contacts/leads/opportunities. No lorem ipsum. Verify: manual click-through of signup → login → see empty dashboard.
- **Phase 6 — Embeddable form builder v1.** Form definition (fields config), embed snippet generator (script tag), public submission endpoint with honeypot + rate limiting, creates a `Lead` + `Contact`. Verify: test posts a submission and confirms a lead is created; a spam-shaped request (honeypot filled) is rejected; a rate-limit test.
- **Phase 7 — Webhooks out.** Event envelope (id, type, timestamp, tenant id, payload) + HMAC signing, `WebhookEndpoint` config per tenant, `WebhookDelivery` log with retry/backoff via the Phase-1 job table, emits `lead.created` and `form.submitted`. `EVENTS.md` written. Verify: test triggers an event, confirms signature, confirms retry on simulated failure, delivery log visible.
- **Phase 8 — Public API in (n8n-facing).** Per-tenant API keys, token-auth middleware, REST endpoints for create/read/update on leads/contacts/opportunities/activities/call bookings. OpenAPI spec generated. `API.md` written. Verify: automated test per endpoint using an API key instead of a session cookie.
- **Phase 9 — Calendar integration interface.** `CalendarProvider` interface, `MockCalendarProvider` implementation, `CallBooking` model, booking endpoint, emits `call.booked`. Verify: test books a mock call and confirms the event fires.
- **Phase 10 — n8n Sales Agent reference flow.** Importable workflow JSON + setup guide in `/n8n-flows/`: `lead.created` webhook → triage (scoring rules, LLM step optional) → call CRM booking API for an open slot → book the call → notify the rep (placeholder node) → write triage outcome back to the lead via the Phase-8 API. **This closes the first half of the end-to-end thin slice.** Verify: manual run of the imported flow against a local CRM instance using a mock lead.
- **Phase 11 — Opportunity pipeline UI + stage events.** Kanban board (stage columns, drag to move), configurable `PipelineStage` per tenant, emits `opportunity.created`, `opportunity.stage_changed`, `opportunity.closed_won`, `opportunity.closed_lost`. Verify: UI test/manual click-through moving a card through stages fires the right events (checked in the delivery log).
- **Phase 12 — n8n Finance Agent reference flow.** Importable workflow JSON + setup guide: `opportunity.closed_won` webhook → create an `Invoice` record via the CRM API (placeholder node marked for a real accounting-tool swap later) → logs the action to the opportunity's timeline. **This completes the full end-to-end mock journey described in the master prompt's §5.** Verify: manual run end-to-end — form submission through to an invoice record appearing on the opportunity.
- **Phase 13 — Dashboard & reporting.** Pipeline value by stage, stage-to-stage conversion rates, lead-source breakdown, leads-created/deals-closed time series. Verify: seed known data, assert the computed numbers match by hand.
- **Phase 14 — Lead dedupe matching.** Real matching on email/phone/company with a fuzzy fallback (e.g. trigram similarity in Postgres), enrichment-hook interface (no live provider yet). Verify: tests for exact match, fuzzy match, and no-false-positive cases.
- **Phase 15 — Real calendar providers.** `GoogleCalendarProvider` and `OutlookCalendarProvider` implementing the Phase-9 interface, behind OAuth. **BLOCKED by design until the operator supplies real OAuth credentials** — will be marked `BLOCKED` in `PROGRESS.md` until then, mock provider remains the default.
- **Phase 16 — Demo data & script.** Full demo-tenant seed script with realistic sample data across every module; `DEMO.md` 5-minute walkthrough script. Verify: run the seed on a clean DB, follow the script personally.
- **Phase 17 — Hardening pass.** Rate limiting on all public endpoints, an audit log for sensitive actions, polish of remaining empty states and error states, finalize `README.md` and deployment docs. Verify: re-run full test suite, manual pass through the demo script end-to-end.
- **Later / backlog** — anything surfaced during the above that's real but not urgent gets logged here rather than silently added to scope.

---

## 3. CRM ↔ n8n Event Contract (draft — for operator sanity-check)

### Envelope (CRM → n8n)

```json
{
  "event_id": "evt_01HXYZ...",
  "event_type": "lead.created",
  "api_version": "2026-07-22",
  "occurred_at": "2026-07-22T14:03:00.000Z",
  "tenant_id": "tnt_01HABC...",
  "data": { "...entity payload, shape depends on event_type..." }
}
```

- Delivered as an HTTP POST to the tenant's configured n8n webhook URL(s).
- Header `X-CRM-Signature: sha256=<hex hmac>` — HMAC-SHA256 over the raw request body, keyed with a per-tenant webhook secret, so the n8n flow can verify the request really came from this CRM.
- Header `X-CRM-Event-Id` duplicated for easy access without parsing the body.

### Delivery guarantees

- At-least-once delivery. Retries on non-2xx response or timeout: backoff schedule **1m → 5m → 30m → 2h → 24h**, then marked `failed` after 5 attempts.
- Every attempt (success or failure) is recorded in a `WebhookDelivery` log, visible in the CRM admin UI, including the response status/body received, so the operator can debug a flow without touching a database.
- Events are not deleted after delivery — the log is the audit trail.

### v1 event types

`lead.created`, `lead.updated`, `lead.status_changed`, `opportunity.created`, `opportunity.stage_changed`, `opportunity.closed_won`, `opportunity.closed_lost`, `call.booked`, `form.submitted`. (Extensible — new event types are additive, never break existing subscribers.)

### n8n → CRM (API in)

- REST API, versioned path (`/api/v1/...`), authenticated with a per-tenant API key (`Authorization: Bearer <key>`) — separate from the human session-cookie auth.
- Covers create/read/update on leads, contacts, opportunities, activities, call bookings — everything the reference n8n flows need.
- Full OpenAPI spec shipped so the URL + fields can be pasted straight into n8n's HTTP Request node.

_(Full field-level schemas per event/entity will be finalized in Phase 7/8 as the actual database columns exist — this section is the shape, not the final field list.)_

---

## 4. Data Model Sketch

Every business table below carries a `tenant_id` foreign key (multi-tenant from day one). Rough entity list:

- **Tenant** — id, name, plan, created_at
- **User** — id, tenant_id, email, password_hash, role (`admin`/`member`), created_at
- **Session** — id, user_id, token_hash, expires_at
- **Contact** — id, tenant_id, first_name, last_name, email, phone, company, dedupe_key, created_at
- **Lead** — id, tenant_id, contact_id, source, status, owner_user_id, score, created_at, updated_at
- **PipelineStage** — id, tenant_id, name, sort_order, is_won, is_lost _(configurable per tenant)_
- **Opportunity** — id, tenant_id, contact_id, lead_id (nullable), name, stage_id, value, currency, probability, owner_user_id, expected_close_date, closed_at
- **Activity** — id, tenant_id, entity_type, entity_id, type, payload, created_at _(generic timeline/audit entries — notes, status changes, agent actions)_
- **CallBooking** — id, tenant_id, lead_id/opportunity_id, provider, external_event_id, starts_at, ends_at, attendee_email, status
- **Form** — id, tenant_id, name, fields_json, embed_key
- **FormSubmission** — id, tenant_id, form_id, payload_json, lead_id, ip_address, created_at
- **WebhookEndpoint** — id, tenant_id, url, secret, is_active
- **WebhookDelivery** — id, tenant_id, webhook_endpoint_id, event_type, payload_json, status, attempts, next_attempt_at, last_error, created_at
- **ApiKey** — id, tenant_id, key_hash, name, created_at, last_used_at
- **Invoice** — id, tenant_id, opportunity_id, amount, currency, status, external_ref, created_at _(Finance Agent placeholder — not a real accounting integration in v1)_

Relationships in short: a `Tenant` has many `User`s, `Contact`s, `Lead`s, `Opportunity`s, etc. A `Contact` can have many `Lead`s and `Opportunity`s over time. A `Lead` can convert into an `Opportunity`. Every `Opportunity` sits in exactly one `PipelineStage` at a time, and stage changes are what drive the Kanban board and the `opportunity.stage_changed` event.

---

## 5. Explicit Non-Goals for v1

To keep scope from creeping, the following are **not** being built in v1:

- No mobile app (responsive web only).
- No built-in email/marketing drip campaigns — that's n8n's job, not the CRM's.
- No built-in phone/VoIP dialer.
- No custom/ad-hoc report builder — a fixed set of dashboard reports only (§ Phase 13).
- No SSO/SAML — email/password only.
- No granular per-field permissions — just `admin`/`member` roles.
- No real payment processing or accounting-system integration — the Finance Agent flow creates an internal `Invoice` record and a placeholder step marked for a future Xero/QuickBooks/Stripe swap.
- No native mobile push notifications.
- No multi-currency conversion/FX — currency is stored per record, no conversion math.
- No per-tenant white-label theming — single consistent branding in v1 (a plausible post-v1 upsell feature).
- No offline mode / PWA support.

---

## 6. What Happens Next

This document and `PROGRESS.md` are Phase 0's only output. No application code, no `npm init`, no git repository has been created yet. Waiting for operator go-ahead before starting Phase 1.
