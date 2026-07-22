# CRM

An AI-native, multi-tenant CRM built to be sold to other businesses, with bidirectional automation via n8n.

See [`PLAN.md`](./PLAN.md) for the full build plan (tech stack, phases, event contract, data model), [`PROGRESS.md`](./PROGRESS.md) for a running log of what's been built and verified so far, and [`DEMO.md`](./DEMO.md) for a 5-minute demo script to run for a prospective customer.

## Running locally

Requirements: Node.js 20+, npm, Docker (for the local Postgres database).

1. Install dependencies:
   ```
   npm install
   ```
2. Copy the environment template and fill in real values:
   ```
   cp .env.example .env
   ```
   Generate a real `SESSION_SECRET` (the placeholder value intentionally fails at startup as a safety check):
   ```
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
3. Start the local database:
   ```
   docker compose up -d
   ```
4. Apply the database schema and load demo data:
   ```
   npm run db:migrate
   npm run db:seed
   ```
5. Start the dev server:
   ```
   npm run dev
   ```
   The app runs at http://localhost:3000. A health check is available at http://localhost:3000/api/health.

## Useful commands

| Command                | What it does                                                |
| ---------------------- | ----------------------------------------------------------- |
| `npm run dev`          | Start the app in development mode                           |
| `npm run build`        | Build the app for production                                |
| `npm run start`        | Run a production build                                      |
| `npm run lint`         | Check code style/quality                                    |
| `npm run test`         | Run the automated test suite once                           |
| `npm run test:watch`   | Run tests continuously while developing                     |
| `npm run format`       | Auto-format all files                                       |
| `npm run format:check` | Check formatting without changing files                     |
| `npm run db:migrate`   | Apply database schema changes (Prisma migrations)           |
| `npm run db:generate`  | Regenerate the Prisma client after a schema change          |
| `npm run db:seed`      | Load demo data (a demo tenant + admin user, safe to re-run) |
| `npm run db:studio`    | Open Prisma Studio, a browser GUI for the database          |

The demo seed creates one tenant with an admin user (`admin@demo.test` / `demo-password-123`).

## Auth API (Phase 3)

Email/password auth with sessions stored in the database (not stateless JWTs), so revoking a session is just deleting a row. Cookies are `httpOnly`, `sameSite=lax`, and `secure` in production.

| Endpoint           | Method | What it does                                                  |
| ------------------ | ------ | ------------------------------------------------------------- |
| `/api/auth/signup` | POST   | Creates a new tenant + its first admin user, starts a session |
| `/api/auth/login`  | POST   | Logs in an existing user, starts a session                    |
| `/api/auth/logout` | POST   | Ends the current session                                      |
| `/api/auth/me`     | GET    | Returns the currently logged-in user, or 401                  |

Accounts lock for 15 minutes after 5 consecutive failed login attempts. Login, signup, the public form-config lookup, and the webhook-retry trigger are all IP-rate-limited (Phase 17); security-sensitive events (signup, login success/failure/lockout, logout, API key and webhook endpoint changes) are recorded to an audit log independent of the per-record activity timeline.

## Deploying

The app is a standard Next.js app plus a Postgres database — it runs on any host that gives you both. Railway and Render both work well for a single-operator deploy (one web service + one managed Postgres instance, no separate Redis or job queue required — rate limiting and webhook retries are Postgres-backed).

1. **Provision Postgres** and note its connection string.
2. **Deploy the app** pointing at this repo, with the build command `npm run build` and start command `npm run start`.
3. **Set environment variables** (see checklist below), then run migrations once against the production database:
   ```
   npx prisma migrate deploy
   ```
   (Do **not** run `npm run db:seed` against production — that's for local/demo data only.)
4. **Point your n8n instance** at the deployed app's `/api/v1/*` webhook and REST endpoints, using a real API key created from the app's API Keys page.

### Production environment variable checklist

| Variable                   | Required | Notes                                                                                   |
| --------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | Yes      | Your production Postgres connection string.                                              |
| `SESSION_SECRET`            | Yes      | A unique, long random value — generate with the command above. Never reuse the dev value. |
| `WEBHOOK_PROCESSOR_SECRET`  | Yes      | Bearer secret for the external scheduler that hits `/api/webhooks/process-due`.           |
| `CALENDAR_PROVIDER`         | No       | Leave unset (defaults to `mock`) until a real Google/Outlook provider is implemented.      |
| `ENRICHMENT_PROVIDER`       | No       | Leave unset (defaults to `noop`) until a real enrichment provider is implemented.          |
| `NODE_ENV=production`       | Yes      | Set by most hosts automatically — enables the `secure` cookie flag.                       |

You'll also need an external scheduler (cron) hitting `POST /api/webhooks/process-due` every few minutes with `Authorization: Bearer <WEBHOOK_PROCESSOR_SECRET>` to retry any failed webhook deliveries.
