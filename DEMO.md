# DEMO.md — 5-Minute Demo Script

A walkthrough for showing this CRM to a prospective customer. Assumes the demo tenant is seeded (see below) and the app is running.

## Before you demo

```
npm run db:seed
npm run dev
```

Log in at `http://localhost:3000/login` with:

- **Email:** `admin@demo.test`
- **Password:** `demo-password-123`

This seeds one realistic company workspace: 12 contacts across 6 fictional companies, 9 leads at various stages, 8 opportunities spanning the whole pipeline (including two closed-won deals with invoices and one closed-lost), a sample embedded form with submissions, and a few booked calls. Re-running `npm run db:seed` resets it back to this same starting point any time — safe to run right before every demo.

## The walkthrough (~5 minutes)

### 1. Dashboard (30 seconds)

Land on **Dashboard**. Point out:

- The live counts (contacts, leads, open opportunities) at the top.
- **Pipeline value by stage** — where the money actually is right now.
- **Conversion funnel** — what fraction of leads make it from stage to stage.
- **Lead source breakdown** — which channels are actually producing leads.
- The 14-day **leads & deals** chart.

_Talking point: "Every one of these updates live — there's no separate reporting tool to keep in sync."_

### 2. Contacts → Leads → Opportunities (90 seconds)

Click through **Contacts**, then **Leads**, then **Opportunities**. On Opportunities:

- Point out the Kanban board — drag a card between two columns (e.g. move "Fernwood — Advisory Retainer" from Qualified to Proposal) and let them watch it move.

_Talking point: "Moving a card here doesn't just update a spreadsheet — it fires a real event other tools can react to. That's what the next two sections show."_

### 3. The embeddable form (60 seconds)

Go to **Forms**. Show the one seeded form and its embed snippet. If you want to demo it live:

1. Copy the embed URL from the snippet.
2. Open it in a new tab — that's exactly what a prospect sees embedded on a real website.
3. Submit it with a fake name/email.
4. Switch back to **Leads** and refresh — the new lead is there within seconds, tagged with its source.

_Talking point: "That's the whole capture flow — no manual data entry, and it's spam-protected out of the box."_

### 4. Automation (n8n) (90 seconds)

Go to **Webhooks** and **API Keys** — show that every event (a new lead, a stage change, a closed-won deal) can trigger an outside automation, and that n8n (or anything else) can read and write data back through a documented API.

If n8n is set up (see `/n8n-flows/`):

- Show the **Sales Agent** flow: a new lead comes in, gets scored, a call gets booked automatically, and the rep gets notified.
- Show the **Finance Agent** flow: closing a deal automatically creates an invoice record.

_Talking point: "This is the part most CRMs don't have — it's not just where your data lives, it's what does the work for you."_

### 5. Wrap-up (30 seconds)

Back to **Dashboard**. _"Everything you just saw — the form, the automations, the pipeline — feeds this one view. That's the pitch: one system of record, with the automation built in instead of bolted on."_

## If something goes wrong mid-demo

- **Data looks stale/messy from a previous demo:** run `npm run db:seed` again — it fully resets the demo tenant.
- **A chart looks empty:** the dashboard needs at least one contact to show anything but the empty state — confirm the seed ran (`npm run db:seed` prints a summary line when it finishes).
- **n8n flows aren't wired up:** that's fine — skip section 4's live automation and just describe it from `/n8n-flows/README.md`; the rest of the demo doesn't depend on it.
