# API.md — CRM REST API (for n8n and other automation tools)

This is the API automation tools use to **act on** the CRM (create a lead, update a deal's stage, etc.). For events the CRM sends **out** to n8n, see `EVENTS.md`. A machine-readable version of everything below is in `openapi.yaml` — paste it into n8n's "Import from URL/file" for its HTTP Request node, or into any OpenAPI-aware tool.

## Authentication

1. In the CRM, go to **API Keys** and create one (give it a name like "n8n production"). The full key is shown **once** — copy it immediately.
2. Send it on every request as an `Authorization` header:
   ```
   Authorization: Bearer crm_live_xxxxxxxxxxxxxxxxxxxxxxxx
   ```
3. In n8n's HTTP Request node: set **Authentication** → **Generic Credential Type** → **Header Auth**, with the header name `Authorization` and value `Bearer <your key>`.

Every key is scoped to exactly one tenant (one company's workspace) — there's no way for a key to see or modify another tenant's data.

## Base URL

```
https://<your-crm-domain>/api/v1
```

## Endpoints

| Method | Path                                | What it does                                                                                                           |
| ------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| GET    | `/accounts`                         | List accounts                                                                                                          |
| POST   | `/accounts`                         | Create an account                                                                                                      |
| GET    | `/accounts/:id`                     | Get one account, including its linked contacts and opportunities                                                       |
| PATCH  | `/accounts/:id`                     | Update an account                                                                                                      |
| GET    | `/contacts`                         | List contacts                                                                                                          |
| POST   | `/contacts`                         | Create a contact (optionally with an `accountId`)                                                                      |
| GET    | `/contacts/:id`                     | Get one contact                                                                                                        |
| PATCH  | `/contacts/:id`                     | Update a contact                                                                                                       |
| GET    | `/leads`                            | List leads                                                                                                             |
| POST   | `/leads`                            | Create a lead (requires an existing `contactId`)                                                                       |
| GET    | `/leads/:id`                        | Get one lead                                                                                                           |
| PATCH  | `/leads/:id`                        | Update a lead — changing `status` fires `lead.status_changed`                                                          |
| GET    | `/opportunities`                    | List opportunities                                                                                                     |
| POST   | `/opportunities`                    | Create an opportunity (requires an existing `contactId`, optionally an `accountId`)                                    |
| GET    | `/opportunities/:id`                | Get one opportunity                                                                                                    |
| PATCH  | `/opportunities/:id`                | Update an opportunity — setting `stage` to `closed_won`/`closed_lost` fires the matching webhook and stamps `closedAt` |
| GET    | `/activities?entityType=&entityId=` | List timeline entries, optionally filtered                                                                             |
| POST   | `/activities`                       | Record a manual timeline entry (e.g. a note left by a workflow)                                                        |

There's no `DELETE` on this API by design — automations create and update records; deleting is a human/admin action done in the CRM itself.

Call booking endpoints (for the Sales Agent flow to book a slot on a lead) land in Phase 9 alongside the calendar integration.

## Example: creating a lead from an n8n flow

```
POST /api/v1/leads
Authorization: Bearer crm_live_...
Content-Type: application/json

{
  "contactId": "cln_abc123",
  "source": "n8n:website-chatbot",
  "score": 75
}
```

Response (`201`):

```json
{
  "lead": {
    "id": "cln_def456",
    "contactId": "cln_abc123",
    "source": "n8n:website-chatbot",
    "status": "new",
    "score": 75,
    "createdAt": "2026-07-22T21:00:00.000Z",
    "updatedAt": "2026-07-22T21:00:00.000Z"
  }
}
```

## Errors

All errors return `{ "error": "human-readable message" }` with an appropriate status code:

- `400` — invalid input, or you referenced a `contactId`/`leadId` from a different tenant
- `401` — missing or invalid API key
- `404` — the record doesn't exist (or belongs to another tenant — you'll get the same 404 either way, so a key can never be used to probe whether a specific ID exists elsewhere)

## Rate limits

Not yet enforced on this API (v1) — tracked as part of the Phase 17 hardening pass, alongside broader rate limiting across all public endpoints.
