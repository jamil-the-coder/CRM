import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { apiRequest, createTestTenant } from "@/lib/test-support";
import { GET as list, POST as create } from "./route";
import { GET as getOne, PATCH as update, DELETE as remove } from "./[id]/route";
import { POST as createContact } from "@/app/api/contacts/route";
import { POST as createOpportunity } from "@/app/api/opportunities/route";
import { POST as createProduct } from "@/app/api/products/route";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

async function makeOpportunity(cookie: string) {
  const contactResponse = await createContact(
    apiRequest("/api/contacts", { method: "POST", cookie, body: { firstName: "Buyer" } }),
  );
  const { contact } = await contactResponse.json();
  const opportunityResponse = await createOpportunity(
    apiRequest("/api/opportunities", {
      method: "POST",
      cookie,
      body: { contactId: contact.id, name: "Test Deal", value: 0 },
    }),
  );
  const { opportunity } = await opportunityResponse.json();
  return opportunity;
}

describe("quotes", () => {
  it("creates a quote with lines, computes the total, and lists/gets it", async () => {
    const tenant = await createTestTenant("quotesBasic");
    createdTenantIds.push(tenant.tenantId);
    const opportunity = await makeOpportunity(tenant.cookie);

    const createResponse = await create(
      apiRequest("/api/quotes", {
        method: "POST",
        cookie: tenant.cookie,
        body: {
          opportunityId: opportunity.id,
          lines: [
            { description: "Setup fee", quantity: 1, unitPrice: 500 },
            { description: "Monthly retainer", quantity: 3, unitPrice: 200 },
          ],
        },
      }),
    );
    expect(createResponse.status).toBe(201);
    const { quote } = await createResponse.json();
    expect(quote.total).toBe(1100);
    expect(quote.status).toBe("draft");

    const getResponse = await getOne(
      apiRequest(`/api/quotes/${quote.id}`, { method: "GET", cookie: tenant.cookie }),
      { params: Promise.resolve({ id: quote.id }) },
    );
    const got = await getResponse.json();
    expect(got.quote.total).toBe(1100);
    expect(got.quote.lines.length).toBe(2);

    const listResponse = await list(
      apiRequest(`/api/quotes?opportunityId=${opportunity.id}`, {
        method: "GET",
        cookie: tenant.cookie,
      }),
    );
    const listBody = await listResponse.json();
    expect(listBody.quotes.some((q: { id: string }) => q.id === quote.id)).toBe(
      true,
    );
  });

  it("accepting a quote updates the opportunity's value to the quote total", async () => {
    const tenant = await createTestTenant("quotesAccept");
    createdTenantIds.push(tenant.tenantId);
    const opportunity = await makeOpportunity(tenant.cookie);

    const createResponse = await create(
      apiRequest("/api/quotes", {
        method: "POST",
        cookie: tenant.cookie,
        body: {
          opportunityId: opportunity.id,
          lines: [{ description: "Package", quantity: 1, unitPrice: 4200 }],
        },
      }),
    );
    const { quote } = await createResponse.json();

    await update(
      apiRequest(`/api/quotes/${quote.id}`, {
        method: "PATCH",
        cookie: tenant.cookie,
        body: { status: "sent" },
      }),
      { params: Promise.resolve({ id: quote.id }) },
    );
    await update(
      apiRequest(`/api/quotes/${quote.id}`, {
        method: "PATCH",
        cookie: tenant.cookie,
        body: { status: "accepted" },
      }),
      { params: Promise.resolve({ id: quote.id }) },
    );

    const updatedOpportunity = await db.opportunity.findUnique({
      where: { id: opportunity.id },
    });
    expect(Number(updatedOpportunity!.value)).toBe(4200);
  });

  it("rejects a quote line's productId from another tenant", async () => {
    const tenantA = await createTestTenant("quotesCrossA");
    const tenantB = await createTestTenant("quotesCrossB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);

    const opportunity = await makeOpportunity(tenantA.cookie);
    const productResponse = await createProduct(
      apiRequest("/api/products", {
        method: "POST",
        cookie: tenantB.cookie,
        body: { name: "Tenant B Product", unitPrice: 10 },
      }),
    );
    const { product } = await productResponse.json();

    const response = await create(
      apiRequest("/api/quotes", {
        method: "POST",
        cookie: tenantA.cookie,
        body: {
          opportunityId: opportunity.id,
          lines: [
            { productId: product.id, description: "x", quantity: 1, unitPrice: 10 },
          ],
        },
      }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects requests with no session", async () => {
    const response = await list(new NextRequest("http://localhost:3000/api/quotes"));
    expect(response.status).toBe(401);
  });

  it("isolates tenants: tenant B cannot read or delete tenant A's quote", async () => {
    const tenantA = await createTestTenant("quotesIsoA");
    const tenantB = await createTestTenant("quotesIsoB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);
    const opportunity = await makeOpportunity(tenantA.cookie);

    const createResponse = await create(
      apiRequest("/api/quotes", {
        method: "POST",
        cookie: tenantA.cookie,
        body: {
          opportunityId: opportunity.id,
          lines: [{ description: "Secret", quantity: 1, unitPrice: 10 }],
        },
      }),
    );
    const { quote } = await createResponse.json();

    const getAsB = await getOne(
      apiRequest(`/api/quotes/${quote.id}`, { method: "GET", cookie: tenantB.cookie }),
      { params: Promise.resolve({ id: quote.id }) },
    );
    expect(getAsB.status).toBe(404);

    const deleteAsB = await remove(
      apiRequest(`/api/quotes/${quote.id}`, {
        method: "DELETE",
        cookie: tenantB.cookie,
      }),
      { params: Promise.resolve({ id: quote.id }) },
    );
    expect(deleteAsB.status).toBe(404);
  });
});
