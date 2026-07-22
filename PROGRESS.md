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

---

## STUCK

_(none yet)_
