import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  apiKeyRequest,
  createTestApiKey,
  createTestTenant,
} from "@/lib/test-support";
import { POST as createContact } from "@/app/api/v1/contacts/route";
import { POST as createOpportunity } from "@/app/api/v1/opportunities/route";
import { GET as list, POST as create } from "./route";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

async function makeOpportunity(apiKey: string) {
  const contactResponse = await createContact(
    apiKeyRequest("/api/v1/contacts", {
      method: "POST",
      apiKey,
      body: { firstName: "Invoice", lastName: "Test" },
    }),
  );
  const { contact } = await contactResponse.json();
  const oppResponse = await createOpportunity(
    apiKeyRequest("/api/v1/opportunities", {
      method: "POST",
      apiKey,
      body: { contactId: contact.id, name: "Closed Deal", value: 2500 },
    }),
  );
  const { opportunity } = await oppResponse.json();
  return opportunity;
}

describe("v1 invoices", () => {
  it("creates an invoice against an opportunity and logs it to the timeline", async () => {
    const tenant = await createTestTenant("invoices");
    createdTenantIds.push(tenant.tenantId);
    const apiKey = await createTestApiKey(tenant.tenantId);
    const opportunity = await makeOpportunity(apiKey);

    const response = await create(
      apiKeyRequest("/api/v1/invoices", {
        method: "POST",
        apiKey,
        body: {
          opportunityId: opportunity.id,
          amount: 2500,
          externalRef: "xero-inv-001",
        },
      }),
    );
    expect(response.status).toBe(201);
    const { invoice } = await response.json();
    expect(invoice.amount).toBe("2500");
    expect(invoice.externalRef).toBe("xero-inv-001");

    const listResponse = await list(
      apiKeyRequest("/api/v1/invoices", { method: "GET", apiKey }),
    );
    const listBody = await listResponse.json();
    expect(
      listBody.invoices.some((i: { id: string }) => i.id === invoice.id),
    ).toBe(true);

    const activity = await db.activity.findFirst({
      where: {
        entityType: "opportunity",
        entityId: opportunity.id,
        type: "invoice.created",
      },
    });
    expect(activity).not.toBeNull();
  });

  it("rejects an opportunityId from another tenant", async () => {
    const tenantA = await createTestTenant("invoiceIsoA");
    const tenantB = await createTestTenant("invoiceIsoB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);
    const apiKeyA = await createTestApiKey(tenantA.tenantId);
    const apiKeyB = await createTestApiKey(tenantB.tenantId);
    const opportunity = await makeOpportunity(apiKeyA);

    const response = await create(
      apiKeyRequest("/api/v1/invoices", {
        method: "POST",
        apiKey: apiKeyB,
        body: { opportunityId: opportunity.id, amount: 100 },
      }),
    );
    expect(response.status).toBe(400);
  });
});
