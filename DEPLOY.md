# DEPLOY.md — Deploying for free (Neon + Vercel)

A step-by-step deployment checklist for running this app at **zero hosting cost** while there's no revenue yet — Postgres on **Neon**'s free tier, the app itself on **Vercel**'s free tier, and webhook retries on a free scheduled GitHub Actions workflow already in this repo. Nothing here requires a credit card.

When there's a paying customer and it's worth paying for something sturdier, see `DEPLOY-AZURE.md` for the migration path — moving later is just changing a connection string and where the app is hosted, not a rewrite.

Some steps genuinely require your own Neon/Vercel/GitHub account access — I can't create accounts or resources on your behalf. Where a step needs you specifically, it's marked **← you do this**.

---

## 1. Create a free Neon Postgres database **← you do this**

1. Sign up at neon.com (a GitHub login works) and create a new project.
2. Neon gives you **two** connection strings — a direct one and a **pooled** one (the pooled hostname has `-pooler` in it). **Use the pooled one for `DATABASE_URL`.** This matters more here than it would self-hosting: Vercel runs your app as many short-lived serverless function instances, and a pooled connection (Neon runs PgBouncer for you) is what keeps that from exhausting Postgres's connection limit.
3. Append `?sslmode=require` to the pooled connection string if it isn't already there.

## 2. Run the database migration once **← you do this, one time**

From your own machine, with `DATABASE_URL` pointed at the **Neon** connection string from step 1:

```
DATABASE_URL="<neon pooled connection string>" npx prisma migrate deploy
```

This applies every migration in `prisma/migrations/` in order. Do **not** run `npm run db:seed` against it — that script is for local demo data only and would create a fake "Demo Tenant" in your real customers' database.

## 3. Deploy the app to Vercel **← you do this**

1. Sign up at vercel.com with your GitHub account and "Import" this repository — Vercel detects it's a Next.js app automatically, no config needed (the app has no custom Vercel config to write).
2. In the project's **Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | The Neon pooled connection string from step 1 |
| `SESSION_SECRET` | Generate fresh: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` — never reuse the local dev value |
| `WEBHOOK_PROCESSOR_SECRET` | Generate the same way — a different value than `SESSION_SECRET`. You'll need this again in step 5. |
| `CALENDAR_PROVIDER` | `outlook` if you want the real Outlook integration live in production, otherwise leave unset (defaults to `mock`) |
| `OUTLOOK_CLIENT_ID` / `OUTLOOK_CLIENT_SECRET` / `OUTLOOK_TENANT_ID` | Only needed if `CALENDAR_PROVIDER=outlook` — the same Azure AD app already registered |
| `OUTLOOK_REDIRECT_URI` | **Must change for production** — see step 4 below |

3. Click **Deploy**. Vercel builds and serves it, and from then on every push to `main` deploys automatically — no workflow file or secrets to manage on the GitHub side for this.
4. Note the project's Vercel URL (`https://<your-project>.vercel.app`, or a custom domain if you attach one later under **Settings → Domains**) — you'll need it in the next two steps.

## 4. Update the Outlook redirect URI for production **← you do this, if using Outlook**

The Azure AD app registration's redirect URI is currently `http://localhost:3000/api/auth/outlook/callback` (local dev only). Once Vercel is live:

1. In the Azure AD app registration's **Authentication** settings, add a second redirect URI: `https://<your-vercel-domain>/api/auth/outlook/callback`.
2. Update the `OUTLOOK_REDIRECT_URI` Vercel environment variable to match exactly, then redeploy (Vercel's dashboard has a "Redeploy" button — env var changes don't apply retroactively to an already-built deployment).
3. Leave the localhost one registered too, so local development keeps working alongside production.

## 5. Turn on the webhook retry cron **← you do this**

Vercel's free plan only allows cron jobs that run once a day, which is too infrequent for retrying due webhook deliveries — so this repo has a scheduled **GitHub Actions** workflow instead (`.github/workflows/webhook-cron.yml`, runs every 5 minutes, already committed). To activate it:

1. In this repo's GitHub **Settings → Secrets and variables → Actions**, add two repository secrets:
   - `APP_BASE_URL` — your Vercel URL from step 3, with no trailing slash (e.g. `https://your-project.vercel.app`)
   - `WEBHOOK_PROCESSOR_SECRET` — the exact same value you set in Vercel's environment variables in step 3
2. That's it — GitHub runs it on schedule automatically once the secrets exist. You can also trigger it manually from the Actions tab to test it (**Actions → Webhook retry ping → Run workflow**) and confirm it returns a 200, not a 401.

## 6. File attachments storage — a real limitation to know about

Phase 23's `StorageProvider` defaults to local disk (`.storage/attachments/`). **Vercel's serverless filesystem does not persist between requests at all** — this is a stricter version of the same caveat that would've applied on Azure App Service. Any uploaded attachment will very likely be gone by the next request. This is a genuine, not-yet-solved gap on this hosting stack:

- **Not blocking getting the rest of the app live** — every other feature works fully; only the Attachments feature (Phase 23) is affected.
- **The real fix** is a new storage provider implementing the same `StorageProvider` interface (`src/lib/storage/types.ts`) — additive, no caller changes — pointed at something with real persistence (Vercel Blob has a free tier and is the natural fit alongside Vercel hosting; Cloudflare R2 or an S3-compatible bucket would also work). Not built yet; flagged here rather than silently shipping attachments as if they worked.
- If a customer needs attachments to actually work before this is built, that's the signal to prioritize this over the Azure migration, not after it.

## 7. Verify the live deployment

Once deployed:

- `https://<your-vercel-domain>/api/health` should return `{"status":"ok",...}`.
- Sign up a real test tenant, confirm login/logout work.
- Add a webhook endpoint, trigger an event, and confirm it's delivered (the GitHub Actions cron from step 5 is what retries it if the first attempt fails — worth actually testing that path once, not just trusting it).
- Point your production n8n instance's `/api/v1/*` calls and webhook subscriptions at the new Vercel URL instead of `localhost:3000`.

---

## What's genuinely blocked without you

Everything above marked **← you do this** requires your own Neon/Vercel/GitHub account access, which I don't have and won't fabricate having used. Everything else — the app code, this checklist, the cron workflow — is done and committed. Tell me your Vercel URL once it's live and I can help verify the deployment (health check, a real webhook round-trip, etc.).

## Moving to Azure later

See `DEPLOY-AZURE.md`. Nothing here is a dead end — Neon can keep serving as the database even after the app itself moves to Azure App Service, if you'd rather migrate hosting and database on separate timelines.
