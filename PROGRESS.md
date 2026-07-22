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
  - `shadcn@latest init -b neutral` failed — the `-b`/`--base` flag now selects the *component library* (`radix`/`base`/`aria`), not a Tailwind base color, in this shadcn CLI version. Used `-d` (defaults) instead.
  - `npm install -D @vitejs/plugin-react` hit an unresolvable peer-dependency conflict from a prerelease `@babel/core@8` chain pulled in transitively. Skipped that package for now — not needed for the current Node-environment health-check test — and will revisit when component-level tests are actually needed (Phase 5+).
  - `npm audit` reports 3 (later 6) vulnerabilities in `postcss`/`sharp`, bundled transitively inside `next`. The suggested `npm audit fix --force` would downgrade Next.js from v16 to v9 — clearly the wrong fix for a false-positive-shaped resolution path. Left as-is; flagging here for the operator rather than silently forcing a bad downgrade.
- **DECISIONS:**
  - Skipped `@vitejs/plugin-react`/component-testing setup for now (see above) — plain Vitest in Node environment is sufficient until real React components need testing.
- **NEEDS FROM OPERATOR:** none blocking. For awareness only: the `npm audit` findings above are transitive/likely false-positive for this Next.js version; no action taken.
- Committed as `Phase 1: project scaffolding & tooling [verified]` and pushed to `origin/main` (pre-authorized).
- **Next phase:** Phase 2 — Database & multi-tenancy foundation (Prisma schema for `Tenant`/`User`/`Session`, first migration, seed script).

---

## STUCK

_(none yet)_
