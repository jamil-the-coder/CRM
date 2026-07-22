# EVENTS.md — CRM → n8n Webhook Contract

This is the contract for events the CRM sends **out** to your automation tool (n8n or anything else that can receive an HTTP webhook). For the API n8n uses to act **back on** the CRM, see `API.md` (Phase 8).

## How to receive events

1. In the CRM, go to **Webhooks** and add the webhook URL from your n8n workflow's Webhook trigger node.
2. The CRM immediately generates a secret for that endpoint (used for signature verification below) and stores it — it's never shown in the UI or logged; verification happens server-side only in this v1 (a "reveal secret for use in n8n's HMAC-check node" UI is a natural follow-up if you need to verify signatures from within n8n itself).
3. Every event listed below is POSTed to that URL as JSON.

## Envelope

Every delivery has this shape:

```json
{
  "event_id": "b3f1c9e2-...-uuid",
  "event_type": "lead.created",
  "api_version": "2026-07-22",
  "occurred_at": "2026-07-22T20:00:00.000Z",
  "tenant_id": "cln_...",
  "data": { "...event-specific payload..." }
}
```

- `event_id` — unique per delivery attempt group; retries of the same event reuse it.
- `api_version` — a date-stamped version string. New event types are additive; existing ones won't change shape without bumping this.
- `data` — shape depends on `event_type` (see below). Generally contains the full updated record (e.g. `{ "lead": {...} }`).

## Signature verification

Every request carries:

- `X-CRM-Signature: sha256=<hex>` — HMAC-SHA256 of the **raw request body**, keyed with the webhook endpoint's secret.
- `X-CRM-Event-Id` — same value as `data.event_id`, for easy access without parsing the body.

To verify in an n8n Function node (or any receiver): compute `HMAC-SHA256(secret, rawBody)` and compare it (constant-time) to the value after `sha256=`.

## Delivery guarantees

- **At-least-once.** A receiver that's briefly down will still get the event once it's back up.
- **Retry schedule** on a non-2xx response or a timeout (8s): 1 minute → 5 minutes → 30 minutes → 2 hours → 24 hours. After 5 attempts, the delivery is marked `failed` and stops retrying.
- Every attempt (success or failure) is recorded and visible on the **Webhooks** page in the CRM, including the response status/error, so you can debug a broken flow without touching a database.
- Retries are processed by `POST /api/webhooks/process-due`, which is meant to be triggered periodically (every 1–5 minutes) by an external scheduler — e.g. a cron job, GitHub Actions on a schedule, or your hosting platform's cron feature — hitting it with `Authorization: Bearer <WEBHOOK_PROCESSOR_SECRET>`. The initial delivery attempt for every event still happens immediately, inline, when the event occurs — the scheduled endpoint only matters for retries.

## Event types (v1)

| Event                       | Fires when                                                                                      | `data` shape                 |
| --------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------- |
| `lead.created`              | A lead is created (manually, via the API, or via a form submission)                             | `{ lead }`                   |
| `lead.updated`              | Any field on a lead changes                                                                     | `{ lead }`                   |
| `lead.status_changed`       | A lead's `status` specifically changes                                                          | `{ lead, from, to }`         |
| `opportunity.created`       | An opportunity is created                                                                       | `{ opportunity }`            |
| `opportunity.stage_changed` | An opportunity's `stage` changes                                                                | `{ opportunity, from, to }`  |
| `opportunity.closed_won`    | An opportunity's stage becomes `closed_won`                                                     | `{ opportunity }`            |
| `opportunity.closed_lost`   | An opportunity's stage becomes `closed_lost`                                                    | `{ opportunity }`            |
| `form.submitted`            | An embedded form is successfully submitted (spam/rate-limited submissions do **not** fire this) | `{ formId, formName, lead }` |
| `call.booked`               | A call is booked via the (Phase 9) calendar interface                                           | _(added in Phase 9)_         |

New event types are additive — existing subscribers are never broken by a new one being introduced.
