# n8n Reference Flows

Importable n8n workflows that show how automation plugs into this CRM. Each one pairs a `.json` file (import directly into n8n) with a setup guide.

| Flow | File | Guide | What it does |
|---|---|---|---|
| Sales Agent | `sales-agent.json` | `sales-agent-setup.md` | Triages a new lead, books a call, notifies the rep, writes the outcome back |
| Finance Agent | *(Phase 12)* | *(Phase 12)* | Creates an invoice record when an opportunity closes won |

See `../EVENTS.md` for the webhook contract these flows listen for, and `../API.md` for the REST API they call back into the CRM with.
