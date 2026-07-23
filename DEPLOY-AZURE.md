# DEPLOY-AZURE.md — Migrating to Azure

**This is the future-migration path, not the current deployment.** Right now the app runs on the free-tier stack described in `DEPLOY.md` (Neon + Vercel + GitHub Actions cron) — no Azure cost while there's no revenue yet. Come back to this file once there's a paying customer and it's worth paying for App Service + managed Postgres.

A step-by-step deployment checklist, written for a non-technical operator. Targets **Azure App Service** (not Azure Container Apps) — App Service takes a plain Node.js app with no Dockerfile or container registry to maintain, which matches this project's "minimal moving parts" philosophy from `PLAN.md` §1. Container Apps is the right call if this ever needs to scale across regions or run sidecar processes — neither applies here.

Everything below is a real, ordered checklist. Some steps genuinely require the operator's own Azure account access — I can't create resources in an account I don't have credentials for, and I won't fake having done so. Where a step needs you specifically, it's marked **← you do this**.

**Before starting this migration:** re-add `output: "standalone"` to `next.config.ts` (it was removed when the app moved to Vercel — see that file's comment) and re-enable the `push` trigger in `.github/workflows/deploy-azure.yml` (currently `workflow_dispatch`-only so it doesn't fail loudly while unused). You'll also want to export the data from Neon and import it into the new Azure Postgres server, or just point `DATABASE_URL` at Neon permanently if you'd rather keep the database there and only move app hosting to Azure — Neon works fine as a database for an Azure-hosted app too, there's no requirement to use Azure's own Postgres.

---

## 1. Create the Azure resources **← you do this**

You'll need two things in the Azure Portal (or via `az` CLI if you're comfortable with it):

1. **Azure Database for PostgreSQL — Flexible Server**
   - Any region close to you; the cheapest "Burstable" tier is plenty to start.
   - Note the connection details: hostname, port (5432), admin username, password, database name.
   - Under the server's **Networking** settings, allow your App Service to connect (either "Allow public access from any Azure service" for simplicity, or a proper VNet integration if you want it tighter).

2. **Azure App Service** (Linux, Node 20 runtime)
   - Any tier that supports "Always On" (Basic B1 or above) — Free/Shared tiers sleep the app, which breaks session cookies and scheduled webhook retries.
   - Note the App Service's default hostname (`https://<your-app-name>.azurewebsites.net`) — you'll need it below.

## 2. Set environment variables **← you do this**

In the App Service's **Configuration → Application settings**, add every variable from the checklist below. These are the Azure equivalent of a `.env` file — never commit real values to git (the repo's `.env` is already gitignored).

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://<user>:<password>@<host>:5432/<db>?schema=public&sslmode=require` — note the `sslmode=require`, Azure Postgres requires TLS |
| `SESSION_SECRET` | Generate fresh: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` — never reuse the dev value |
| `WEBHOOK_PROCESSOR_SECRET` | Generate the same way — a different value than `SESSION_SECRET` |
| `NODE_ENV` | `production` |
| `PORT` | `8080` (Azure App Service's expected port for a custom Node server) |
| `CALENDAR_PROVIDER` | `outlook` if you want the real Outlook integration live in production, otherwise leave unset (defaults to `mock`) |
| `OUTLOOK_CLIENT_ID` / `OUTLOOK_CLIENT_SECRET` / `OUTLOOK_TENANT_ID` | Only needed if `CALENDAR_PROVIDER=outlook` — the same Azure AD app already registered |
| `OUTLOOK_REDIRECT_URI` | **Must change for production** — see step 5 below |
| `STORAGE_PROVIDER` | Leave unset (defaults to `local`) — see the file-storage caveat in step 6 |

## 3. Run the database migration once **← you do this, one time**

From your own machine, with `DATABASE_URL` pointed at the **production** database (not your local one):

```
DATABASE_URL="<production connection string>" npx prisma migrate deploy
```

This applies every migration in `prisma/migrations/` in order. Do **not** run `npm run db:seed` against production — that script is for local demo data only and would create a fake "Demo Tenant" in your real customers' database.

## 4. Deploy the app

Two ways to do this, pick whichever you're more comfortable with:

**Option A — GitHub Actions (recommended, automatic on every push to `main`)**

A workflow is already committed at `.github/workflows/deploy-azure.yml`. To activate it:

1. In the App Service's **Deployment Center**, choose "Download publish profile" and save the file.
2. In this repo's GitHub settings → **Secrets and variables → Actions**, add a new secret named `AZURE_WEBAPP_PUBLISH_PROFILE` with the entire contents of that downloaded file.
3. Edit `.github/workflows/deploy-azure.yml` and replace `your-crm-app-name` with your actual App Service name.
4. Push to `main` (or re-run the workflow manually from the Actions tab) — it builds and deploys automatically from here on.

**Option B — Manual deploy from your machine**

```
npm ci
npx prisma generate
npm run build
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
```

Then zip-deploy the `.next/standalone` folder via the Azure Portal's **Deployment Center → Manual deployment (zip push)**, or `az webapp deploy`.

In both cases, set the App Service's **Startup Command** (Configuration → General settings) to:

```
node server.js
```

## 5. Update the Outlook redirect URI for production **← you do this, if using Outlook**

The Azure AD app registration's redirect URI is currently `http://localhost:3000/api/auth/outlook/callback` (local dev only). Once the App Service is live:

1. In the Azure AD app registration's **Authentication** settings, add a second redirect URI: `https://<your-app-name>.azurewebsites.net/api/auth/outlook/callback`.
2. Update the `OUTLOOK_REDIRECT_URI` App Service setting to match exactly.
3. You can leave the localhost one registered too, so local development keeps working alongside production.

## 6. Point a scheduler at the webhook retry endpoint **← you do this**

This has been a documented gap since Phase 7 (`EVENTS.md`) — webhook retries need something to call `POST /api/webhooks/process-due` every few minutes. Two reasonable options on Azure:

- **Azure Logic Apps** — a "Recurrence" trigger (every 2–5 minutes) → an HTTP action `POST https://<your-app-name>.azurewebsites.net/api/webhooks/process-due` with header `Authorization: Bearer <WEBHOOK_PROCESSOR_SECRET>`. No code to write, configured entirely in the Azure Portal.
- **Azure Functions, Timer Trigger** — a small function on the same schedule making the same HTTP call, if you'd rather keep it as code.

Logic Apps is the simpler of the two for a non-technical operator — it's a few clicks, no deployment step of its own.

## 7. File attachments storage — a real limitation to know about

Phase 23's `StorageProvider` defaults to local disk (`.storage/attachments/` inside the app's own folder). **Azure App Service's filesystem is not guaranteed to persist across restarts or scale-outs** — an uploaded file could disappear the next time the app restarts. This is a genuine gap for a production deployment, not yet solved:

- **Not blocking a first deployment** — everything else works fine; only the Attachments feature (Phase 23) is affected.
- **The real fix** is a new `AzureBlobStorageProvider` implementing the same `StorageProvider` interface (`src/lib/storage/types.ts`) — additive, no caller changes, same pattern as everything else in this codebase — pointed at an Azure Storage Account (Blob container). Not built yet; flagged here rather than silently shipped as if it were solved.

## 8. Verify the live deployment

Once deployed:

- `https://<your-app-name>.azurewebsites.net/api/health` should return `{"status":"ok",...}`.
- Sign up a real test tenant, confirm login/logout work, confirm a webhook endpoint you add actually receives a delivery.
- Point your production n8n instance's `/api/v1/*` calls and webhook subscriptions at the new `https://<your-app-name>.azurewebsites.net` URL instead of `localhost:3000`.

---

## What's genuinely blocked without you

Everything above marked **← you do this** requires your own Azure account access, which I don't have and won't fabricate having used. Everything else — the standalone build config, the GitHub Actions workflow, this checklist itself — is done and committed. Once you've completed steps 1–2 (resources + config) and told me the App Service name and that the database is reachable, I can pick the deployment back up (running the migration, verifying the health check, etc.) — but the resource creation and secret-entry steps are yours by design, per the project's standing rule against making live third-party/production changes without your explicit action.
