import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { apiRequest, createTestTenant } from "@/lib/test-support";
import { GET as search } from "./route";
import { POST as createContact } from "@/app/api/contacts/route";
import { POST as createAccount } from "@/app/api/accounts/route";
import { POST as createOpportunity } from "@/app/api/opportunities/route";
import { POST as createLead } from "@/app/api/leads/route";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

describe("global search", () => {
  it("finds matching contacts, accounts, leads, and opportunities by name, case-insensitively", async () => {
    const tenant = await createTestTenant("searchBasic");
    createdTenantIds.push(tenant.tenantId);

    const contactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { firstName: "Zenith", lastName: "Cooper" },
      }),
    );
    const { contact } = await contactResponse.json();

    await createAccount(
      apiRequest("/api/accounts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { name: "Zenith Robotics" },
      }),
    );

    await createLead(
      apiRequest("/api/leads", {
        method: "POST",
        cookie: tenant.cookie,
        body: { contactId: contact.id },
      }),
    );

    await createOpportunity(
      apiRequest("/api/opportunities", {
        method: "POST",
        cookie: tenant.cookie,
        body: { contactId: contact.id, name: "Zenith Renewal" },
      }),
    );

    const response = await search(
      apiRequest("/api/search?q=zenith", { method: "GET", cookie: tenant.cookie }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.contacts.some((c: { label: string }) => c.label.includes("Zenith"))).toBe(
      true,
    );
    expect(body.accounts.some((a: { label: string }) => a.label === "Zenith Robotics")).toBe(
      true,
    );
    expect(body.leads.length).toBeGreaterThan(0);
    expect(
      body.opportunities.some((o: { label: string }) => o.label === "Zenith Renewal"),
    ).toBe(true);
  });

  it("returns empty results for a query under 2 characters", async () => {
    const tenant = await createTestTenant("searchShort");
    createdTenantIds.push(tenant.tenantId);

    const response = await search(
      apiRequest("/api/search?q=z", { method: "GET", cookie: tenant.cookie }),
    );
    const body = await response.json();
    expect(body.contacts).toEqual([]);
    expect(body.accounts).toEqual([]);
  });

  it("does not return another tenant's matching records", async () => {
    const tenantA = await createTestTenant("searchIsoA");
    const tenantB = await createTestTenant("searchIsoB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);

    await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenantA.cookie,
        body: { firstName: "Uniquenom", lastName: "InTenantA" },
      }),
    );

    const response = await search(
      apiRequest("/api/search?q=uniquenom", {
        method: "GET",
        cookie: tenantB.cookie,
      }),
    );
    const body = await response.json();
    expect(body.contacts).toEqual([]);
  });

  it("rejects requests with no session", async () => {
    const response = await search(
      new NextRequest("http://localhost:3000/api/search?q=test"),
    );
    expect(response.status).toBe(401);
  });
});
