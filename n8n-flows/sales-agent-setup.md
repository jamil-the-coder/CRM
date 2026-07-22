# Sales Agent — Setup Guide

This workflow reacts to a new lead in the CRM, scores it, books a call on the first available slot, and writes the outcome back — no manual triage needed. It's the first half of the CRM's end-to-end automated sales journey.

## What it does

```
CRM lead.created webhook
        │
        ▼
Verify the webhook signature (rejects anything not really from your CRM)
        │
        ▼
Triage the lead (simple scoring rules — swap for an AI step if you want)
        │
        ▼
Ask the CRM for available call slots
        │
        ▼
Book the first one
        │
        ▼
Notify the rep  ← replace this placeholder with a real Slack/Email node
        │
        ▼
Write the triage outcome (status + score) back onto the lead
```

## Before you import

You'll need, from the CRM:

1. **An API key** — CRM → **API Keys** → Create key. Copy it immediately; it's shown once.
2. **A webhook secret** — CRM → **Webhooks** → Add endpoint. You'll paste this workflow's webhook URL there in step 3 below, and the CRM will generate a secret for it — copy that too.
3. Your CRM's base URL (e.g. `https://yourcompany.crm.example.com`).

## Import steps

1. In n8n: **Workflows → Import from File**, select `sales-agent.json`.
2. Open the **Config** node (right after the trigger) and fill in:
   - `crm_base_url` — your CRM's base URL, no trailing slash.
   - `crm_api_key` — the API key from step 1 above.
   - `webhook_secret` — the secret the CRM generated in step 2 above.
3. Click the **Lead Created Webhook** node and copy its **Production URL**.
4. In the CRM, go to **Webhooks** → add that URL as an endpoint.
5. Replace the **Notify Rep (placeholder)** node with a real Slack or Email node (whatever your team actually uses) — it's intentionally a no-op so this flow doesn't accidentally message anyone during setup.
6. Activate the workflow (toggle in the top-right of the n8n editor).

## Customizing the triage logic

The **Triage Lead** node is a simple scoring rule (business-email domains and form-sourced leads score higher). To use an LLM instead:

- Replace it with an OpenAI (or similar) node.
- Prompt it to return a JSON object with `triageScore` (0-100) and `triageStatus` (a string) — every downstream node expects exactly those two field names on the item, so as long as your replacement produces them, nothing else needs to change.

## How this was verified

This isn't just a hand-written JSON file — it was actually imported into a running n8n instance, activated, and triggered via a real HTTP POST to its production webhook URL, running against a real (test) tenant in the CRM. That test caught and fixed two real bugs before this file was ever committed:

1. n8n's Code node sandbox disallows `require('crypto')` — signature verification now uses n8n's built-in **Crypto** node instead of hand-rolled Node crypto.
2. The **Config** node (a Set node) drops all other fields by default unless `includeOtherFields` is turned on — without it, every node after Config would have lost access to the original webhook payload.

The verified run: booked a real (mock-provider) call, wrote `qualified`/score `70` back onto a real test lead, and logged both a `call.booked` and `lead.status_changed` activity — confirmed directly against the database afterward.

## Non-goals for this reference flow

- No retry/backoff if the CRM API is briefly unreachable — add an n8n "Retry on Fail" setting on the HTTP Request nodes if you want that.
- No handling for "no slots available in the next 5 days" beyond throwing an error — extend the **Pick First Slot** node if you want a fallback (e.g. notify the rep to call manually).
