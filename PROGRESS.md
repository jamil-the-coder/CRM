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

---

## STUCK

_(none yet)_
