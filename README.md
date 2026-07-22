# CRM

An AI-native, multi-tenant CRM built to be sold to other businesses, with bidirectional automation via n8n.

See [`PLAN.md`](./PLAN.md) for the full build plan (tech stack, phases, event contract, data model) and [`PROGRESS.md`](./PROGRESS.md) for a running log of what's been built and verified so far.

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
3. Start the local database:
   ```
   docker compose up -d
   ```
4. Start the dev server:
   ```
   npm run dev
   ```
   The app runs at http://localhost:3000. A health check is available at http://localhost:3000/api/health.

## Useful commands

| Command                | What it does                            |
| ---------------------- | --------------------------------------- |
| `npm run dev`          | Start the app in development mode       |
| `npm run build`        | Build the app for production            |
| `npm run start`        | Run a production build                  |
| `npm run lint`         | Check code style/quality                |
| `npm run test`         | Run the automated test suite once       |
| `npm run test:watch`   | Run tests continuously while developing |
| `npm run format`       | Auto-format all files                   |
| `npm run format:check` | Check formatting without changing files |

Database schema and migrations are introduced in Phase 2 (Prisma) — this README will grow to cover `npx prisma migrate dev` and seeding once that lands.
