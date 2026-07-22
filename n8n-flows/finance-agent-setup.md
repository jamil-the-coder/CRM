# Finance Agent — Setup Guide

This workflow reacts to a deal closing won and creates an invoice record — the second half of the CRM's end-to-end automated journey (Sales Agent books the call; Finance Agent bills for the closed deal).

## What it does

```
CRM opportunity.closed_won webhook
        │
        ▼
Verify the webhook signature
        │
        ▼
Prepare invoice data (opportunity ID + amount)
        │
        ▼
Create the invoice via the CRM API
   (this also automatically logs an
    invoice.created entry to the opportunity's
    timeline — nothing further to do for that)
        │
        ▼
Accounting Tool  ← replace this placeholder with a real
  (placeholder)     Xero/QuickBooks/Stripe node
```

## Before you import

Same prerequisites as the Sales Agent flow:

1. **An API key** — CRM → **API Keys** → Create key.
2. **A webhook secret** — CRM → **Webhooks** → Add endpoint (paste this workflow's webhook URL there once you have it — see step 3 below).
3. Your CRM's base URL.

## Import steps

1. In n8n: **Workflows → Import from File**, select `finance-agent.json`.
2. Open the **Config** node and fill in `crm_base_url`, `crm_api_key`, and `webhook_secret`.
3. Copy the **Opportunity Closed Won Webhook** node's Production URL.
4. In the CRM, add that URL as a Webhook Endpoint.
5. Replace **Accounting Tool (placeholder)** with a real Xero/QuickBooks/Stripe node — use the invoice ID from the **Create Invoice** step's output (`$json.invoice.id`) to link the two records.
6. Activate the workflow.

## How this was verified

Same rigor as the Sales Agent flow — imported into a real disposable n8n instance, activated, and triggered via a real HTTP POST to its production webhook URL against a real (test) closed-won opportunity in the CRM. It worked on the first real run, because the two lessons learned while building and verifying the Sales Agent flow were applied here from the start:

1. Signature verification uses n8n's built-in **Crypto** node (its Code node sandbox disallows `require('crypto')`).
2. The **Config** node has `includeOtherFields` turned on, so the original webhook payload survives past it.

The verified run created a real `Invoice` row (amount matching the opportunity's value) and confirmed the `invoice.created` activity was logged to the opportunity's timeline automatically by the CRM API — no extra "log to timeline" step needed in the workflow itself.

## Non-goals for this reference flow

- No real accounting-tool integration (Xero/QuickBooks/Stripe) — that's explicitly a v1 non-goal per `PLAN.md`; the placeholder node is where a customer's own accounting-tool credentials and mapping would go.
- No handling of partial payments, refunds, or invoice line items — this creates one invoice for the full opportunity value.
