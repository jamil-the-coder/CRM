import { describe, expect, it, afterAll } from "vitest";
import { db } from "@/lib/db";
import { apiRequest, createTestTenant } from "@/lib/test-support";
import { GET as listContacts, POST as createContact } from "./route";
import { PATCH as updateContact } from "./[id]/route";
import { GET as listAccounts, POST as createAccount } from "@/app/api/accounts/route";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

describe("Contact/Account ownership", () => {
  it("sets ownerUserId on Contact create, allows updating it, and filters by ?mine=1", async () => {
    const tenant = await createTestTenant("contactOwnership");
    createdTenantIds.push(tenant.tenantId);

    const createResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { firstName: "Owned", ownerUserId: tenant.userId },
      }),
    );
    expect(createResponse.status).toBe(201);
    const { contact } = await createResponse.json();
    expect(contact.ownerUserId).toBe(tenant.userId);

    const mineResponse = await listContacts(
      apiRequest("/api/contacts?mine=1", { method: "GET", cookie: tenant.cookie }),
    );
    const mineBody = await mineResponse.json();
    expect(
      mineBody.contacts.some((c: { id: string }) => c.id === contact.id),
    ).toBe(true);

    const updateResponse = await updateContact(
      apiRequest(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        cookie: tenant.cookie,
        body: { ownerUserId: null },
      }),
      { params: Promise.resolve({ id: contact.id }) },
    );
    const updated = await updateResponse.json();
    expect(updated.contact.ownerUserId).toBeNull();
  });

  it("rejects an ownerUserId from another tenant on Contact create", async () => {
    const tenantA = await createTestTenant("ownerCrossA");
    const tenantB = await createTestTenant("ownerCrossB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);

    const response = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenantA.cookie,
        body: { firstName: "Cross", ownerUserId: tenantB.userId },
      }),
    );
    expect(response.status).toBe(400);
  });

  it("sets ownerUserId on Account create and filters by ?mine=1", async () => {
    const tenant = await createTestTenant("accountOwnership");
    createdTenantIds.push(tenant.tenantId);

    const createResponse = await createAccount(
      apiRequest("/api/accounts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { name: "Owned Co", ownerUserId: tenant.userId },
      }),
    );
    expect(createResponse.status).toBe(201);
    const { account } = await createResponse.json();
    expect(account.ownerUserId).toBe(tenant.userId);

    const mineResponse = await listAccounts(
      apiRequest("/api/accounts?mine=1", { method: "GET", cookie: tenant.cookie }),
    );
    const mineBody = await mineResponse.json();
    expect(
      mineBody.accounts.some((a: { id: string }) => a.id === account.id),
    ).toBe(true);
  });
});
