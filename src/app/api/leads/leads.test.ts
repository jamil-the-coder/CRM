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
      body: { firstName: "Lead", lastName: "Source" },
    }),
  );
  const body = await response.json();
  return body.contact.id as string;
}

describe("leads CRUD", () => {
  it("creates, lists, reads, updates (with an activity log entry), and deletes a lead", async () => {
    const tenant = await createTestTenant("leads");
    createdTenantIds.push(tenant.tenantId);
    const contactId = await makeContact(tenant.cookie);

    const createResponse = await create(
      apiRequest("/api/leads", {
        method: "POST",
        cookie: tenant.cookie,
        body: { contactId, source: "form" },
      }),
    );
    expect(createResponse.status).toBe(201);
    const { lead } = await createResponse.json();
    expect(lead.status).toBe("new");

    const listResponse = await list(
      apiRequest("/api/leads", { method: "GET", cookie: tenant.cookie }),
    );
    const listBody = await listResponse.json();
    expect(listBody.leads.some((l: { id: string }) => l.id === lead.id)).toBe(
      true,
    );

    const getResponse = await getOne(
      apiRequest(`/api/leads/${lead.id}`, {
        method: "GET",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: lead.id }) },
    );
    expect(getResponse.status).toBe(200);

    const updateResponse = await update(
      apiRequest(`/api/leads/${lead.id}`, {
        method: "PATCH",
        cookie: tenant.cookie,
        body: { status: "qualified" },
      }),
      { params: Promise.resolve({ id: lead.id }) },
    );
    const updated = await updateResponse.json();
    expect(updated.lead.status).toBe("qualified");

    const activities = await db.activity.findMany({
      where: { entityType: "lead", entityId: lead.id },
    });
    expect(activities.some((a) => a.type === "lead.status_changed")).toBe(true);

    const deleteResponse = await remove(
      apiRequest(`/api/leads/${lead.id}`, {
        method: "DELETE",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: lead.id }) },
    );
    expect(deleteResponse.status).toBe(200);
  });

  it("rejects a contactId from another tenant", async () => {
    const tenantA = await createTestTenant("leadA");
    const tenantB = await createTestTenant("leadB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);
    const contactIdInA = await makeContact(tenantA.cookie);

    const response = await create(
      apiRequest("/api/leads", {
        method: "POST",
        cookie: tenantB.cookie,
        body: { contactId: contactIdInA },
      }),
    );
    expect(response.status).toBe(400);
  });

  it("isolates tenants: tenant B cannot read tenant A's lead", async () => {
    const tenantA = await createTestTenant("leadIsoA");
    const tenantB = await createTestTenant("leadIsoB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);
    const contactId = await makeContact(tenantA.cookie);

    const createResponse = await create(
      apiRequest("/api/leads", {
        method: "POST",
        cookie: tenantA.cookie,
        body: { contactId },
      }),
    );
    const { lead } = await createResponse.json();

    const getAsB = await getOne(
      apiRequest(`/api/leads/${lead.id}`, {
        method: "GET",
        cookie: tenantB.cookie,
      }),
      {
        params: Promise.resolve({ id: lead.id }),
      },
    );
    expect(getAsB.status).toBe(404);
  });
});
