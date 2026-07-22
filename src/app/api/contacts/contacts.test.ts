import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { apiRequest, createTestTenant } from "@/lib/test-support";
import { GET as list, POST as create } from "./route";
import { GET as getOne, PATCH as update, DELETE as remove } from "./[id]/route";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

describe("contacts CRUD", () => {
  it("creates, lists, reads, updates, and deletes a contact", async () => {
    const tenant = await createTestTenant("contacts");
    createdTenantIds.push(tenant.tenantId);

    const createResponse = await create(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenant.cookie,
        body: {
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.com",
        },
      }),
    );
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    const contactId = created.contact.id as string;

    const listResponse = await list(
      apiRequest("/api/contacts", { method: "GET", cookie: tenant.cookie }),
    );
    const listBody = await listResponse.json();
    expect(listResponse.status).toBe(200);
    expect(
      listBody.contacts.some((c: { id: string }) => c.id === contactId),
    ).toBe(true);

    const getResponse = await getOne(
      apiRequest(`/api/contacts/${contactId}`, {
        method: "GET",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: contactId }) },
    );
    expect(getResponse.status).toBe(200);

    const updateResponse = await update(
      apiRequest(`/api/contacts/${contactId}`, {
        method: "PATCH",
        cookie: tenant.cookie,
        body: { company: "Analytical Engines Ltd" },
      }),
      { params: Promise.resolve({ id: contactId }) },
    );
    expect(updateResponse.status).toBe(200);
    const updated = await updateResponse.json();
    expect(updated.contact.company).toBe("Analytical Engines Ltd");

    const deleteResponse = await remove(
      apiRequest(`/api/contacts/${contactId}`, {
        method: "DELETE",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: contactId }) },
    );
    expect(deleteResponse.status).toBe(200);

    const getAfterDelete = await getOne(
      apiRequest(`/api/contacts/${contactId}`, {
        method: "GET",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: contactId }) },
    );
    expect(getAfterDelete.status).toBe(404);
  });

  it("flags an exact-email duplicate without blocking creation", async () => {
    const tenant = await createTestTenant("dupe-contact");
    createdTenantIds.push(tenant.tenantId);

    await create(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { firstName: "Grace", email: "grace@example.com" },
      }),
    );
    const secondResponse = await create(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { firstName: "G.", email: "grace@example.com" },
      }),
    );
    const secondBody = await secondResponse.json();
    expect(secondResponse.status).toBe(201);
    expect(secondBody.possibleDuplicates.length).toBe(1);
  });

  it("rejects requests with no session", async () => {
    const response = await list(
      new NextRequest("http://localhost:3000/api/contacts"),
    );
    expect(response.status).toBe(401);
  });

  it("isolates tenants: tenant B cannot read, update, or delete tenant A's contact", async () => {
    const tenantA = await createTestTenant("isoA");
    const tenantB = await createTestTenant("isoB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);

    const createResponse = await create(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenantA.cookie,
        body: { firstName: "Secret" },
      }),
    );
    const { contact } = await createResponse.json();

    const getAsB = await getOne(
      apiRequest(`/api/contacts/${contact.id}`, {
        method: "GET",
        cookie: tenantB.cookie,
      }),
      { params: Promise.resolve({ id: contact.id }) },
    );
    expect(getAsB.status).toBe(404);

    const updateAsB = await update(
      apiRequest(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        cookie: tenantB.cookie,
        body: { firstName: "Hijacked" },
      }),
      { params: Promise.resolve({ id: contact.id }) },
    );
    expect(updateAsB.status).toBe(404);

    const deleteAsB = await remove(
      apiRequest(`/api/contacts/${contact.id}`, {
        method: "DELETE",
        cookie: tenantB.cookie,
      }),
      { params: Promise.resolve({ id: contact.id }) },
    );
    expect(deleteAsB.status).toBe(404);

    const listAsB = await list(
      apiRequest("/api/contacts", { method: "GET", cookie: tenantB.cookie }),
    );
    const listAsBBody = await listAsB.json();
    expect(
      listAsBBody.contacts.some((c: { id: string }) => c.id === contact.id),
    ).toBe(false);
  });
});
