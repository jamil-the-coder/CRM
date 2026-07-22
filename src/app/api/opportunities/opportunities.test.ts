import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { apiRequest, createTestTenant } from "@/lib/test-support";
import { POST as createContact } from "@/app/api/contacts/route";
import { GET as list, POST as create } from "./route";
import { GET as getOne, PATCH as update, DELETE as remove } from "./[id]/route";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

async function makeContact(cookie: string) {
  const response = await createContact(
    apiRequest("/api/contacts", {
      method: "POST",
      cookie,
      body: { firstName: "Opp", lastName: "Contact" },
    }),
  );
  const body = await response.json();
  return body.contact.id as string;
}

describe("opportunities CRUD", () => {
  it("creates, lists, reads, updates through to closed_won (logging activities), and deletes", async () => {
    const tenant = await createTestTenant("opps");
    createdTenantIds.push(tenant.tenantId);
    const contactId = await makeContact(tenant.cookie);

    const createResponse = await create(
      apiRequest("/api/opportunities", {
        method: "POST",
        cookie: tenant.cookie,
        body: { contactId, name: "Big Deal", value: 5000 },
      }),
    );
    expect(createResponse.status).toBe(201);
    const { opportunity } = await createResponse.json();
    expect(opportunity.stage).toBe("new");

    const listResponse = await list(
      apiRequest("/api/opportunities", {
        method: "GET",
        cookie: tenant.cookie,
      }),
    );
    const listBody = await listResponse.json();
    expect(
      listBody.opportunities.some(
        (o: { id: string }) => o.id === opportunity.id,
      ),
    ).toBe(true);

    const getResponse = await getOne(
      apiRequest(`/api/opportunities/${opportunity.id}`, {
        method: "GET",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: opportunity.id }) },
    );
    expect(getResponse.status).toBe(200);

    const updateResponse = await update(
      apiRequest(`/api/opportunities/${opportunity.id}`, {
        method: "PATCH",
        cookie: tenant.cookie,
        body: { stage: "closed_won" },
      }),
      { params: Promise.resolve({ id: opportunity.id }) },
    );
    const updated = await updateResponse.json();
    expect(updated.opportunity.stage).toBe("closed_won");
    expect(updated.opportunity.closedAt).not.toBeNull();

    const activities = await db.activity.findMany({
      where: { entityType: "opportunity", entityId: opportunity.id },
    });
    expect(activities.some((a) => a.type === "opportunity.stage_changed")).toBe(
      true,
    );
    expect(activities.some((a) => a.type === "opportunity.closed_won")).toBe(
      true,
    );

    const deleteResponse = await remove(
      apiRequest(`/api/opportunities/${opportunity.id}`, {
        method: "DELETE",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: opportunity.id }) },
    );
    expect(deleteResponse.status).toBe(200);
  });

  it("isolates tenants: tenant B cannot read tenant A's opportunity", async () => {
    const tenantA = await createTestTenant("oppIsoA");
    const tenantB = await createTestTenant("oppIsoB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);
    const contactId = await makeContact(tenantA.cookie);

    const createResponse = await create(
      apiRequest("/api/opportunities", {
        method: "POST",
        cookie: tenantA.cookie,
        body: { contactId, name: "Secret Deal" },
      }),
    );
    const { opportunity } = await createResponse.json();

    const getAsB = await getOne(
      apiRequest(`/api/opportunities/${opportunity.id}`, {
        method: "GET",
        cookie: tenantB.cookie,
      }),
      { params: Promise.resolve({ id: opportunity.id }) },
    );
    expect(getAsB.status).toBe(404);
  });
});
