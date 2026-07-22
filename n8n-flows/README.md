# n8n Reference Flows

Importable n8n workflows that show how automation plugs into this CRM. Each one pairs a `.json` file (import directly into n8n) with a setup guide.

| Flow          | File                 | Guide                    | What it does                                                                |
| ------------- | -------------------- | ------------------------ | --------------------------------------------------------------------------- |
| Sales Agent   | `sales-agent.json`   | `sales-agent-setup.md`   | Triages a new lead, books a call, notifies the rep, writes the outcome back |
| Finance Agent | `finance-agent.json` | `finance-agent-setup.md` | Creates an invoice record when an opportunity closes won                    |

Together these two flows cover the full end-to-end mock journey described in `PLAN.md`: a lead comes in → gets triaged and a call booked → converts to an opportunity → closes won → an invoice is created — all visible on the CRM's dashboard.

See `../EVENTS.md` for the webhook contract these flows listen for, and `../API.md` for the REST API they call back into the CRM with.
