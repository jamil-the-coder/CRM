import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { apiRequest, createTestTenant } from "@/lib/test-support";
import { GET as list, POST as create } from "./route";
import { GET as getOne, PATCH as update, DELETE as remove } from "./[id]/route";
import { POST as createContact } from "@/app/api/contacts/route";
import {
  POST as createOpportunity,
} from "@/app/api/opportunities/route";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

describe("accounts CRUD", () => {
  it("creates, lists, reads, updates, and deletes an account", async () => {
    const tenant = await createTestTenant("accounts");
    createdTenantIds.push(tenant.tenantId);

    const createResponse = await create(
      apiRequest("/api/accounts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { name: "Fernwood Advisory" },
      }),
    );
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    const accountId = created.account.id as string;

    const listResponse = await list(
      apiRequest("/api/accounts", { method: "GET", cookie: tenant.cookie }),
    );
    const listBody = await listResponse.json();
    expect(listResponse.status).toBe(200);
    expect(
      listBody.accounts.some((a: { id: string }) => a.id === accountId),
    ).toBe(true);

    const getResponse = await getOne(
      apiRequest(`/api/accounts/${accountId}`, {
        method: "GET",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: accountId }) },
    );
    expect(getResponse.status).toBe(200);

    const updateResponse = await update(
      apiRequest(`/api/accounts/${accountId}`, {
        method: "PATCH",
        cookie: tenant.cookie,
        body: { name: "Fernwood Advisory LLC" },
      }),
      { params: Promise.resolve({ id: accountId }) },
    );
    expect(updateResponse.status).toBe(200);
    const updated = await updateResponse.json();
    expect(updated.account.name).toBe("Fernwood Advisory LLC");

    const deleteResponse = await remove(
      apiRequest(`/api/accounts/${accountId}`, {
        method: "DELETE",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: accountId }) },
    );
    expect(deleteResponse.status).toBe(200);

    const getAfterDelete = await getOne(
      apiRequest(`/api/accounts/${accountId}`, {
        method: "GET",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: accountId }) },
    );
    expect(getAfterDelete.status).toBe(404);
  });

  it("rejects requests with no session", async () => {
    const response = await list(
      new NextRequest("http://localhost:3000/api/accounts"),
    );
    expect(response.status).toBe(401);
  });

  it("isolates tenants: tenant B cannot read, update, or delete tenant A's account", async () => {
    const tenantA = await createTestTenant("acctIsoA");
    const tenantB = await createTestTenant("acctIsoB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);

    const createResponse = await create(
      apiRequest("/api/accounts", {
        method: "POST",
        cookie: tenantA.cookie,
        body: { name: "Secret Co" },
      }),
    );
    const { account } = await createResponse.json();

    const getAsB = await getOne(
      apiRequest(`/api/accounts/${account.id}`, {
        method: "GET",
        cookie: tenantB.cookie,
      }),
      { params: Promise.resolve({ id: account.id }) },
    );
    expect(getAsB.status).toBe(404);

    const updateAsB = await update(
      apiRequest(`/api/accounts/${account.id}`, {
        method: "PATCH",
        cookie: tenantB.cookie,
        body: { name: "Hijacked" },
      }),
      { params: Promise.resolve({ id: account.id }) },
    );
    expect(updateAsB.status).toBe(404);

    const deleteAsB = await remove(
      apiRequest(`/api/accounts/${account.id}`, {
        method: "DELETE",
        cookie: tenantB.cookie,
      }),
      { params: Promise.resolve({ id: account.id }) },
    );
    expect(deleteAsB.status).toBe(404);
  });

  it("links a contact and an opportunity to an account, and the account detail aggregates both", async () => {
    const tenant = await createTestTenant("acctLink");
    createdTenantIds.push(tenant.tenantId);

    const accountResponse = await create(
      apiRequest("/api/accounts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { name: "Northwind Traders" },
      }),
    );
    const { account } = await accountResponse.json();

    const contactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { firstName: "Priya", accountId: account.id },
      }),
    );
    expect(contactResponse.status).toBe(201);
    const { contact } = await contactResponse.json();
    expect(contact.accountId).toBe(account.id);

    const opportunityResponse = await createOpportunity(
      apiRequest("/api/opportunities", {
        method: "POST",
        cookie: tenant.cookie,
        body: {
          contactId: contact.id,
          accountId: account.id,
          name: "Northwind Renewal",
          value: 5000,
        },
      }),
    );
    expect(opportunityResponse.status).toBe(201);
    const { opportunity } = await opportunityResponse.json();
    expect(opportunity.accountId).toBe(account.id);

    const detailResponse = await getOne(
      apiRequest(`/api/accounts/${account.id}`, {
        method: "GET",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: account.id }) },
    );
    const detail = await detailResponse.json();
    expect(detail.account.contacts.some((c: { id: string }) => c.id === contact.id)).toBe(true);
    expect(
      detail.account.opportunities.some(
        (o: { id: string }) => o.id === opportunity.id,
      ),
    ).toBe(true);
  });

  it("rejects a contact create with an accountId from another tenant", async () => {
    const tenantA = await createTestTenant("acctCrossA");
    const tenantB = await createTestTenant("acctCrossB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);

    const accountResponse = await create(
      apiRequest("/api/accounts", {
        method: "POST",
        cookie: tenantA.cookie,
        body: { name: "Tenant A Co" },
      }),
    );
    const { account } = await accountResponse.json();

    const contactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenantB.cookie,
        body: { firstName: "Cross Tenant", accountId: account.id },
      }),
    );
    expect(contactResponse.status).toBe(400);
  });
});
