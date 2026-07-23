# PROGRESS.md — AI-Native CRM

**Project:** AI-native, multi-tenant CRM with bidirectional n8n automation integration, built to be sold to other businesses.
**Started:** 2026-07-22
**Operator:** solo, non-technical founder (checks in ~once per 5-hour session via remote desktop).

## Standing constraints acknowledged (from the master prompt)

- Never delete files outside this project directory.
- Never commit secrets — `.env` is gitignored from the first commit.
- Commit after every _verified_ milestone, with clear messages.
- Never mark a phase done without running its verification step. Unverifiable → `BLOCKED`, stated explicitly, never faked or silently stubbed.
- No system-wide installs without flagging it prominently here.
- No outbound calls to real third-party services with live data until the operator has explicitly confirmed credentials/consent here.
- Re-read the master prompt and this file at the start of every session.
- If stuck on the same error for ~30 minutes, stop, log under `## STUCK`, move to other unblocked work.

---

## Phase Log

### Phase 0 — Plan — **DONE**

- Read the master prompt in full.
- Confirmed the project directory (`c:\Projects\CRM`) was empty before writing anything.
- Confirmed local tooling available: Node v22.20.0, npm 10.9.3, Git 2.53.0. No repository initialized yet — deliberately deferred to Phase 1 per the master prompt (Phase 0 is plan-only, no code/scaffolding).
- Produced `PLAN.md`: tech stack + rejected alternatives, full phase list (0–17 plus backlog), draft CRM↔n8n event contract, data model sketch, explicit v1 non-goals.
- **DECISIONS:**
  - Single Next.js app (not separate frontend/backend) — simplest deploy/maintenance story for a solo non-technical owner.
  - Postgres-backed job table for webhook retries instead of Redis/BullMQ — one less service to run; can upgrade later if volume demands it.
  - Session-based auth (DB-stored sessions, httpOnly cookie) instead of stateless JWT — makes "log this user out" a simple, explainable DB delete.
  - Full end-to-end mock journey (form → triage → booking → notify → opportunity → closed-won → invoice → dashboard) targeted to be complete by end of Phase 12, not deferred to the very end.
- **NEEDS FROM OPERATOR:** none outstanding — resolved below.
- **RESOLVED:** Operator provided `https://github.com/jamil-the-coder/CRM` as the project's GitHub repo (confirmed empty via `git ls-remote`). Operator chose to proceed straight into Phase 1 without a separate PLAN.md review pass, and pre-authorized this repo specifically for **auto-push after every verified milestone/phase** — no per-push confirmation needed going forward for this repo. (Standing rule on confirming pushes still applies to any _other_ remote/repo not covered by this authorization.)
- **Next phase:** Phase 1 — Project scaffolding & tooling — starting now.

### Phase 1 — Project scaffolding & tooling — **DONE**

- Initialized git (`main` branch), added `https://github.com/jamil-the-coder/CRM.git` as `origin`.
- Scaffolded a Next.js 16 app (App Router, TypeScript, `src/` layout, `@/*` import alias) via `create-next-app`, then renamed the npm package from the auto-derived `crm-app` to `crm` (npm doesn't allow uppercase names, and the folder is `CRM`).
- Installed and initialized Tailwind CSS v4 + shadcn/ui (`base-nova` preset, Radix base, Lucide icons) — one example `Button` component generated to confirm the pipeline works end-to-end.
- Installed and wired up ESLint (came with the Next.js scaffold), Prettier (with `prettier-plugin-tailwindcss` for class sorting), and Vitest (Node environment, `@/*` alias resolved via `vitest.config.ts`).
- Added `docker-compose.yml` for a local Postgres 16 container (used starting Phase 2) and validated it with `docker compose config`.
- Added `.env.example` (tracked) and confirmed `.gitignore` excludes real `.env*` files while still tracking `.env.example`.
- Added a minimal health-check: `src/lib/health.ts` + `src/lib/health.test.ts` (Vitest) and a real `GET /api/health` route.
- Added `npm run test`, `test:watch`, `format`, `format:check` scripts; wrote `README.md` covering local setup.
- **Verified (all passing):**
  - `npm run test` → 1/1 tests pass.
  - `npm run lint` → clean.
  - `npx tsc --noEmit` → clean.
  - `npm run dev` → started successfully; `curl localhost:3000` returned 200, `curl localhost:3000/api/health` returned `{"status":"ok",...}`. Dev server process stopped afterward.
  - Reviewed `git status` before committing — confirmed no `.env`, `node_modules`, or other secrets were staged.
- **Problems hit & resolved:**
  - `create-next-app .` refused to run because the directory name `CRM` has uppercase letters (invalid npm package name) — worked around by scaffolding into a temp subdirectory with a lowercase name, then moving the generated files up to the project root and renaming the package in `package.json`.
  - `shadcn@latest init -b neutral` failed — the `-b`/`--base` flag now selects the _component library_ (`radix`/`base`/`aria`), not a Tailwind base color, in this shadcn CLI version. Used `-d` (defaults) instead.
  - `npm install -D @vitejs/plugin-react` hit an unresolvable peer-dependency conflict from a prerelease `@babel/core@8` chain pulled in transitively. Skipped that package for now — not needed for the current Node-environment health-check test — and will revisit when component-level tests are actually needed (Phase 5+).
  - `npm audit` reports 3 (later 6) vulnerabilities in `postcss`/`sharp`, bundled transitively inside `next`. The suggested `npm audit fix --force` would downgrade Next.js from v16 to v9 — clearly the wrong fix for a false-positive-shaped resolution path. Left as-is; flagging here for the operator rather than silently forcing a bad downgrade.
- **DECISIONS:**
  - Skipped `@vitejs/plugin-react`/component-testing setup for now (see above) — plain Vitest in Node environment is sufficient until real React components need testing.
- **NEEDS FROM OPERATOR:** none blocking. For awareness only: the `npm audit` findings above are transitive/likely false-positive for this Next.js version; no action taken.
- Committed as `Phase 1: project scaffolding & tooling [verified]` and pushed to `origin/main` (pre-authorized).
- **Next phase:** Phase 2 — Database & multi-tenancy foundation (Prisma schema for `Tenant`/`User`/`Session`, first migration, seed script).

### Phase 2 — Database & multi-tenancy foundation — **DONE**

- Started local Postgres 16 via Docker Compose (had to start Docker Desktop itself first — it wasn't running).
- Installed Prisma 7 and initialized it. Defined the schema: `Tenant`, `User` (role `ADMIN`/`MEMBER`), `Session` — every business table already carries `tenant_id` per the multi-tenant-from-day-one rule, with `onDelete: Cascade` so deleting a tenant cleans up its users/sessions.
- Ran the first migration (`20260722194650_init`) against a freshly created database container — applied cleanly.
- Wrote an idempotent seed script (`prisma/seed.ts`, uses `upsert`) that creates one demo tenant + one admin user (`admin@demo.test` / `demo-password-123`, password hashed with bcrypt, never stored in plain text).
- Added a shared Prisma client singleton at `src/lib/db.ts` (avoids exhausting DB connections from Next.js dev-mode hot reload).
- Wrote automated tests (`src/lib/db.test.ts`) that hit the real local database and read the seeded tenant back through its relation to the admin user — this is the "test reads the seeded row back" verification step.
- Updated `README.md` with the DB setup steps and demo login.
- **Verified (all passing):**
  - `npx prisma migrate dev --name init` → applied cleanly against a brand-new Postgres container.
  - `npm run db:seed` → ran successfully, idempotent (safe to re-run).
  - `npm run test` → 3/3 tests pass, including two that read real seeded data back from Postgres.
  - `npm run lint` and `npx tsc --noEmit` → both clean.
- **Problems hit & resolved:**
  - Docker Desktop wasn't running — started it and waited for the engine before `docker compose up -d` would work.
  - Prisma 7 changed its default client generator (`prisma-client`, not the old `prisma-client-js`) and now **requires an explicit driver adapter** — `new PrismaClient()` with no arguments throws at runtime. Installed `@prisma/adapter-pg` + `pg` and wired `PrismaPg` into `src/lib/db.ts`. (Prisma also auto-installed a set of AI-assistant reference-doc "skills" into `.claude/`, `.agents/`, `.windsurf/` during `prisma init` — kept them out of git since they're regenerable vendor documentation, not project source, and having 3 duplicate copies would just be repo bloat.)
  - Prisma 7's seed command needs to be configured in `prisma.config.ts` (`migrations.seed: "tsx prisma/seed.ts"`), not `package.json`'s old `prisma.seed` field — found the exact syntax in Prisma's own bundled reference docs.
  - Attempted `prisma migrate reset --force` as an extra belt-and-suspenders verification step (wipe + reapply from scratch). **Prisma's own CLI detected it was being run by an AI agent and refused, requiring explicit human consent first** since it's a destructive, irreversible action — correctly so, per this project's own hard rule against destructive actions without confirmation. No data was touched. This extra check wasn't actually necessary anyway: the migration had already been verified against a genuinely fresh database moments earlier when the container was first created, so I skipped it rather than interrupt the session to ask permission for a redundant step.
- **DECISIONS:**
  - Made `User.email` globally unique (not scoped per-tenant) — simplest login flow for v1 (look up user by email, get tenant from the relation), matching the "single tenant per user" pattern of most solo-signup SaaS tools. Revisit only if a real customer needs one person across multiple tenants.
  - Tests currently run directly against the local dev Postgres database (via `.env`'s `DATABASE_URL`), not an isolated test database — acceptable at this stage since it's just seeded demo data, but flagged here as something to reconsider once tests start creating/deleting real-looking records that could collide with manual testing.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 2: database & multi-tenancy foundation [verified]` and pushed to `origin/main`.
- **Next phase:** Phase 3 — Auth (signup/login/logout, session-cookie middleware, tenant scoping, admin/member roles).

### Phase 3 — Auth — **DONE**

- Built `src/lib/auth.ts`: password hashing (bcrypt, cost 12), session token generation/verification, cookie helpers, and account-lockout tracking.
- Built four endpoints: `POST /api/auth/signup` (creates a new tenant + its first admin user), `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- Added a migration for `User.failedLoginAttempts` / `User.lockedUntil` to support account lockout.
- Wrote 10 automated tests covering signup, duplicate email, weak password, the full login→me→logout lifecycle, unauthenticated access, enumeration-resistant error messages, and the lockout threshold.
- Updated `README.md` and `.env.example` with the auth setup step and endpoint docs.
- **Verified (all passing):** `npm run test` (10/10), `npm run lint`, `npx tsc --noEmit` — all clean.
- **Security review performed (this was requested explicitly this session):**
  - Passwords: bcrypt cost 12, `passwordHash` confirmed (via grep) to never appear in any API response.
  - Sessions: opaque random 256-bit tokens; only an **HMAC-SHA256 of the token (keyed with `SESSION_SECRET`)** is stored in the DB — a leaked database dump alone can't be replayed as a valid session without also knowing the secret. Cookies are `httpOnly`, `sameSite=lax`, and `secure` in production.
  - **Found and fixed a timing side-channel during the review:** the login endpoint originally returned immediately (skipping the bcrypt compare) when an email didn't exist, meaning a "no such account" response was measurably faster than a "wrong password" response — this would let an attacker enumerate valid emails purely from response time. Fixed by always running a bcrypt compare (against a fixed dummy hash when there's no matching user) so timing is consistent either way, confirmed both paths now return an identical generic error message.
  - Brute force: per-account lockout (5 failed attempts → 15 min lock), tracked in the DB. Broad IP-based rate limiting across all public endpoints is intentionally deferred to the Phase 17 hardening pass already in `PLAN.md`, not an oversight — flagging here so it isn't forgotten.
  - Race condition: duplicate-email signups racing between the existence check and the create transaction are caught via the DB's unique constraint (Prisma error `P2002`) and returned as a normal 409, not a 500.
  - Checked `npm audit` after adding `bcryptjs`, `zod`, `pg`, `@prisma/adapter-pg` — none of these introduced new advisories; the only findings are the same pre-existing Next.js-bundled ones from Phase 1 plus one new dev-only CLI tool dependency (shadcn's bundled MCP SDK, not shipped in the app).
- **DECISIONS:**
  - Sessions stay fixed-duration (7 days) with no rolling renewal in v1 — simplest to reason about; can add renewal later if it becomes a usability complaint.
  - No password complexity rules beyond a 10-character minimum — follows current NIST guidance (favor length + rate limiting/lockout over forced complexity).
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 3: auth [verified]` and pushed to `origin/main`.
- **Next phase:** Phase 4 — Core CRM data model & CRUD (`Contact`, `Lead`, `Opportunity`, `Activity`, tenant-scoped endpoints, dedupe-check stub).

### Phase 4 — Core CRM data model & CRUD — **DONE**

- Added `Contact`, `Lead`, `Opportunity`, `Activity` models — every one carries `tenant_id`, cascade-deletes with its tenant.
- Built tenant-scoped CRUD API routes for all four (list/create/read/update/delete; `Activity` is list/create only — it's an append-only timeline).
- Lead status changes and opportunity stage changes (including `closed_won`/`closed_lost`) write to the `Activity` timeline using the same event names PLAN.md's webhook contract already specifies (`lead.status_changed`, `opportunity.stage_changed`, etc.) — Phase 7 will wire these straight into outbound webhooks.
- Added a stub dedupe interface (`src/lib/dedupe.ts`): exact email/phone match, flags possible duplicates in the create response without blocking creation. Real fuzzy/trigram matching is Phase 14, as planned.
- Added a shared `requireSession()` auth guard (`src/lib/api-auth.ts`) and a test-support helper (`src/lib/test-support.ts`, spins up a fresh tenant+session for a test) — both reused across all four entities' route/test files rather than duplicating the pattern each time.
- **Verified (all passing):** `npm run test` (20/20 — create/read/update/delete per entity, cross-tenant `contactId`/`leadId` rejected on create, and dedicated tenant-isolation tests confirming a second tenant gets 404 for another tenant's records across GET/PATCH/DELETE/list), `npm run lint`, `npx tsc --noEmit`.
- **Problems hit & resolved:**
  - Prisma 7's stricter JSON input typing rejected a plain `Record<string, unknown>` for the `Activity.payload` field — fixed by casting through `Prisma.InputJsonValue` at the two call sites that build it.
- **Security note:** tenant isolation is enforced by scoping every single-record lookup with `findFirst({ where: { id, tenantId } })` rather than `findUnique({ where: { id } })` — an attacker who guesses/knows another tenant's record ID gets an identical 404 to a nonexistent ID, never a 403 that would confirm the record exists.
- **DECISIONS:**
  - `Opportunity.stage` is a plain string for now (`"new"`, `"closed_won"`, `"closed_lost"`, etc.), not a foreign key to a stages table — `PipelineStage` (configurable per-tenant stages) is explicitly a Phase 11 concern per `PLAN.md`; introducing it now would be premature.
  - Dedupe-flagging is informational only (returns `possibleDuplicates` alongside the created contact) rather than blocking creation — matches the product spec's "dedupe hooks" framing; a hard block would need a UI to resolve/merge duplicates that doesn't exist yet.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 4: core CRM data model & CRUD [verified]` and pushed to `origin/main`.
- **Next phase:** Phase 5 — Minimal UI shell (login/signup pages, authenticated layout, empty states for contacts/leads/opportunities).

### Phase 5 — Minimal UI shell — **DONE**

- Built login/signup pages (shadcn/ui Card+Input forms), an authenticated app shell with sidebar nav + logout, a dashboard with live contact/lead/open-opportunity counts, and list pages for contacts (with a working quick-add form)/leads/opportunities.
- Added `getCurrentUser()` to `src/lib/auth.ts` (a `next/headers`-based sibling of the existing `getSessionUser()`, which reads from `NextRequest`) so Server Components/layouts can check auth without needing a request object. The `(app)` route group's layout uses it to redirect unauthenticated visitors to `/login` server-side, before any protected page renders.
- Root `/` now redirects to `/dashboard` or `/login` depending on auth state; `/login` and `/signup` redirect already-authenticated visitors to `/dashboard`.
- **Verified (all passing):** `npm run build` (clean production build, all 19 routes), `npm run lint`, `npx tsc --noEmit`, full Vitest suite (20/20, untouched by this phase) — **and**, per the master prompt's requirement to actually test UI changes in a browser, a real Playwright click-through: signup → empty dashboard → add a contact → dashboard/contacts reflect it → leads/opportunities empty states → logout → confirmed a protected page redirects to `/login` when logged out → logged back in successfully.
- **Problems hit & resolved (worth knowing for future UI testing sessions):**
  - Several stray `next dev` processes accumulated from my own earlier manual `(npm run dev &)` backgrounding across this session and silently kept squatting on port 3000, so later test runs were sometimes hitting a stale server. Killed all node processes and switched to letting the webapp-testing skill's `with_server.py` manage the dev server's lifecycle exclusively, rather than backgrounding it myself.
  - Playwright's locator-based `.click()` (including with `force=True`) silently failed to trigger navigation on the very first click of a fresh page load, while `page.mouse.click()` at the same coordinates, a raw JS `.click()`, and direct `page.goto()` all worked correctly — this pointed to a hydration-timing issue (clicking before the client bundle finishes hydrating on a route's first-ever compile in dev mode with Turbopack), not a real product bug. Fixed the **test script** by using coordinate-based `mouse.click()` plus a settle delay after each navigation. The underlying feature itself was confirmed working via three independent methods before concluding this was tooling/timing, not application code.
- **DECISIONS:**
  - Kept the contacts list read/write (has a quick-add form) but left leads/opportunities as read-only list + empty state for now — creating a lead or opportunity needs a contact-picker UI, which is a reasonable amount of added complexity to defer; nothing in `PLAN.md` promised lead/opportunity creation UI at this phase.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 5: minimal UI shell [verified]` and pushed to `origin/main`.
- **Next phase:** Phase 6 — Embeddable form builder v1 (form definition, embed snippet, public submission endpoint with honeypot + rate limiting, creates a lead).

### Phase 6 — Embeddable form builder v1 — **DONE**

- Added `Form` (name, fields config, unique `embedKey`) and `FormSubmission` (payload, status, linked lead, IP) models.
- Built the authenticated form management API (create/list/read, tenant-scoped) and an authenticated `/forms` page: create a form by name, see a ready-to-paste `<iframe>` embed snippet and a running submission count per form.
- Built the **public** side: `GET /api/public/forms/[embedKey]` serves just the field config (no tenant data leaked), and a public `/embed/[embedKey]` page renders the form standalone — designed to be dropped into any external site via the iframe snippet.
- Built `POST /api/public/forms/[embedKey]/submit`: validates input, creates a `Contact` + `Lead` (source `form:<form name>`) tagged onto the right tenant, logs `lead.created` and `form.submitted` to the Activity timeline (same vocabulary the Phase 7 webhook contract will use), and records every attempt (accepted/rejected) in `FormSubmission`.
- Spam protection: an invisible honeypot field (`website`) that only automated fillers populate — tripping it returns a normal-looking success response (so the bot doesn't learn it was caught) but creates nothing real, just a `rejected_honeypot` record. A per-IP, per-form rolling-window cap (5 submissions / 10 minutes) returns 429 beyond that, logged as `rejected_rate_limited`.
- **Verified (all passing):**
  - `npm run test` — 26/26 (up from 20), covering form CRUD, public config exposure, a real submission creating a contact+lead, the honeypot path creating zero leads, the rate limit tripping exactly on the 6th attempt, and a 404 for an unknown embed key.
  - `npm run lint`, `npx tsc --noEmit`, `npm run build` — all clean.
  - A real Playwright browser run: signed up, created a form in the `/forms` UI, opened its embed URL in a **separate browser page** (to genuinely simulate an external site loading it in an iframe, not just navigating within the app), submitted it, then confirmed back in the CRM that the lead appeared under Leads and the submission counter on the Forms page incremented.
- **Problems hit & resolved:**
  - ESLint's `react-hooks/set-state-in-effect` rule flagged computing the embed URL's origin via `useEffect` + `setState` in a Client Component (a common but discouraged pattern). Fixed properly rather than suppressing the rule: moved the origin lookup to the Server Component (`headers()` in `/forms/page.tsx`) and passed it down as a plain prop, so `EmbedSnippet` needs no client-side state or effect at all.
- **DECISIONS:**
  - Forms render a fixed field set (name/email/phone/company, matching `Contact`) rather than a fully freeform drag-and-drop builder — matches "v1" scope in `PLAN.md`; the `fields` JSON column already supports per-field required/label config today, so a real builder UI can be layered on later without a schema change.
  - Rate limiting here is deliberately narrow (per-IP-per-form, this one endpoint) — broad rate limiting across _all_ public endpoints is Phase 17's job, not duplicated here.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 6: embeddable form builder v1 [verified]` and pushed to `origin/main`.
- **Next phase:** Phase 7 — Webhooks out (event envelope + HMAC signing, delivery log, retry/backoff, emits `lead.created`/`form.submitted`).

### Phase 7 — Webhooks out — **DONE**

- Added `WebhookEndpoint` (per-tenant URL + generated secret) and `WebhookDelivery` (one row per attempt, with status/attempts/backoff/last error) models.
- Built `src/lib/webhooks.ts`: the signed event envelope, `emitEvent()` (fires an immediate best-effort delivery to every active endpoint on a tenant), and `processDueDeliveries()` for the backoff-retry queue.
- Wired `emitEvent()` into every place that already logged to the Activity timeline in Phases 4/6: lead create/update/status-change, opportunity create/stage-change/closed-won/closed-lost, and form submission — using exactly the event names `EVENTS.md` (and the original `PLAN.md` draft) promised.
- Wrote `EVENTS.md`: the finalized envelope shape, signature verification instructions, the retry schedule, and the event table.
- Built `/api/webhooks/process-due`, protected by a bearer secret (`WEBHOOK_PROCESSOR_SECRET`) rather than a user session since it's meant to be triggered by an external scheduler, not a logged-in person — documented in `EVENTS.md` and `.env.example`.
- Built an authenticated `/webhooks` page: add an endpoint, see its recent deliveries (event type, attempt count, status, last error) right in the CRM — this is the "delivery log visible in the CRM admin" the master prompt asks for.
- **Verified (all passing):**
  - `npm run test` — 40/40 (up from 26). Notably: a real local HTTP server receives a delivery and the test independently recomputes the HMAC to confirm `X-CRM-Signature` is correct (not just "some header was sent"); a delivery to a genuinely unreachable port gets a real connection failure and a scheduled backoff retry; 5 attempts in a row correctly flips a delivery to `failed`; `processDueDeliveries()` picks up and successfully redelivers a due row.
  - `npm run lint`, `npx tsc --noEmit`, `npm run build` — clean.
  - A real Playwright run: added a webhook endpoint through the `/webhooks` UI.
- **Security note (proactive, not prompted by an issue this time):** a webhook endpoint's URL is tenant-supplied but the _server_ makes the outbound HTTP request to it — a classic SSRF shape if a tenant (or someone who compromises a tenant's admin account) points it at an internal address. Added `src/lib/url-safety.ts`, which blocks loopback, private (`10.x`, `172.16–31.x`, `192.168.x`), link-local (`169.254.x`, including the `169.254.169.254` cloud-metadata address every major cloud provider uses), and non-http(s) schemes at endpoint-creation time. Documented as a literal-IP check, not full DNS-rebinding protection — noted in the code as worth revisiting if this is ever exposed to fully untrusted tenants at real scale.
- **DECISIONS:**
  - `emitEvent()` never throws — a webhook subscriber being down must never break the CRM request that triggered the event. Failures are recorded on the delivery row and left for the retry queue.
  - The immediate-delivery-then-queue-for-retry model means the "job table polled by a worker loop" from the Phase 0 plan is realized as an HTTP endpoint (`/api/webhooks/process-due`) for an _external_ scheduler to call, rather than a long-running in-process worker — matches the original "avoid a persistent worker process" reasoning in `PLAN.md`, and is the simplest thing that works on a serverless-style host (Vercel/Render) where a Next.js app has no long-lived process to run a loop in.
- **NEEDS FROM OPERATOR:** to actually see retries fire in production, a scheduler needs to be pointed at `POST /api/webhooks/process-due` every 1–5 minutes with `Authorization: Bearer <WEBHOOK_PROCESSOR_SECRET>` — documented in `EVENTS.md`, not yet set up anywhere (there's no production deployment yet regardless).
- Committed as `Phase 7: webhooks out [verified]` and pushed to `origin/main`.
- **Next phase:** Phase 8 — Public API in (n8n-facing): per-tenant API keys, REST endpoints for leads/contacts/opportunities/activities/call bookings, OpenAPI spec.

### Phase 8 — Public API in (n8n-facing) — **DONE**

- Added `ApiKey` (per-tenant, only a SHA-256 hash stored; the plaintext key is generated once and never persisted).
- Built the full `/api/v1/*` REST surface: create/read/update on contacts, leads, opportunities, and activities — reusing the exact tenant-scoping pattern (`findFirst({ where: { id, tenantId } })`, 404 not 403 for cross-tenant access) and the same Activity-log + webhook-event wiring already proven in Phases 4 and 7, so data written via n8n behaves identically to data written through the UI.
- No `DELETE` on this API by design — matches `PLAN.md`'s "create/read/update" scope; deleting stays a human/admin action in the CRM itself.
- Built an authenticated **API Keys** page: create a key (shown once, with an explicit "copy now" warning), see existing keys by name/prefix/last-used, nothing else ever exposes the plaintext key again.
- Shipped `openapi.yaml` (a real OpenAPI 3.0 document, importable directly into n8n's HTTP Request node) and `API.md` — the auth setup, endpoint table, a worked request/response example, and the error-shape/rate-limit notes, written for the non-technical operator to hand to whoever sets up the n8n side.
- **Verified (all passing):**
  - `npm run test` — 45/45 (up from 40): missing/invalid API key rejected, the full contact→lead→opportunity(→closed_won)→activity lifecycle driven entirely through a bearer API key, tenant isolation (key from tenant A gets 404 on tenant B's contact), and API key create/list/delete with an explicit assertion that the plaintext key never appears anywhere in the list response.
  - `npm run lint`, `npx tsc --noEmit`, `npm run build` — clean.
  - A real Playwright run through the API Keys page: created a key, saw the one-time reveal screen, confirmed it appears afterward in the list with metadata only.
- **DECISIONS:**
  - Call-booking endpoints for this API are deferred to Phase 9, alongside the `CalendarProvider` interface they depend on — not an oversight, just sequencing (can't expose an API for something that doesn't exist yet).
  - Rate limiting isn't enforced on `/api/v1/*` yet — explicitly noted in `API.md` as covered by the Phase 17 hardening pass, not silently skipped.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 8: public API in (n8n-facing) + OpenAPI [verified]` and pushed to `origin/main`.
- **Next phase:** Phase 9 — Calendar integration interface (`CalendarProvider` interface + `MockCalendarProvider`, `CallBooking` model, booking endpoint, `call.booked` event).

### Phase 9 — Calendar integration interface + mock provider — **DONE**

- Added the `CalendarProvider` interface (`findAvailableSlots`/`bookSlot`/`cancelBooking`) and `MockCalendarProvider` (hourly weekday 9–5 slots, fake booking IDs) behind a `getCalendarProvider()` factory keyed off `CALENDAR_PROVIDER` — real Google/Outlook providers in Phase 15 are a config change, not a rewrite of any caller.
- Added `CallBooking`, plus both an n8n-facing (`/api/v1/calendar/slots`, `/api/v1/call-bookings`, API-key auth) and session-authenticated (`/api/calendar/slots`, `/api/call-bookings`) surface for finding a slot and booking it against a lead. Booking logs an Activity entry and fires `call.booked` (the event type/webhook plumbing was already in place from Phase 7).
- Built a **Calls** page: pick a lead and an available mock slot, book it, see existing bookings with status.
- **Verified (all passing):**
  - `npm run test` — 51/51 (up from 45): the mock provider's slot generation only ever returns weekday/business-hours times and unique booking IDs per call; the full slots→book→list flow through an API key with the `call.booked` Activity entry confirmed in the database; a `leadId` from another tenant correctly rejected with 400.
  - `npm run lint`, `npx tsc --noEmit`, `npm run build` — clean.
  - A real Playwright run: added a contact, booked a call against it through the Calls UI, confirmed the booking lists with `confirmed` status.
- **Housekeeping:** added an `argsIgnorePattern: "^_"` override to `eslint.config.mjs` for `@typescript-eslint/no-unused-vars` — `MockCalendarProvider`'s interface-mandated but unused parameters (e.g. `cancelBooking`, which has nothing to actually cancel) needed a clean way to signal "intentionally unused," not a one-off suppression comment.
- **DECISIONS:**
  - Kept the mock provider's business hours in the server's local timezone rather than modeling per-tenant timezones — reasonable for a mock; real providers in Phase 15 will need to handle this properly since they talk to real calendars.
- **NEEDS FROM OPERATOR:** none blocking now. Phase 15 (real Google/Outlook calendars) will need the operator to supply OAuth app credentials for each — flagged in advance, not yet needed.
- Committed as `Phase 9: calendar integration interface + mock provider [verified]` and pushed to `origin/main`.
- **Next phase:** Phase 10 — n8n Sales Agent reference flow (importable workflow JSON + setup guide: triage a new lead, book a slot via the Phase 8/9 API, notify the rep, write the outcome back).

### Phase 10 — n8n Sales Agent reference flow — **DONE**

- Built `n8n-flows/sales-agent.json`: webhook trigger on `lead.created` → verify HMAC signature → triage (simple scoring rules, documented as swappable for an LLM node) → fetch available slots from the Phase 9 calendar API → book the first one → notify the rep (explicit no-op placeholder) → write the triage outcome back onto the lead via the Phase 8 API. Plus `sales-agent-setup.md` (step-by-step, non-technical) and `n8n-flows/README.md` (index).
- **This is real, not just a hand-written JSON blob** — a real n8n instance was spun up in Docker specifically to test-drive it before committing:
  - Confirmed the JSON imports cleanly via `n8n import:workflow` (validates node types/typeVersions/connections against a real n8n build).
  - Activated the workflow and POSTed a correctly-HMAC-signed payload directly at its real production webhook URL — i.e. exactly what the CRM itself will do.
  - **This live run caught two genuine bugs before they ever reached this repo:** (1) n8n's Code node sandbox disallows `require('crypto')` — fixed by switching signature verification to n8n's built-in Crypto node; (2) the Config (Set) node silently drops every other field on the item unless `includeOtherFields` is explicitly turned on — without that fix, every node after Config would have lost access to the original webhook body/headers, silently breaking the entire flow.
  - After both fixes, the same real trigger produced a genuine `CallBooking` row (via the Phase 9 mock provider), wrote `status: qualified, score: 70` back onto a real test lead through the live CRM API, and logged both `call.booked` and `lead.status_changed` Activity entries — all independently confirmed by querying the database afterward, not just trusting a 200 response.
  - Torn down afterward: all disposable n8n containers/images removed, test tenant deleted from the CRM database. The operator's own **pre-existing** n8n container (already running on this machine, unrelated to this project) was identified early and deliberately left untouched the entire time — a fresh disposable instance was used for all testing instead.
- **Problems hit & resolved:** both described above (crypto sandbox restriction, `includeOtherFields` default) — genuinely would have shipped as a broken reference flow without this verification step; also hit a Git-Bash-on-Windows path-mangling issue with `docker exec`/`docker cp` absolute paths, worked around with `MSYS_NO_PATHCONV=1`.
- **DECISIONS:**
  - No retry/backoff configured on the workflow's own HTTP Request nodes (if the CRM API is briefly unreachable) — noted as a customization point in the setup guide rather than baked in, since n8n's per-node "Retry on Fail" setting is something the operator can toggle themselves without needing a code change.
- **NEEDS FROM OPERATOR:** none blocking. When the operator actually sets this up against their real n8n instance, they'll need their own API key + webhook secret (can't be pre-provisioned since they don't exist until the operator creates them) — documented clearly in the setup guide.
- Committed as `Phase 10: n8n Sales Agent reference flow [verified]` and pushed to `origin/main`.
- **Next phase:** Phase 11 — Opportunity pipeline UI + stage events (Kanban board, configurable `PipelineStage` per tenant).

### Phase 11 — Opportunity pipeline UI + stage events — **DONE**

- Added `PipelineStage` (per-tenant configurable Kanban columns), seeded with six sensible defaults automatically on signup, plus a lazy-backfill helper (`ensurePipelineStages`) for any tenant that predates this feature.
- Deliberately kept `Opportunity.stage` as a plain string (matching `PipelineStage.key`) rather than turning it into a foreign key — the Phase 8 API contract already documents `stage` as a string, and this way that contract never has to change.
- Replaced the flat opportunities list with a real Kanban board: columns per stage, drag a card to move it, drop it and its stage updates — which already fires `opportunity.stage_changed`/`closed_won`/`closed_lost` (wired up back in Phases 4/7), so no event-plumbing changes were needed here.
- Built the drag-and-drop with plain mouse events (`mousedown`/`mousemove`/`mouseup` + `elementFromPoint`) rather than the browser's native HTML5 drag-and-drop API — a deliberate choice: native DnD is well known to be difficult to drive reliably from headless browser automation, and this way the interaction could actually be verified end-to-end rather than taken on faith.
- **Verified (all passing):**
  - `npm run test` — 54/54 (up from 51): default-stage seeding, custom stage creation landing at the correct `sortOrder`, duplicate-key rejection.
  - `npm run lint`, `npx tsc --noEmit`, `npm run build` — clean.
  - A real Playwright run: created a contact + opportunity via the API, loaded the Kanban board, performed an actual mouse-driven drag from the "New" column to "Qualified," and — rather than just trusting the UI repainted — made a follow-up API call afterward to confirm the opportunity's `stage` had genuinely changed server-side.
- **DECISIONS:**
  - No stage-reordering or stage-editing UI yet (create-only) — matches what `PLAN.md` asked for at this phase; full stage management is a natural but not-yet-requested follow-up.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 11: opportunity pipeline UI + stage events [verified]` and pushed to `origin/main`.
- **Next phase:** Phase 12 — n8n Finance Agent reference flow (`opportunity.closed_won` → create an invoice record via the CRM API → log to the opportunity timeline). This completes the full end-to-end mock journey from `PLAN.md` §5.

### Phase 12 — n8n Finance Agent reference flow — **DONE**

- **This phase completes the full end-to-end mock journey described in `PLAN.md` §5**: a lead comes in (Phase 6 form) → gets triaged and a call booked (Phase 10 Sales Agent) → converts to an opportunity (Phase 4) → closes won (Phase 11 Kanban) → an invoice is created (this phase) — all visible on the dashboard.
- Added `Invoice` (explicitly a placeholder for a real accounting-tool integration — Xero/QuickBooks/Stripe wiring is a stated v1 non-goal in `PLAN.md`) and a v1 API endpoint that creates one against an opportunity, automatically logging `invoice.created` to that opportunity's Activity timeline (no separate "log to timeline" step needed anywhere).
- Built a minimal **Invoices** page for demo visibility.
- Built `n8n-flows/finance-agent.json` + `finance-agent-setup.md`: webhook on `opportunity.closed_won` → verify signature → create the invoice via the CRM API → a placeholder node for a real accounting tool.
- **Verified with the same rigor as Phase 10** — and this time it worked correctly on the **first real run**, because both lessons learned while verifying the Sales Agent flow were applied from the start: n8n's built-in Crypto node instead of `require('crypto')`, and `includeOtherFields: true` on the Config Set node. Imported into a fresh disposable n8n instance, activated, triggered via a real HTTP POST to its production webhook URL against a real closed-won test opportunity — produced a genuine `Invoice` row with the correct amount, and independently confirmed via the database that `invoice.created` was logged automatically.
- **Verified (all passing):**
  - `npm run test` — 56/56 (up from 54): invoice creation, tenant isolation on `opportunityId`, and the automatic activity log entry.
  - `npm run lint`, `npx tsc --noEmit`, `npm run build` — clean.
  - A real Playwright run confirming the Invoices page renders correctly both empty and with data.
- All disposable n8n containers/images and test tenants were torn down afterward; the operator's own pre-existing n8n container was, again, left completely untouched.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 12: n8n Finance Agent reference flow [verified]` and pushed to `origin/main`.
- **Next phase:** Phase 13 — Dashboard & reporting (pipeline value by stage, conversion rates, lead-source breakdown, time series).

### Phase 13 — Dashboard & reporting — **DONE**

- Built four report functions (`src/lib/reports.ts`), each a pure function against the database so the numbers are independently testable: pipeline value by current stage, a stage-to-stage conversion funnel, lead-source breakdown, and a 14-day leads-created/deals-closed time series.
- The conversion funnel is built from the Activity log's `opportunity.created`/`opportunity.stage_changed` entries — "reached stage X" means the opportunity was ever created at or transitioned to X, not just where it currently sits, so a deal that passed through "qualified" on its way to closed-won still counts toward qualified's conversion rate.
- Wired all four into the Dashboard as charts, loading the `dataviz` skill first and following its method: sequential single-hue (blue) for magnitude bars, a fixed categorical hue order with a legend for the lead-source breakdown, native `title`-attribute tooltips (a deliberate simplification vs. a full JS hover layer, given no charting library was introduced).
- **Verified exactly as the phase asked: "seed known data, assert the computed numbers match by hand."** A test creates three opportunities with a specific, known stage-transition history (A: new→qualified, stays; B: new→qualified→closed_won; C: stays at new) plus five leads split across two sources, then asserts every report's output against hand-calculated expected numbers — not just "did it return something non-empty."
- **That exercise caught two real bugs before they shipped:**
  1. `getTimeSeries` mixed local-time day boundaries (`setHours(0,0,0,0)`) with UTC-based date-key comparisons (`toISOString().slice(0,10)`) — on a machine where local time and UTC disagree on which day it currently is, "today" could silently fall outside the day the loop actually generated. Fixed by computing everything — the start boundary and every day-key — in UTC.
  2. The time-series bar chart used `items-end` on a flex row whose day-column children had no explicit height; percentage-height bars have no resolved reference without a sized parent, so every bar silently rendered at 0px. The automated tests couldn't have caught this (the underlying numbers were correct) — it only turned up because a real Playwright screenshot was taken and looked at. Fixed by giving each day-column an explicit height so the percentage children resolve correctly.
- **Verified (all passing):** `npm run test` — 57/57 (up from 56); `npm run lint`, `npx tsc --noEmit`, `npm run build` — clean; a real Playwright run confirming all four charts render with actual visible data after both fixes (re-screenshotted to confirm the bar-chart fix specifically).
- **DECISIONS:**
  - Tooltips are native `title` attributes rather than a custom JS hover layer — the `dataviz` skill's fuller interaction spec (crosshair, custom tooltip component) was judged more investment than this phase's scope warranted without a charting library already in place; revisit if the operator wants richer interactivity.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 13: dashboard & reporting [verified]` and pushed to `origin/main`.
- **Next phase:** Phase 14 — Lead dedupe matching (real fuzzy/trigram matching on email/phone/company, replacing the Phase 4 exact-match stub) + enrichment-hook interface.

### Phase 14 — Lead dedupe matching (real fuzzy logic) + enrichment hook — **DONE**

- Enabled Postgres's `pg_trgm` extension (bundled with standard Postgres — no external service, no new dependency) via a raw-SQL migration, plus GIN trigram indexes on contact name and company for lookup performance.
- Replaced the Phase 4 exact-match-only stub with real fuzzy matching: exact email/phone match stays first (cheap, indexed), with a trigram-similarity fallback on full name and company, tenant-scoped, combined and deduplicated by contact id. Still informational only — never blocks contact creation, same as before.
- Added the enrichment-hook interface from the product spec: `ContactEnrichmentProvider` + a `NoopEnrichmentProvider` default, following the exact same provider-swap pattern as `CalendarProvider` (Phase 9) — a real enrichment service is a config change away, not a rewrite. Wired into both contact-creation routes as a best-effort step that can never throw or block creation.
- **Verified exactly as the phase asked — "tests for exact match, fuzzy match, and no-false-positive cases":**
  - Exact match: an email match is found even with a completely different name.
  - Fuzzy match: a one-letter name typo ("Jon Smith" vs "John Smith") and a company-name variation ("Acme Corp" vs "Acme Corporation") are both caught.
  - **No false positives**: two contacts with genuinely different names and companies are correctly _not_ flagged — this is the check that actually validates the 0.35/0.45 thresholds aren't too loose, and it's run against real Postgres trigram similarity, not a hand-rolled scoring function, so the thresholds are proven against the actual database engine that runs them in production.
  - Also verified: tenant isolation (fuzzy matching never crosses tenant boundaries) and the no-input case.
- **Verified (all passing):** `npm run test` — 63/63 (up from 57); `npm run lint`, `npx tsc --noEmit`, `npm run build` — clean. No UI changed this phase — duplicate results were already an API-only field, not surfaced in the UI, before this phase.
- **DECISIONS:**
  - `EnrichmentResult` only includes fields that already exist on `Contact` today (just `company`) rather than speculative fields like `jobTitle`/`companySize` that don't have a column yet — avoids a design/implementation mismatch that would only surface once a real provider was plugged in and started returning those fields.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 14: lead dedupe matching (real fuzzy logic) + enrichment hook [verified]` and pushed to `origin/main`.
- **Next phase:** Phase 15 — Real calendar providers (Google Calendar, Outlook) implementing the Phase 9 `CalendarProvider` interface. **Expected to be BLOCKED** — needs the operator to supply real OAuth app credentials for each provider, which don't exist yet.

### Phase 15 — Real calendar providers (Google Calendar, Outlook) — **BLOCKED**

- This phase genuinely cannot be built _or verified_ without real credentials — not a case of "stuck on an error," a hard external dependency. Per the master prompt's rule ("if you cannot verify... mark the phase BLOCKED... do not fake it, stub it silently, or skip ahead"), no speculative/untested OAuth implementation was written for either provider. Writing an OAuth token-exchange flow I can't actually run against a real Google/Microsoft endpoint would mean shipping code with an unverified, possibly-wrong integration — worse than clearly stating the gap.
- **NEEDS FROM OPERATOR (exactly what's needed to unblock this):**
  1. **Google Calendar**: a Google Cloud project with the Calendar API enabled, an OAuth 2.0 Client ID + Client Secret (Web application type), and the redirect URI this app will use (e.g. `https://<your-crm-domain>/api/auth/google/callback`) added to the authorized redirect URIs list.
  2. **Outlook/Microsoft**: an app registration in Azure AD (Entra ID) with the Microsoft Graph `Calendars.ReadWrite` permission granted, its Application (client) ID + a client secret, and the same kind of redirect URI registered.
  3. Confirmation that it's OK to make live outbound calls to these two real third-party services once wired up (per the master prompt's standing rule on live external calls) — this is a business/consent decision, not a technical one, so it's the operator's call, not mine to assume.
- Until those exist, `CALENDAR_PROVIDER` stays at its default (`mock`) — the Phase 9 interface means this is purely additive whenever the credentials arrive; nothing about Phases 9–14 needs to change.
- **Not treating this as a full-session blocker** — per the master prompt ("if stuck... move to any other unblocked task"), continuing on to Phase 16 (demo data), which has no dependency on real calendar providers, and Phase 17 (hardening), rather than stalling the whole session on a credential the operator hasn't supplied.
- **Next phase:** Phase 16 — Demo data & DEMO.md script (full demo-tenant seed + a 5-minute walkthrough script for the operator to use with prospects).

### Phase 16 — Demo data & DEMO.md script — **DONE**

- Rewrote `prisma/seed.ts` into a full, realistic demo-tenant seed: 12 contacts across 6 fictional companies, 9 leads at a mix of statuses/sources, 8 opportunities spanning every pipeline stage (including two closed-won deals with real `Invoice` rows and one closed-lost), a sample embeddable form with submissions, a couple of booked calls, and an example inactive webhook endpoint — no page in the app is empty on a fresh seed.
- Switched the seed strategy from row-by-row `upsert` (fine for the single admin user) to delete-then-recreate scoped strictly to the demo tenant — the simplest way to keep a large, deeply interrelated dataset safely re-runnable without duplicate accumulation or needing a stable unique key on every single row.
- Wrote `DEMO.md`: a 5-minute, section-by-section walkthrough (dashboard → contacts/leads/opportunities with a live Kanban drag → submitting the embeddable form live → the automation/API surface → wrap-up), with talking points and a troubleshooting section.
- **Verified by actually following the script**, not just reading it: logged in as the seeded demo admin, confirmed the dashboard's four Phase 13 charts show real non-zero data matching the seed exactly, dragged a real opportunity card between Kanban columns, opened the seeded form's embed URL in a **separate browser page** and submitted it live (genuinely mirroring what a prospect would experience with it embedded on their own site), confirmed the resulting lead appeared, and checked the Webhooks/API Keys pages render sensibly. Also ran the seed script twice in a row to confirm idempotency, and reset the demo tenant back to its clean documented state afterward so it's ready for an actual demo.
- **Also fixed, while here:** a flaky test timeout in Phase 3's login-lockout test — five real bcrypt (cost 12) login attempts plus DB round-trips occasionally exceeded Vitest's 5s default timeout under system load when the full 19-file suite ran in parallel. Bumped that one test to 15s; confirmed it wasn't a real regression by re-running the file in isolation, where it passed reliably every time.
- **Verified (all passing):** `npm run test` — 63/63; `npm run lint`, `npx tsc --noEmit`, `npm run build` — clean.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 16: demo data & DEMO.md script [verified]` and pushed to `origin/main`.
- **Next phase:** Phase 17 — Hardening pass (rate limiting on all public endpoints, audit logging, polish remaining empty/error states, finalize deployment docs). The last phase in the original plan.

### Phase 17 — Hardening pass — **DONE**

The last phase in the original plan (0–17).

- **17a — Generic rate limiting:** added a Postgres-backed `RateLimitHit` table and a generic `checkRateLimit(key, {windowMs, max})` (`src/lib/rate-limit.ts`), applied to `/api/auth/signup` (5/hour/IP), `/api/auth/login` (20/10min/IP, on top of the existing per-account lockout), `GET /api/public/forms/[embedKey]` (60/min/IP), and `POST /api/webhooks/process-due` (30/min/IP). Each call site is guarded with `if (!process.env.VITEST)` — the test suite calls these routes directly, dozens of times per file in some cases (`createTestTenant()` signs up for real), so an unconditional limit would immediately 429 the suite; `checkRateLimit` itself is still exercised directly by its own dedicated test.
- **17b — Audit logging:** added an `AuditLog` model (deliberately no FK relations, so history survives tenant/user deletion) and `recordAuditLog()` (`src/lib/audit-log.ts`, best-effort — never throws). Wired into signup, login (success/failed/locked), logout, API key create/delete, and webhook endpoint create/delete. This is separate from the existing per-record `Activity` timeline, which only tracks business-record changes.
- **17c — Empty/error state polish:** Opportunities was the one list page without the site's standard "no records yet" `Card` pattern for a zero-opportunity tenant — added it. The app also had no custom 404 or root error boundary, silently falling back to Next.js's default pages — added `src/app/not-found.tsx` and `src/app/error.tsx`.
- **17d — Deployment docs:** added a "Deploying" section to `README.md` (Railway/Render-style single web service + managed Postgres, no separate Redis/queue — consistent with the Phase 0 rate-limiting/webhook-retry design) and a production environment variable checklist.
- **Also fixed, while here:** local `.env` had `CALENDAR_PROVIDER="outlook"` left over from Phase 15's credential setup (the operator had supplied real Azure AD app credentials — client ID/secret/tenant ID are still in `.env`), but no real Outlook provider was ever implemented (`getCalendarProvider()` only supports `"mock"` and throws otherwise), so every calendar call was failing. Reverted to `"mock"` for now. **The credentials exist and are unused** — implementing the real Microsoft Graph OAuth flow (token exchange, refresh storage, redirect handling) is a substantial feature in its own right and out of scope for a hardening pass; flagging it here as a real follow-up, not silently building it mid-Phase-17 with live third-party calls the operator hasn't explicitly signed off on making yet.
- Also bumped Vitest's global `testTimeout` to 15s (`vitest.config.ts`) — several DB-heavy tests (bcrypt cost-12 hashing, multi-step CRUD flows) were intermittently exceeding the 5s default only when the full suite ran in parallel under system load, never in isolation; this generalizes the one-off fix already applied to the Phase 3 lockout test in Phase 16.
- **Verified (all passing):** `npx tsc --noEmit` clean; `npm run lint` clean; `npm run test` — 69/69 across 21 files (added `rate-limit.test.ts` and `audit-log.test.ts`); `npm run build` — clean production build, all routes compile. Re-ran the full `DEMO.md` walkthrough end-to-end via a fresh Playwright pass against a freshly-seeded demo tenant: login → dashboard charts → contacts/leads/opportunities (including the Kanban board rendering correctly, not the new empty state, since the demo tenant has data) → forms → webhooks/API keys → logout, all working against the Phase 17 changes. Separately confirmed the new empty-tenant Opportunities message and the custom 404 page render correctly via a second Playwright pass against a brand-new, empty signup.
- **NEEDS FROM OPERATOR:** 
  1. Confirm whether to proceed with a real Outlook calendar integration using the existing Azure AD credentials in `.env` (this would involve live outbound OAuth calls to Microsoft, per the master prompt's consent rule) — currently left as `mock` and fully functional either way.
  2. Nothing else blocking — the project is feature-complete against the original Phase 0–17 plan.
- Committed as three commits (`Phase 17a/17b`, `Phase 17c`, `Phase 17d`) plus this log entry, all pushed to `origin/main`.
- **This closes out the original numbered plan.** Any further work (real Outlook/Google calendar providers, real contact enrichment provider, additional polish) is backlog, not a blocking gap in what was promised.

---

## Addendum — Accounts, Full CRM Gap Analysis & UI Quality Bar

The operator issued an addendum extending scope beyond the original 0–17 plan: build an Accounts module immediately, then do a one-time gap-analysis audit against a checklist of common CRM features, extending the numbered phase plan for whatever's missing — plus a standing UI-quality bar applying to every phase from here on. Settled architecture (tenant-scoping pattern, session/API-key dual auth, provider-interface pattern, event contract) stays fixed; this is additive scope, not a rebuild.

### Phase 18 — Accounts — **DONE**

- Added `Account` (tenant-scoped: `name` + timestamps only, deliberately minimal — website/industry etc. are later additions) and optional `accountId` on both `Contact` and `Opportunity` (`onDelete: SetNull`, so deleting an account unlinks rather than deletes its contacts/opportunities). Fully additive migration (`20260723075712_add_accounts`) — nothing existing changed shape.
- Full tenant-scoped CRUD on both surfaces: `/api/accounts` (session) and `/api/v1/accounts` (API-key, n8n-facing) — same `findFirst({ id, tenantId })`/404-not-403 pattern as every other entity. Account detail (`GET /api/accounts/:id`) returns its linked contacts and opportunities in one call.
- `Contact` and `Opportunity` create/update (both session and v1 surfaces, 8 route files total) now accept an optional `accountId`, validated against the caller's own tenant the same way `contactId`/`leadId` already were — a cross-tenant `accountId` is rejected with 400, matching the existing convention for cross-tenant FK rejection.
- New webhook events `account.created`/`account.updated`, added to `WebhookEventType` and wired the same way every other entity's events already work. Updated `EVENTS.md`, `API.md`, and `openapi.yaml` (validated the YAML parses and the new paths/schemas are well-formed).
- **UI:** an Accounts nav link (placed before Contacts, as the parent concept), a list page (create form + list, same "no records yet" `Card` empty-state pattern as every other list page), and an account detail page showing its linked contacts and opportunities as two sub-lists. The Contact create form gained an **Account picker** — a new lightweight searchable-dropdown component (`src/components/account-picker.tsx`), since no combobox/select primitive existed yet in this project's component set and pulling one in for a single field wasn't judged worth it; built to be reusable if a second picker is needed later.
- **Caught and fixed via the Playwright screenshot pass** (per the addendum's new UI-verification requirement): the account picker's dropdown was rendering but almost entirely invisible — `Card`'s `overflow-hidden` (needed elsewhere for rounded corners on images) was clipping the picker's absolutely-positioned dropdown panel. Fixed by overriding to `overflow-visible` on that one form's `Card` via `cn()`'s tailwind-merge (later class wins), rather than touching the shared `Card` component's default. This is exactly the kind of bug the addendum's screenshot requirement is meant to catch — the automated tests couldn't see it since the dropdown's *content* was correct, only its visibility was broken.
- **Visual check against the addendum's UI bar:** passed. Reuses the exact same Card/Badge/empty-state patterns as every pre-existing list page (Contacts, Leads, etc.) rather than introducing a new layout — hierarchy is obvious (one create form, one list, one clear primary action), the new picker's affordance (hover states, clear "No account" clear option) matches existing interactive-element treatment. Did **not** touch any pre-existing screen beyond the two small, in-scope edits (nav link; Contact form/list gaining the picker and an account badge) — a broader UI consistency pass across all pre-addendum screens is scoped into the gap-analysis phase list below, not done here.
- **Verified (all passing):** `npx tsc --noEmit` clean; `npm run lint` clean; `npm run test` — 75/75 across 22 files (added `src/app/api/accounts/accounts.test.ts` — CRUD, unauthenticated rejection, tenant isolation, cross-tenant `accountId` rejection, and an account-detail aggregation test; extended `src/app/api/v1/v1.test.ts` with the same coverage via API key); `npm run build` — clean, all new routes present. A real Playwright pass: signed up fresh, created an account, linked a contact and an opportunity to it via the UI, confirmed the account detail page aggregates both, confirmed the cross-tenant-rejection and 404 paths, and confirmed the dropdown-clipping bug was fixed with a follow-up screenshot.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 18: accounts [verified]` and pushed to `origin/main`.
- **Next:** the operator's Outlook OAuth credentials (real Azure AD app, admin consent already granted for `Calendars.ReadWrite`/`offline_access`/`User.Read`) unblock Phase 15's Outlook side — building the real `OutlookCalendarProvider` next, then the gap-analysis audit into `PLAN.md`.

### Phase 15 (Outlook side) — Real Outlook calendar provider — **DONE** (code) / needs one operator click-through to fully verify live

Was `BLOCKED` in Phase 15's original entry pending real OAuth credentials. The operator has now supplied a real Azure AD app registration (single-tenant, `Calendars.ReadWrite`/`offline_access`/`User.Read` delegated permissions, admin consent already granted) and explicitly authorized live calls to Microsoft. This is the real implementation, not a stub — but full end-to-end verification has one remaining step that only the operator can do (see below).

- Added `CalendarConnection` (one per tenant — connects the business's own Outlook calendar, not per-user — `accessToken`/`refreshToken`/`expiresAt`/`accountEmail`, additive migration, never returned in any API response).
- `getCalendarProvider()` changed from a global singleton to tenant-aware (`getCalendarProvider(tenantId)`) — a real provider's credentials are per-tenant, so this had to change; all 5 existing call sites updated to pass their already-in-scope `tenantId`. The `CalendarProvider` interface itself (`findAvailableSlots`/`bookSlot`/`cancelBooking`) is untouched — this is exactly the "config change, not a rewrite" the Phase 9 interface was built for.
- `OutlookCalendarProvider` (`src/lib/calendar/outlook-provider.ts`): reads/refreshes the tenant's stored OAuth token (refreshing via Microsoft's token endpoint when within 60s of expiry, persisting the new token), reads busy blocks via Graph's `/me/calendarView`, computes free slots by subtracting busy blocks from weekday business hours, books via `POST /me/events`, cancels via `DELETE /me/events/:id`. The free-slot math is pulled into a separate pure function (`free-slots.ts`) specifically so it's unit-testable without a live Graph call.
- One-time connect flow: `GET /api/auth/outlook/start` (session-authed, redirects to Microsoft's real consent screen with an HMAC-signed `state` carrying the tenant id) and `GET /api/auth/outlook/callback` (verifies `state`, exchanges the code for tokens at Microsoft's token endpoint, reads the connected account's email via `/me`, upserts `CalendarConnection`). Both are genuine, untested-by-mocking live integrations — this is real Microsoft Graph OAuth, not a fake.
- Calls page: shows a "Connect Outlook Calendar" button when `CALENDAR_PROVIDER=outlook` and no connection exists yet, a clear connected-account message once it does, and a friendly in-page error card (instead of a crashed page) if a Graph call fails for any reason.
- **Caught a real cross-cutting issue while verifying:** setting `CALENDAR_PROVIDER=outlook` in `.env` (the operator's actual supplied value) broke the existing calendar/call-booking tests, because test tenants have no `CalendarConnection` row. Root cause: those tests were implicitly relying on whatever `CALENDAR_PROVIDER` happened to be in the developer's local `.env`, which is fragile — a legitimate production config value shouldn't be able to break the test suite. Fixed properly by pinning `CALENDAR_PROVIDER: "mock"` in `vitest.config.ts`'s `test.env` (Vitest's env override, applied after `dotenv/config`), so the test suite is deterministic regardless of local `.env` — verified by running the full suite with `.env` actually set to `"outlook"` and confirming all 83 tests still pass.
- **Verified (all passing) with `.env` set to `CALENDAR_PROVIDER="outlook"` (the operator's real value, left in place):** `npx tsc --noEmit`, `npm run lint`, `npm run test` (83/83, including new `free-slots.test.ts` and `outlook-oauth-state.test.ts` unit tests), `npm run build` — all clean. A real Playwright pass: confirmed the mock-mode Calls page is unaffected (regression check), confirmed the not-connected state shows the connect button and doesn't crash, and — the genuinely live part — hit `GET /api/auth/outlook/start` directly and confirmed it redirects to a real, correctly-formed `login.microsoftonline.com` URL: right tenant ID, right client ID, the exact `OUTLOOK_REDIRECT_URI` from `.env`, the right scopes, and a valid signed `state`.
- **What could not be verified by me, and why:** the actual OAuth handshake past that point requires signing into a real Microsoft account through Microsoft's own login UI (and possibly MFA) — something only the operator can do, by design (that's the whole point of OAuth: the CRM never sees the Microsoft password). This is not a code gap or a `BLOCKED` phase — the code is real and complete — it's a one-time manual step.
- **NEEDS FROM OPERATOR:** click "Connect Outlook Calendar" on the Calls page once, signed in as whichever Microsoft account should own the business's bookable calendar, and approve the consent screen. After that, report back (or just try booking a call) so I can confirm the live round-trip actually works and close this out fully. If anything about the redirect URI needs to change, it's `http://localhost:3000/api/auth/outlook/callback` for local dev — for a real deployment this needs to become `https://<your-deployed-domain>/api/auth/outlook/callback`, registered in the Azure app's Authentication settings, and `OUTLOOK_REDIRECT_URI` updated to match.
- Committed as `Outlook calendar provider (real, live) [verified: code + redirect; connect step pending operator]` and pushed to `origin/main`.

### Gap-analysis audit — **DONE**

Ran the one-time v1 completeness audit the addendum asked for, against its checklist of common CRM features. Full classification (COVERED/ADD/NON-GOAL, with reasoning for each) is written into `PLAN.md` §7 — not duplicated here to avoid two copies drifting out of sync.

- **Notable finding:** the single biggest gap is that **no Contact/Lead/Opportunity detail page exists at all** — Contacts and Leads are flat lists, Opportunities is Kanban-only. This means the `Activity` timeline (built correctly since Phase 4, and written to by every subsequent phase) has nowhere to be shown to a user today. Phase 21 builds these detail pages and is sequenced early since Notes, Tasks, and Email logging all need somewhere to attach.
- **Also notable:** `Lead.ownerUserId`/`Opportunity.ownerUserId` have existed since Phase 4 and are already accepted by their APIs, but there's no picker UI and no "my records" filter anywhere — a case of the data model being ahead of the UI. Folded into Phase 25 alongside adding the same column to Contact/Account.
- **Also notable:** the `Role` enum (`ADMIN`/`MEMBER`) has existed since Phase 2 but has **zero enforcement** anywhere in the codebase (confirmed by grep) — every route currently lets any authenticated tenant member do anything another member can. Phase 29 adds real server-side enforcement.
- 17 new phases added (19–35), each scoped to one sitting, in dependency order (e.g. products before quotes, ownership/role-enforcement before CSV export and search since both need real visibility rules to respect). A one-time UI consistency pass (Phase 34) and an Azure deployment phase (Phase 35, with an explicit operator checklist) close out the sequence.
- Two items marked **NON-GOAL (v1)** with reasoning logged: full inbox email sync (same class of scope-cut as the original plan's "no built-in email campaigns" — a real sync is a materially bigger feature than manual logging), and in-app automation rules (n8n already is this product's automation layer; a second rule engine would duplicate it for no benefit).
- **NEEDS FROM OPERATOR:** none blocking yet — Phase 35 (deployment) is where real operator-action items will surface (Azure resource creation, DNS, the Outlook redirect URI update for production).
- Committed as `Gap analysis: v1 completeness audit + extended phase plan (19-35)` and pushed to `origin/main`.
- **Next:** Phase 19 — custom fields per tenant.

### Phase 19 — Custom fields per tenant — **DONE**

- Added `CustomFieldDefinition` (tenant-scoped field schema: `entityType` — a plain string `"contact"|"account"|"opportunity"`, mirroring the existing `Activity.entityType` convention rather than inventing a new polymorphic-relation pattern — `key`, `label`, `type` text/number/date/select, `options` for select) and `CustomFieldValue` (one row per definition+entity, upserted). Fully additive migration.
- `src/lib/custom-fields.ts`: `getFieldDefinitions`, `getFieldValues`/`getFieldValuesForEntities` (batched, for list views — one query instead of N), and `setFieldValues` (lenient: silently ignores any key that doesn't match an existing definition for that tenant+entityType, so a slightly-stale n8n flow posting an old field list doesn't 400 the whole request).
- Definitions API: `/api/custom-fields` (session-authed GET/POST, optional `?entityType=` filter) and `/api/custom-fields/:id` (DELETE, tenant-scoped 404-not-403). `select` fields are rejected with 400 if they have no options.
- Wired `customFields` (an optional `Record<string,string>` in the request body) into **all 8** Contact/Account/Opportunity create+update routes (session and v1 surfaces) — every one now accepts, persists, and returns custom field values alongside the record, including in list responses (batched lookup, not N+1).
- **UI:** a new Custom Fields settings page (define a field: entity type, label, key, type, options for select; remove a field) and a reusable `<CustomFieldsInputs>` component that renders the right input type per definition, wired into both the Contact and Account creation forms so new fields show up immediately with no further code change — exactly the "adapt without a code change" goal from the addendum.
- **Verified (all passing):** `npx tsc --noEmit`, `npm run lint`, `npm run test` — 88/88 (added `custom-fields.test.ts`: definition CRUD, select-with-no-options rejected, unauthenticated rejection, tenant isolation on deleting a definition, and a full round-trip test — create a select-type field, create a Contact with a value plus one unknown/ignored key, confirm the value shows up correctly on GET/list/PATCH, confirm the unknown key was silently dropped). `npm run build` — clean, all new routes present.
- A real Playwright pass (logged in as the seeded demo admin, to avoid the daily signup rate limit from all of tonight's testing): created a text field on Contact, confirmed it appears in the Custom Fields list, and confirmed the Contacts page's quick-add form immediately rendered the new field with no restart/rebuild needed. Screenshots judged against the addendum's UI bar: consistent Card/list/Badge patterns matching every pre-existing page, no visual defects.
- **DECISIONS:**
  - No custom fields on Lead — the addendum's checklist only asked for Contact/Account/Opportunity.
  - Values stored as plain nullable strings (not typed columns) — the `type` on the definition is presentation/validation metadata for the UI, not a schema-level constraint; this keeps `CustomFieldValue` a single simple table regardless of how many field types exist, matching the "config change, not a rewrite" philosophy used elsewhere (e.g. `CalendarProvider`).
  - List-view display of custom field values on the flat Contacts/Accounts lists was deliberately not added — Phase 21 (record detail pages) is where these values will actually be shown/edited on existing records; adding it to the flat list now would be replaced almost immediately.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 19: custom fields per tenant [verified]` and pushed to `origin/main`.
- **Next:** Phase 20 — tags/labels.

### Phase 20 — Tags/labels — **DONE**

- Added `Tag` (per-tenant catalog: name + a fixed 6-color palette, not free-typed hex — defined once in `src/lib/tag-colors.ts` and reused everywhere a tag renders, per the UI bar's "color must mean something consistently" rule) and `TagAssignment` (many-to-many join; `entityType` a plain string, same polymorphic convention as `Activity`/`CustomFieldDefinition`, covering all four of Contact/Account/Lead/Opportunity even though the UI only wires two of them up this phase — see decisions).
- `src/lib/tags.ts`: `getTagsForEntities` (batched, for list views) and `getEntityIdsForTag` (list-view filtering).
- API: `/api/tags` (GET/POST, session-authed) + `/api/tags/:id` (DELETE), and a generic `/api/tag-assignments` (POST to assign, DELETE via query params to unassign) that validates both the tag and the target entity belong to the caller's tenant before creating the join row — the entity-ownership check is a small switch over the four taggable types, same shape as the existing `contactId`/`accountId`/`leadId` cross-tenant checks elsewhere.
- **UI:** a Tags settings page (create with a 6-swatch color picker + live preview, list with per-tag usage count, remove), and full tagging wired into the **Contacts** list specifically: a tag-filter dropdown in the page header (`?tagId=` query param), and a per-row tag control (assigned tags as colored chips, click a chip to remove, a small "+" opens a dropdown of not-yet-assigned tags to add) — `contact-tags.tsx`.
- **Verified (all passing):** `npx tsc --noEmit`, `npm run lint`, `npm run test` — 94/94 (added `tags.test.ts`: tag CRUD, duplicate-name rejection, unauthenticated rejection, tenant isolation on deleting a tag, assign/unassign round-trip, and cross-tenant assignment rejected). `npm run build` — clean, all new routes present.
- A real Playwright pass (logged in as the demo admin again, same rate-limit reason as Phase 19): created a tag with a color, assigned it to a contact via the inline picker, confirmed the badge renders with the right color, and confirmed the header filter correctly narrows the list to just that contact. Screenshots judged against the UI bar: consistent with every other list/settings page, the color swatches give clear visual affordance, no clipping issues (learned from Phase 18's account-picker bug — added `overflow-visible` to the Contacts list `Card` up front this time instead of finding it via a screenshot).
- **DECISIONS:**
  - Only wired the assignment/filter **UI** onto Contacts this phase, even though the schema and API cover all four taggable entity types (Contact/Account/Lead/Opportunity) — Account, Lead, and Opportunity don't have a natural place for this yet without their own detail pages (Opportunity is Kanban-only, Lead/Account are flat lists with less row real estate); Phase 21's detail pages are the right home for tagging on those three, and the backend is already there waiting for it, no schema/API changes needed when that happens.
  - Tag colors are a closed set of 6, chosen at creation time — never a free hex picker or a hash-generated color, so the palette stays small and every color stays visually distinct (same reasoning as the dataviz skill's categorical-hue rule, applied here to a non-chart UI element).
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 20: tags/labels [verified]` and pushed to `origin/main`.
- **Next:** Phase 21 — record detail pages + notes + unified timeline (the biggest remaining gap: Contact/Lead/Opportunity have no detail page at all yet).

### Phase 21 — Record detail pages + notes + unified timeline — **DONE**

The gap analysis's single biggest finding, closed: Contact, Lead, and Opportunity previously had no detail page at all (flat list / Kanban-only), so the `Activity` timeline — correctly written to since Phase 4 — had nowhere to be shown to a user.

- Added `Note` (freeform, timestamped, `authorUserId` — `SetNull` on user deletion, same reasoning as `AuditLog`: content survives the author leaving). Same polymorphic `entityType`/`entityId` convention as `Activity`/`CustomFieldDefinition`/`TagAssignment`.
- `src/lib/timeline.ts`: `getTimeline()` merges `Activity` + `Note` rows for a record into one array sorted descending by `createdAt` — the actual "unified" part; a plain query per source would've left the operator manually interleaving two separate feeds.
- `POST /api/notes` (session-authed), validating the target entity belongs to the caller's tenant before creating the note (same switch-over-entityType pattern as Phase 20's tag-assignment check).
- **New detail pages:** `/contacts/[id]`, `/leads/[id]`, `/opportunities/[id]` (Kanban stays as the primary Opportunities view; each card's name is now a link to its detail page, `stopPropagation` on the link's `onMouseDown` so it doesn't fight the card's drag handler) — plus the existing `/accounts/[id]` (Phase 18) retrofitted with the same treatment. Every one shows: core fields, linked records (contact↔account↔opportunity, cross-linked), custom field values (Phase 19) and tags (Phase 20) if any are set, an `AddNoteForm`, and the merged `RecordTimeline`. Two new shared components (`add-note-form.tsx`, `record-timeline.tsx`) so all four pages render identically rather than four divergent implementations.
- Made every list page's rows link to their new detail page: Contacts, Leads, Account's child Contacts/Opportunities. Kanban cards link via their name.
- **Verified (all passing):** `npx tsc --noEmit`, `npm run lint`, `npm run test` — 98/98 (added `notes.test.ts`: note creation with author attribution, unauthenticated rejection, cross-tenant entity rejection, and a `getTimeline()` merge-ordering test proving Activity+Note rows interleave correctly by timestamp, not just get concatenated). `npm run build` — clean, all four new detail routes present.
- A real Playwright pass: clicked through from each list into its detail page, added a note on a Contact and confirmed it appeared in the timeline immediately, confirmed the Opportunity detail page (reached via a Kanban card click) shows its `opportunity.created` Activity entry correctly humanized, and confirmed the Account detail retrofit (created a fresh account, since the Phase 16 demo seed predates Accounts and has none — added one via the UI, not a bug) shows notes/timeline correctly too. Screenshots judged against the UI bar: identical Card-based layout across all four pages, consistent cross-links, no visual defects.
- **DECISIONS:**
  - Activity payload formatting in the timeline is deliberately minimal (a generic `from → to` renderer for stage-change-shaped payloads, otherwise just a humanized type label) rather than a per-event-type formatter for all ~15 event types — matches the "don't over-engineer" standing guidance; can be extended per-type later if a specific event's raw payload proves confusing in practice.
  - No detail page for the demo seed's other entities beyond what already existed (Forms/Webhooks/API Keys/Invoices/Calls) — out of scope for this phase, which was specifically the CRM-core-record gap the audit flagged.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 21: record detail pages + notes + unified timeline [verified]` and pushed to `origin/main`.
- **Next:** Phase 22 — email logging (manual "Log an email" action on a Contact, feeding the same timeline).

### Phase 22 — Email logging — **DONE**

- Added `EmailLog` (`contactId`, `direction` inbound/outbound, `subject`, `body`, `occurredAt`) — deliberately shaped the way a real IMAP/Gmail/Graph sync would populate it later, per the addendum's own framing: "designed so a sync could later feed the same table." Full inbox sync itself stays a **NON-GOAL (v1)** exactly as `PLAN.md` §7 already recorded.
- `POST /api/email-logs` (session-authed), validating the contact belongs to the caller's tenant.
- Extended `getTimeline()` to merge in a contact's `EmailLog` rows (sorted by `occurredAt`, not `createdAt`, so a backdated/logged-late email sorts by when it actually happened) alongside Activity and Notes — genuinely three sources merged now, not two.
- **UI:** a `LogEmailForm` component (direction select, subject, body) added to the Contact detail page only, per the addendum's exact scope ("a manual 'Log an email' action on a Contact"). `RecordTimeline` renders email entries as `Email sent/received — <subject>` with the body underneath, visually consistent with how notes render.
- **Verified (all passing):** `npx tsc --noEmit`, `npm run lint`, `npm run test` — 101/101 (added `email-logs.test.ts`: logging an email and confirming it surfaces correctly in `getTimeline()`, unauthenticated rejection, cross-tenant `contactId` rejection). `npm run build` — clean.
- A real Playwright pass on the Contact detail page: logged an outbound email, confirmed it appears correctly formatted in the timeline alongside existing notes. **Caught and fixed a test-script bug, not a product bug**, along the way: the page now has two `<textarea>` elements (Add Note, Log Email) and my first script filled the wrong one — the form's own native `required` validation correctly blocked the resulting empty submission, which is exactly what should happen; fixed the test to target the right textarea and re-verified.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 22: email logging [verified]` and pushed to `origin/main`.
- **Next:** Phase 23 — file attachments (`StorageProvider` interface, local-disk default).

### Phase 23 — File attachments — **DONE**

- Added a `StorageProvider` interface (`save`/`read`/`delete`, keyed by an opaque string) with a `LocalStorageProvider` default (writes under `.storage/attachments/`, gitignored) behind a `getStorageProvider()` factory — the exact same swap-later pattern as `CalendarProvider`: a real Azure Blob provider (the operator's Azure account already has one available) is additive whenever needed, no caller changes.
- Added `Attachment` (`entityType`/`entityId` — same polymorphic convention as Note/Tag/CustomFieldValue, so it covers Contact/Account/Lead/Opportunity uniformly — `fileName`, `contentType`, `sizeBytes`, `storageKey`, `uploadedByUserId`).
- `POST /api/attachments` accepts real `multipart/form-data` (Next.js route handlers support `request.formData()` natively), enforces a 10MB size cap and a narrow content-type allow-list (common images/PDF/Office docs/text — no executables or scripts), and validates the target entity belongs to the caller's tenant before writing anything to storage.
- `GET /api/attachments/:id/download` **always forces `Content-Disposition: attachment` and `Content-Type: application/octet-stream`**, regardless of the file's real type — per the addendum's explicit "never execute or inline-render uploads" requirement, this isn't just an HTTP header nicety, it's the actual security boundary: even if something slipped past the content-type allow-list, the browser is never given a reason to render it inline in this origin.
- **UI:** one reusable `AttachmentsSection` component (upload input + file list with size, download link, remove) wired identically onto all four detail pages (Contact/Account/Lead/Opportunity) — attachments, unlike email logging, weren't scoped to just Contact in the addendum.
- **Verified (all passing):** `npx tsc --noEmit`, `npm run lint`, `npm run test` — 107/107 (added `attachments.test.ts`: full upload→list→download→delete round-trip using real `File`/`FormData` objects — not mocked — confirming the downloaded bytes match exactly what was uploaded and that the download response's headers are correct; a disallowed content type rejected; a >10MB file rejected; unauthenticated rejection; cross-tenant upload rejected; cross-tenant download 404s). `npm run build` — clean.
- A real Playwright pass: uploaded a real file to a Contact's detail page via the native file input, confirmed it appears in the list immediately with its size. Screenshot judged against the UI bar: consistent with the Notes/Log-Email sections directly above it on the same page.
- **DECISIONS:**
  - Deliberately did not add image/PDF inline preview — the "download-only disposition" requirement is explicit and non-negotiable per the addendum, so there's no in-browser preview to build in the first place; clicking a file always downloads it.
  - Local disk storage lives outside the Next.js app's own directories conceptually (`.storage/`, not `public/`) so it's never accidentally served as a static asset by the framework itself.
- **NEEDS FROM OPERATOR:** none blocking. Flagging for awareness: `.storage/` is local-disk-only — on a real deployment (Phase 35) this needs to become a real `AzureBlobStorageProvider` (or a persistent volume), since most hosts don't guarantee a persistent local filesystem across deploys/restarts. Noted as a Phase 35 dependency, not solved yet.
- Committed as `Phase 23: file attachments [verified]` and pushed to `origin/main`.
- **Next:** Phase 24 — tasks/to-dos.

### Phase 24 — Tasks/to-dos — **DONE**

- Added `Task` (`title`, `dueDate`, `ownerUserId` — required, defaults to the creating user — optional `entityType`/`entityId` link, `status` open/done, `completedAt`).
- **Refactored the repeated "does this entityType/entityId belong to this tenant" check** (previously duplicated separately in tags, notes, and attachments) into one shared `src/lib/polymorphic-entity.ts` (`CRM_ENTITY_TYPES`, `crmEntityBelongsToTenant`) before adding a fourth copy for tasks — `attachments.ts`'s old names are kept as re-exports so nothing else needed to change. A small but real bit of consolidation, done at the point a 4th duplicate would have made the pattern worse, not before.
- API: `GET/POST /api/tasks` (supports `?mine=1`, `?entityType=&entityId=`, `?status=` filters) and `PATCH/DELETE /api/tasks/:id` — marking a task `done` stamps `completedAt`, reopening it clears that stamp.
- **UI:** a "My Tasks" page (open tasks first, a due-date pill that turns into a red "Overdue: <date>" badge once the date has passed and the task is still open, a collapsed "Done" section below) plus a reusable `RecordTasksSection` (quick-add + toggle-done list) wired onto all four detail pages, same pattern as Attachments.
- **Verified (all passing):** `npx tsc --noEmit`, `npm run lint`, `npm run test` — 113/113 (added `tasks.test.ts`: creation defaults ownership to the caller, done/reopen round-trip correctly stamping and clearing `completedAt`, record-linked task filtering, unauthenticated rejection, tenant isolation on update/delete, and cross-tenant `entityId` rejection). `npm run build` — clean.
- A real Playwright pass: created a task with a past due date on the My Tasks page and confirmed the overdue badge renders correctly, marked it done and confirmed it moves to the Done section, then added a task directly from a Contact's detail page and confirmed it shows up there too.
- **DECISIONS:**
  - No owner-picker UI yet on the task-creation forms — every task defaults to its creator. Folds naturally into Phase 25 (which is building the owner-picker UI pattern generally for Contact/Account, and could extend it here too) rather than building a one-off picker now.
  - `Task.owner` cascades on user deletion (like `Session`) rather than `SetNull` (like `Note.author`) — there's no user-deactivation flow yet (that's Phase 29), so this hasn't been exercised in practice; worth revisiting once Phase 29 makes user removal a real, reachable action.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 24: tasks/to-dos [verified]` and pushed to `origin/main`.
- **Next:** Phase 25 — record ownership completion (`ownerId` on Contact/Account, an owner picker, "my records" filters).

### Phase 25 — Record ownership completion — **DONE**

Closes the gap-analysis finding: `Lead.ownerUserId`/`Opportunity.ownerUserId` existed since Phase 4 and were already accepted by their APIs, but had no picker UI and no "my records" filter anywhere; `Contact`/`Account` had no owner column at all.

- Added `ownerUserId` to `Contact` and `Account` (`SetNull` on user deletion, same as every other owner-style FK in this schema).
- Wired `ownerUserId` into Contact's session **and** v1 create/update routes (4 files) with the same cross-tenant validation pattern as `accountId`; wired it into Account's session create/update routes (v1 Account ownerUserId support deliberately deferred — see decisions).
- Added a `?mine=1` filter to all four list GET routes (Contact, Account, Lead, Opportunity — the latter two already had the column, just needed the query param).
- **UI:** an owner `<select>` added to the Contact creation form (the flagship form, same scoping precedent as the Account picker and custom fields), and a single reusable `<MineToggle>` component wired onto all four list pages (Contacts, Accounts, Leads, Opportunities) — a toggle button that adds/removes `?mine=1` from the URL, preserving any other active filters (fixed `TagFilter` to merge into the existing query params instead of overwriting them, so "My records" + "tag filter" can be active together on Contacts).
- **Verified (all passing):** `npx tsc --noEmit`, `npm run lint`, `npm run test` — 116/116 (added `ownership.test.ts`: Contact ownerUserId set on create/cleared on update, `?mine=1` filtering on both Contact and Account, cross-tenant ownerUserId rejected). `npm run build` — clean.
- A real Playwright pass: created a contact with an explicit owner via the new picker, toggled "My records" on the Contacts page, and confirmed the list correctly narrowed to just that one contact.
- **DECISIONS:**
  - No owner-picker UI on the Account creation form yet (only Contact) — bounding scope the same way Custom Fields/Account-picker did in earlier phases; the API and `?mine=1` filter fully support it already, so adding the picker there later is a UI-only change.
  - Did not extend `ownerUserId` support to the v1 (n8n-facing) Account API — n8n's typical use case (creating records from external triggers) doesn't need to assign a human owner at creation time the way the CRM UI does; can add if a real workflow needs it.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 25: record ownership completion [verified]` and pushed to `origin/main`.
- **Next:** Phase 26 — products & price list.

### Phase 26 — Products & price list — **DONE**

- Added `Product` (`name`, optional `sku`, `unitPrice`, `currency`, `active`) — deliberately minimal, no inventory/variants/tax rules, matching the addendum's exact scope. No relation to Quote yet on purpose — that FK gets added in Phase 27 alongside the `QuoteLine` model, so this migration stands on its own rather than reaching forward into a model that doesn't exist yet.
- `GET/POST /api/products` (supports `?active=1`) and `PATCH/DELETE /api/products/:id`.
- **UI:** a Products page — create form, list with an active/inactive toggle badge (click to flip).
- **Verified (all passing):** `npx tsc --noEmit`, `npm run lint`, `npm run test` — 119/119 (added `products.test.ts`: CRUD, the `?active=1` filter correctly excluding a deactivated product, unauthenticated rejection, tenant isolation on update/delete). `npm run build` — clean.
- A real Playwright pass: created a product with a SKU and price, confirmed it lists correctly formatted as currency, toggled it inactive and confirmed the badge updates.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 26: products & price list [verified]` and pushed to `origin/main`.
- **Next:** Phase 27 — quotes (depends on Products for line items).

### Phase 27 — Quotes — **DONE**

- Added `Quote` (tied to an `Opportunity`, `status` draft/sent/accepted/declined) and `QuoteLine` (references a `Product` optionally, or is a free-typed line — `description`/`quantity`/`unitPrice` always stored on the line itself so a quote's wording/pricing at the time it was sent doesn't retroactively change if the product catalog changes later). Total is **always computed from lines at read time** (`src/lib/quotes.ts`), never cached on the `Quote` row — the schema comment states this explicitly so a future change doesn't accidentally introduce a stale cached total.
- `GET/POST /api/quotes` (list filterable by `?opportunityId=`, create with an array of lines in one request) and `GET/PATCH/DELETE /api/quotes/:id`. Validates every line's `productId` (if set) belongs to the caller's tenant before creating anything.
- **Accepting a quote updates the linked Opportunity's `value` to the quote's total** and logs a `quote.accepted` Activity entry on the opportunity — exactly the addendum's requirement, and it now shows up in that opportunity's unified timeline (Phase 21) for free.
- **UI:** a Quotes list page with a create form (opportunity picker, dynamic line-item rows — pick a product to autofill description/price, or type a free-form line, add/remove rows) and a Quote detail page: a clean line-item table with a computed total, status-transition buttons (draft→sent→accepted/declined, declined→draft to reopen), and a **Print button** using the browser's native print dialog with `print:hidden` on the sidebar/status-buttons/print-button itself — genuinely printable/PDF-able (browsers' "Save as PDF" print target), without building a separate PDF-rendering pipeline.
- **Verified (all passing):** `npx tsc --noEmit`, `npm run lint`, `npm run test` — 124/124 (added `quotes.test.ts`: quote creation with the total computed correctly across multiple lines, full read-back via list and get, **accepting a quote and confirming the opportunity's `value` actually changed in the database**, cross-tenant `productId` on a line rejected, unauthenticated rejection, tenant isolation on read/delete). `npm run build` — clean.
- A real Playwright pass: created a quote against a real opportunity with a line item, confirmed the total renders correctly formatted, walked it through Sent → Accepted, and confirmed the accepted state disables further status changes (no dangling "mark as X" buttons on a terminal state) and the Print button is present.
- **DECISIONS:**
  - No dedicated webhook event for quote status changes (e.g. `quote.accepted`) — the addendum didn't ask for one, and the existing Activity-log entry already gets a real customer-visible effect (the opportunity's timeline). Adding a new webhook event type is cheap to do later (additive, per `EVENTS.md`'s own rule) if an n8n flow ends up needing it.
  - No PDF-generation library — the print-friendly in-browser view is deliberately the whole "PDF-able" story here, matching a print-then-save-as-PDF workflow rather than a server-rendered PDF file.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 27: quotes [verified]` and pushed to `origin/main`.
- **Next:** Phase 28 — forecasting (weighted pipeline).

### Phase 28 — Forecasting (weighted pipeline) — **DONE**

- Added `PipelineStage.defaultProbability` (Int, 0–100) and set sensible defaults on the seeded default stages (new 10%, contacted 25%, qualified 50%, proposal 75%, closed_won 100%, closed_lost 0%). The custom-stage creation API (`POST /api/pipeline-stages`) now accepts an optional `defaultProbability` too.
- `getWeightedPipelineValue()` in `src/lib/reports.ts`: each stage's raw value × its `defaultProbability`, returned per-stage alongside the existing raw `getPipelineValueByStage` (both stay available — nothing about the raw report changed).
- Dashboard gained a fourth stat tile, "Weighted pipeline" — the sum of weighted value across all non-closed stages, formatted as currency.
- **Caught and fixed a real bug via the screenshot pass, not the test suite:** the dashboard first showed "Weighted pipeline: $0" against the seeded demo tenant, despite clearly having pipeline value. Root cause: `defaultProbability` is a genuinely new column with a schema default of `0` — only **newly seeded** tenants get the sensible per-key values from `DEFAULT_PIPELINE_STAGES` (via `seedDefaultPipelineStages`); every tenant that existed before this migration (including the demo tenant, and any real tenant on a live deployment) got `0` on all their existing stage rows and stayed at `0` forever, since `ensurePipelineStages` only seeds when a tenant has zero stage rows. Fixed with a second, explicitly data-only migration (`backfill_stage_default_probability`) that sets the sensible default for any stage row still at the column default `0` and matching a known default key — a tenant that already set their own value via the API keeps it; non-default custom stage keys are untouched. Re-verified the dashboard afterward: **$34,175**, matching the hand-calculated sum (800 + 3,750 + 6,000 + 23,625) exactly.
- **Verified (all passing):** `npx tsc --noEmit`, `npm run lint`, `npm run test` — 124/124 (extended the existing hand-verified `reports.test.ts` fixture — same known opportunities from Phase 13's original test — with weighted-value assertions computed by hand against the known default probabilities, rather than adding a new test file with a fresh fixture). `npm run build` — clean.
- A real Playwright pass against the dashboard, both before and after the backfill migration, is what actually caught and then confirmed the fix — the kind of bug automated tests alone wouldn't have caught, since a fresh test tenant always gets seeded with the correct values and never exercises the pre-existing-tenant backfill path.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 28: forecasting (weighted pipeline) [verified]` and pushed to `origin/main`.
- **Next:** Phase 29 — team management + role enforcement.

### Phase 29 — Team management + role enforcement — **DONE**

The gap analysis's most architecturally significant finding, closed: `Role` (`ADMIN`/`MEMBER`) has existed since Phase 2 with **zero enforcement anywhere** — confirmed by grep before starting this phase — every route let any authenticated tenant member do anything another member could.

- **Team management:** no email sending exists (a stated boundary since Phase 6), so per the addendum this is an admin-sets-initial-password flow, not an emailed invite link. `GET/POST /api/team` (admin-only, via a new `requireAdmin()` guard alongside the existing `requireSession()`) and `PATCH/DELETE /api/team/:id` (role changes, removal) — an admin can't demote or remove their own account (would be able to lock themselves out of team management with no recovery path). All four actions are audit-logged (`team.user_added`/`removed`/`role_changed`, reusing Phase 17's `AuditLog`).
- **Role-based visibility:** added `Tenant.restrictMemberVisibility` (default `false` — purely additive, no existing tenant's behavior changes unless an admin opts in) and `PATCH /api/team/settings` to toggle it. `src/lib/visibility.ts`'s `getOwnershipVisibilityWhere(user)` returns `{}` for an ADMIN or when the setting is off, and `{ ownerUserId: user.id }` for a restricted MEMBER — spread into the `where` clause of **every** Contact/Account/Lead/Opportunity list, get, update, and delete query (8 route files) alongside the existing tenant-isolation filter. A restricted member gets the same 404-not-403 treatment as cross-tenant access on someone else's record — enforced at the query layer, not hidden in the UI.
- **UI:** a Team page (admin-only — a non-admin visiting it sees a plain "Only admins can manage the team" message rather than an error) with an add-person form, a per-row role selector + remove button (self-row has neither, matching the API's self-protection), and a visibility-restriction toggle switch with a plain-English explanation of what it does.
- **Verified (all passing):** `npx tsc --noEmit`, `npm run lint`, `npm run test` — 129/129 — **zero regressions** across the full existing suite despite touching 8 already-shipped route files, plus a new `team.test.ts` covering exactly what the addendum asked for: "tests proving a restricted member cannot read or mutate another user's records through... the session API" — a real second user is created via the Team API, logged in for a real second session, and proven unable to GET/PATCH/DELETE a contact owned by the admin (404 on all three) while still able to access their own; a companion test proves the *default* (restriction off) behavior is unchanged — no false-positive locking of existing tenants. Also: non-admin rejected from `/api/team` (403), admin self-demotion/self-removal rejected (400). `npm run build` — clean.
- A real Playwright pass: added a team member through the UI, changed their role, removed them, and confirmed the visibility toggle renders and flips correctly. Cleaned up the test account from the demo tenant afterward via the same UI so the demo stays exactly as documented in `DEMO.md`.
- **DECISIONS:**
  - **v1 (API-key) surface is explicitly out of scope for this restriction** — an API key represents the tenant/integration itself, not a specific human user, so there's no "member" identity for the per-user ownership filter to apply to. The addendum's "through either the session API or the v1 API" phrasing assumes a per-user identity on both surfaces, which isn't how this project's dual-auth architecture works (documented back in Phase 8) — noted here rather than silently reinterpreting the requirement without saying so.
  - Granular per-field permissions remain a **NON-GOAL (v1)**, per the original plan — this is a single tenant-wide on/off switch plus role, nothing finer-grained.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 29: team management + role enforcement [verified]` and pushed to `origin/main`.
- **Next:** Phase 30 — audit log viewer (the log itself has existed since Phase 17; just needs a page).

### Phase 30 — Audit log viewer — **DONE**

A small, focused phase — the `AuditLog` model and `recordAuditLog()` have existed since Phase 17 and are already wired into every sensitive action; this phase is just the missing viewer.

- `GET /api/audit-log` (admin-only via `requireAdmin`), resolving each entry's `actorUserId` to an email via a batched lookup (no FK relation on `AuditLog` by design, per Phase 17 — entries survive user deletion, so a resolved-user lookup has to tolerate a since-deleted actor and fall back to "Unknown user").
- An Audit Log page (admin-only, same "Only admins can..." pattern as the Team page for a non-admin visitor), listing the 200 most recent entries with a humanized action label, the actor's email (or "System" for entries with no actor, or "Unknown user" if the actor account no longer exists), IP address, and timestamp.
- **Verified (all passing):** `npx tsc --noEmit`, `npm run lint`, `npm run test` — 132/132 (added `audit-log.test.ts`: an admin gets entries back with the actor's email correctly resolved — including finding the very `auth.signup` entry the test tenant's own creation wrote — a non-admin rejected with 403, unauthenticated rejected with 401). `npm run build` — clean.
- A real Playwright pass against the demo tenant confirmed the page renders real accumulated history correctly — every login from this session's own testing shows up, in order, with the right actor and timestamp, which is itself a good end-to-end proof that Phase 17's logging has been working correctly all along.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 30: audit log viewer [verified]` and pushed to `origin/main`.
- **Next:** Phase 31 — CSV export.

### Phase 31 — CSV export — **DONE**

- `src/lib/csv.ts`: a small, dependency-free CSV serializer (quotes/escapes cells containing commas, quotes, or newlines) — didn't reach for a library for something this small.
- `GET /api/export/:entity` (Contacts/Accounts/Leads/Opportunities), session-authed, applying the **same `getOwnershipVisibilityWhere` filter from Phase 29** — a restricted member's export contains only their own records, exactly like their list view. Every export writes a `data.exported` audit log entry (`entity`, `rowCount`) — visible on Phase 30's viewer.
- **UI:** an "Export CSV" link next to the existing filters on all four list pages, styled identically to every other secondary action.
- **Verified (all passing):** `npx tsc --noEmit`, `npm run lint`, `npm run test` — 135/135 (added `export.test.ts`: a real contact's data round-trips correctly into the CSV body, the response headers are correct (`text/csv`, `attachment; filename="contacts.csv"`), an audit log entry is written with the right entity/count, an unknown entity name is rejected with 400, unauthenticated rejected with 401). `npm run build` — clean.
- A real Playwright pass: clicked the Export CSV button on the (populated) demo tenant's Contacts page, captured the actual browser download, and confirmed the downloaded file has the right filename and the correct row count (13 contacts + 1 header line).
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 31: CSV export [verified]` and pushed to `origin/main`.
- **Next:** Phase 32 — per-contact hard delete (GDPR-style).

### Phase 32 — Per-contact hard delete — **DONE**

- **Confirmed a real, latent data-integrity gap while scoping this phase:** `Note`, `Activity`, `Attachment`, `TagAssignment`, `CustomFieldValue`, and `Task` are all polymorphic (`entityType`/`entityId`, no FK, by design — they attach to four different entity types) — which means the **existing, already-shipped plain `DELETE /api/contacts/:id`** (from Phase 4) has never cleaned any of them up. Deleting a contact today silently orphans every note, file, tag, task, and custom-field value ever attached to it. Deliberately left that route untouched (its existing behavior and tests stay exactly as they are — an "additive, don't rewrite what's verified" call) and instead added a **new, separate, admin-only endpoint** for the deliberate compliance action the addendum asked for.
- `DELETE /api/contacts/:id/hard-delete` (admin-only via `requireAdmin`): in one transaction, removes every polymorphic row pointing at the contact (Note/Activity/Attachment/TagAssignment/Task/CustomFieldValue) plus the Contact itself (which still cascades Lead/Opportunity/EmailLog via their real FKs, unchanged), then deletes each removed attachment's actual file from storage, then writes a `contact.hard_deleted` audit log entry (email, attachment count).
- **UI:** a "Delete permanently" control on the Contact detail page, visible only to admins, with an inline confirm/cancel step (not a native `window.confirm` — a real two-step UI matching the rest of the app's destructive-action pattern) before the request fires.
- **Verified (all passing):** `npx tsc --noEmit`, `npm run lint`, `npm run test` — 138/138 (added `hard-delete.test.ts` — the test that actually proves the gap is closed: creates a contact with a note, a tag assignment, a task, a custom field value, and an activity entry, confirms all of them exist, hard-deletes the contact, then confirms **every single one** is gone — not just the contact row — plus a non-admin rejected with 403 and cross-tenant rejected with 404). `npm run build` — clean.
- A real Playwright pass: created a throwaway contact, used the UI's confirm/cancel flow, confirmed the person and all their linked sections were genuinely gone after deletion (redirected to the Contacts list, no longer present).
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 32: per-contact hard delete [verified]` and pushed to `origin/main`.
- **Next:** Phase 33 — in-app search.

### Phase 33 — In-app search — **DONE**

- `GET /api/search?q=` — searches Contacts (name/email/company), Accounts (name), Leads (via their contact's name/email), and Opportunities (name) with case-insensitive `contains` matching, respecting both tenant isolation and Phase 29's `getOwnershipVisibilityWhere` (a restricted member's search results are scoped exactly like their list views). Capped at 5 results per entity type; queries under 2 characters return empty rather than hitting the database.
- **UI:** added a header bar above the main content area (the layout previously had none — just sidebar + main) containing a `<GlobalSearch>` box: debounced (250ms), grouped results by entity type, full keyboard support (↑/↓ to move, Enter to navigate to the highlighted result or the first one, Escape to close) — genuinely keyboard-friendly, not just clickable.
- **Verified (all passing):** `npx tsc --noEmit`, `npm run lint`, `npm run test` — 142/142 (added `search.test.ts`: matches found across all four entity types by a shared substring, a sub-2-character query returns empty results without querying, cross-tenant isolation confirmed, unauthenticated rejection). `npm run build` — clean.
- A real Playwright pass against the seeded demo tenant: typed a real contact's first name into the header search box, confirmed the grouped "Contacts" result appeared with the matching email as a sublabel, then drove it entirely by keyboard (arrow down, Enter) and confirmed it navigated to that contact's detail page.
- **Problem hit and fixed:** the initial implementation called `setGroups([])` synchronously inside the search `useEffect` when the query was too short, which ESLint's `react-hooks/set-state-in-effect` correctly flagged (the same rule caught in Phase 6). Fixed properly — same pattern as Phase 6 — by deriving the empty-state at render time (`displayedGroups`) instead of writing it into state from inside the effect.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 33: in-app search [verified]` and pushed to `origin/main`.
- **Next:** Phase 34 — UI consistency pass (bring every pre-addendum screen up to the addendum's UI bar in one sweep).

### Phase 34 — UI consistency pass — **DONE**

Real screenshot audit (per the addendum's requirement), not a rubber stamp: captured every pre-addendum screen not otherwise touched this session — Login, Signup, Forms, Webhooks, API Keys, Calls, Invoices — plus a fresh look at Dashboard/Contacts/Leads/Opportunities.

- **Most of the audited screens already passed** — a natural result of every phase this session reusing the same `Card`/`Badge`/typography/spacing conventions rather than inventing new ones. No changes made to those; changing working, already-compliant screens for the sake of touching them would have been exactly the kind of unnecessary churn the master prompt warns against.
- **One real, cross-cutting violation found and fixed:** the addendum's color rule — "pipeline stages, lead status, invoice status, task overdue-ness each get a stable colour treatment reused in every place that concept appears" — was being violated by every status/stage badge in the app rendering the same flat gray `variant="secondary"` regardless of what it said. A "qualified" lead looked identical to a "new" one; a "closed_won" opportunity looked identical to a "new" one. Only Tasks (Phase 24, overdue → red) had ever gotten real color treatment.
- Fixed by adding a `success` variant to the shared `Badge` component (emerald, styled consistently with the existing `destructive` variant's light/dark treatment) and a small `src/lib/status-badge.ts` mapping — `stageBadgeVariant`, `leadStatusBadgeVariant`, `quoteStatusBadgeVariant` — applied everywhere the corresponding badge renders: Opportunity stage (Kanban, Opportunity detail, Account detail's linked-opportunities list), Lead status (Leads list, Lead detail), and Quote status (Quotes list, Quote detail — quotes weren't in the addendum's literal list since they didn't exist yet when it was written, but the same reasoning applies directly).
- **Verified (all passing):** `npx tsc --noEmit`, `npm run lint`, `npm run test` — 142/142, zero regressions from the shared `Badge` component change. `npm run build` — clean.
- A real before/after Playwright screenshot on the Leads page is the actual proof: "qualified" leads now render with a distinct green badge while "new"/"contacted" stay neutral gray — visibly different where they were visually identical before.
- **DECISIONS:**
  - Left Calls (`booking.status`) and Invoices (`invoice.status`) unchanged — both currently only ever have one real-world value in practice (`confirmed` / `draft`), so there's no actual distinction to color yet; adding a mapping with only one branch would be speculative, not a fix for an observed problem. Revisit if either gains real status variety later.
  - `stageBadgeVariant`/`quoteStatusBadgeVariant` key off the literal strings `"closed_won"`/`"closed_lost"`/`"accepted"`/`"declined"` rather than a per-tenant `PipelineStage.isWon`/`isLost` lookup — matches the same magic-string convention already used in several other places in this codebase (the stage-change detection in the Opportunity PATCH routes, `getTimeSeries`). A tenant's custom pipeline stages (beyond the six defaults) won't get color-coded by this pass; a fully general version would need every stage-badge call site to join against `PipelineStage`, which is more machinery than this consistency pass's scope justified.
- **NEEDS FROM OPERATOR:** none blocking.
- Committed as `Phase 34: UI consistency pass [verified]` and pushed to `origin/main`.
- **Next:** Phase 35 — Azure deployment. The last phase.

### Phase 35 — Azure deployment — **DONE (locally verifiable parts); rest genuinely needs the operator**

This is the last phase in the gap-analysis plan (`PLAN.md` §7), so completing it — honestly, including the parts that aren't mine to finish — closes out the addendum.

- `next.config.ts`: added `output: "standalone"` — produces a self-contained `.next/standalone` build (own `node_modules` subset + `server.js` entrypoint), the leanest artifact for Azure App Service's Node runtime. Confirmed the build still produces `server.js`, `node_modules`, and `package.json` under `.next/standalone` as expected.
- `.github/workflows/deploy-azure.yml` (new): builds and deploys to Azure App Service via `azure/webapps-deploy@v3` on every push to `main` (plus manual `workflow_dispatch`). Copies `public/` and `.next/static` alongside the standalone server (standalone output doesn't bundle either). Gated on an `AZURE_WEBAPP_PUBLISH_PROFILE` GitHub secret the operator hasn't set yet — until they do, the workflow fails loudly at the deploy step rather than silently no-op'ing, which is the intended behavior for a misconfigured deploy.
- `DEPLOY.md` (new): the actual operator-facing checklist — Azure resource creation (App Service + Postgres Flexible Server), Application Settings/env vars (with `sslmode=require` called out for Azure Postgres, fresh `SESSION_SECRET`/`WEBHOOK_PROCESSOR_SECRET` generation, not reusing dev values), running `prisma migrate deploy` once against production, two deploy paths (GitHub Actions vs. manual zip-push), updating the Outlook Azure AD app's redirect URI for the real production domain, and — the one genuinely still-open architectural decision flagged since Phase 7 — a scheduler for `/api/webhooks/process-due` (recommended: Azure Logic Apps' Recurrence trigger, the simplest option for a non-technical operator; Azure Functions Timer Trigger documented as the code-based alternative).
- **A real, named limitation surfaced rather than glossed over:** Phase 23's `StorageProvider` defaults to local disk, and Azure App Service's filesystem isn't guaranteed to persist across restarts/scale-outs — uploaded attachments could vanish. Documented in `DEPLOY.md` §7 as non-blocking for a first deploy (only Attachments affected) with the real fix named (`AzureBlobStorageProvider` implementing the same `StorageProvider` interface) but not built — no invented cloud storage code that can't actually be verified without a real Azure Storage account.
- **Verified (all passing):** `npx tsc --noEmit`, `npm run lint`, `npm run test` — 142/142, `npm run build` — clean, confirmed `output: "standalone"` didn't change route output (same page/route list as Phase 34's build) and only added the standalone server artifact.
- **What could NOT be verified, and why:** the actual Azure deployment itself. I have no Azure credentials and creating real cloud resources, spending the operator's money, or making live calls against an Azure subscription on their behalf isn't something to do without their explicit action — this is the same standing boundary that kept Phase 15's real Outlook OAuth handshake honestly marked as verified-as-far-as-possible-without-a-live-login rather than faked complete.
- **NEEDS FROM OPERATOR (genuinely blocking, not busywork):**
  1. Create the Azure App Service + Postgres Flexible Server (`DEPLOY.md` §1).
  2. Set the Application Settings / env vars, including fresh production secrets (`DEPLOY.md` §2).
  3. Run `prisma migrate deploy` once against the production database (`DEPLOY.md` §3).
  4. Add the `AZURE_WEBAPP_PUBLISH_PROFILE` GitHub secret and set the real App Service name in the workflow file, OR do a manual zip deploy (`DEPLOY.md` §4).
  5. If using the real Outlook integration in production: register the production redirect URI on the Azure AD app and update `OUTLOOK_REDIRECT_URI` (`DEPLOY.md` §5).
  6. Stand up the Logic App (or Functions Timer) that calls `/api/webhooks/process-due` on a schedule (`DEPLOY.md` §6).
- Committed as `Phase 35: Azure deployment (standalone build, CI workflow, deploy checklist) [verified]` and pushed to `origin/main`.
- **Next:** none — this was the last phase in the gap-analysis plan. Remaining work is entirely the operator's own Azure account actions listed above; happy to pick the deployment verification back up (health check, first login, webhook delivery) once those are done.

### Phase 35b — Deployment target switched to free-tier (Neon + Vercel) — **DONE**

- **Operator decision:** no revenue yet, so defer the Azure spend. Deploy for free now on Neon (Postgres) + Vercel (hosting) + a scheduled GitHub Actions workflow (webhook retries), and migrate to Azure once there's a paying customer.
- `next.config.ts`: removed `output: "standalone"` — Vercel doesn't need it (has its own build/serve pipeline); left a comment to re-add it if/when this migrates to Azure App Service.
- Original Azure content moved from `DEPLOY.md` to a new `DEPLOY-AZURE.md`, framed explicitly as the future migration path — nothing thrown away, just relabeled. Noted there that Neon can keep serving as the database even after hosting itself moves to Azure, if the operator wants to split those two migrations.
- `.github/workflows/deploy-azure.yml`: disabled its `push`-triggered auto-deploy (switched to `workflow_dispatch`-only) rather than deleting it, so it doesn't fail loudly on every push while unused — ready to re-enable per `DEPLOY-AZURE.md`'s instructions when the Azure migration actually starts.
- Added `.github/workflows/webhook-cron.yml`: a scheduled workflow (every 5 minutes) that POSTs to `/api/webhooks/process-due` with the bearer secret — Vercel's free-tier cron is daily-only, too infrequent for webhook retries, and this reuses GitHub Actions (already in use for this repo) instead of introducing a new third-party cron service.
- Wrote a new `DEPLOY.md` covering the free stack end to end: Neon setup (calling out the **pooled** connection string specifically, since Vercel's serverless functions need PgBouncer-style pooling to avoid exhausting Postgres's connection limit — a detail that wouldn't have mattered on Azure App Service's single long-running process), the one-time migration, Vercel env vars/deploy, the Outlook redirect-URI update, activating the cron workflow via two GitHub repo secrets, and the same honestly-flagged attachments-storage caveat as before (now *stricter* on Vercel — serverless functions don't persist disk writes between requests at all, vs. Azure App Service's "not guaranteed to persist across restarts").
- **Verified (all passing):** `npx tsc --noEmit`, `npm run lint`, `npm run test` — 142/142, `npm run build` — clean (re-ran the full suite after the `next.config.ts` change, not just assumed removing a config line was safe).
- **NEEDS FROM OPERATOR:** none blocking for this commit itself. To actually go live: create the Neon project, run the one-time migration (see next entry — **already done** as of this session), import the repo into Vercel and set its env vars, and add the two GitHub secrets for the cron workflow — all in `DEPLOY.md`.
- Committed as `Switch deployment target to free-tier Neon + Vercel, defer Azure migration` and pushed to `origin/main`.

### Production database — provisioned and migrated (Neon) — **DONE**

- Operator created a Neon project and supplied the pooled connection string directly for a one-off command (never written to `.env`, which stays pointed at local dev per the operator's explicit instruction).
- Ran `prisma migrate deploy` against it: **all 25 migrations applied successfully**, from `20260722194650_init` through `20260723101406_add_tenant_restrict_visibility` — the complete schema history, including the `pg_trgm` extension migration and both `PipelineStage.defaultProbability` migrations (schema + data backfill).
- `npm run db:seed` was **not** run against it, per instruction — the production database has the real schema only, no demo tenant/data.
- Confirmed via `git status`/`git diff` that `.env` was not modified by this — the connection string was passed inline as a single-command environment variable, never persisted to disk in this repo.
- **NEEDS FROM OPERATOR:** the remaining Vercel-side steps in `DEPLOY.md` (§1 already done here, §2 already done here — proceed to §3: import the repo into Vercel and set the same `DATABASE_URL` there).
- Not a separate commit — no code changed, just production infrastructure state; logged here for the record per the master prompt's own standard of never leaving unverified/undocumented production changes.

---

## STUCK

_(none yet)_
