import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { apiRequest, createTestTenant } from "@/lib/test-support";
import { GET as list, POST as create } from "./route";
import { PATCH as update, DELETE as remove } from "./[id]/route";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

describe("products", () => {
  it("creates, lists, updates, and deletes a product", async () => {
    const tenant = await createTestTenant("productsCrud");
    createdTenantIds.push(tenant.tenantId);

    const createResponse = await create(
      apiRequest("/api/products", {
        method: "POST",
        cookie: tenant.cookie,
        body: { name: "Consulting Hour", sku: "CONS-1", unitPrice: 150 },
      }),
    );
    expect(createResponse.status).toBe(201);
    const { product } = await createResponse.json();
    expect(Number(product.unitPrice)).toBe(150);

    const listResponse = await list(
      apiRequest("/api/products", { method: "GET", cookie: tenant.cookie }),
    );
    const listBody = await listResponse.json();
    expect(
      listBody.products.some((p: { id: string }) => p.id === product.id),
    ).toBe(true);

    const updateResponse = await update(
      apiRequest(`/api/products/${product.id}`, {
        method: "PATCH",
        cookie: tenant.cookie,
        body: { active: false },
      }),
      { params: Promise.resolve({ id: product.id }) },
    );
    const updated = await updateResponse.json();
    expect(updated.product.active).toBe(false);

    const activeListResponse = await list(
      apiRequest("/api/products?active=1", {
        method: "GET",
        cookie: tenant.cookie,
      }),
    );
    const activeListBody = await activeListResponse.json();
    expect(
      activeListBody.products.some((p: { id: string }) => p.id === product.id),
    ).toBe(false);

    const deleteResponse = await remove(
      apiRequest(`/api/products/${product.id}`, {
        method: "DELETE",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: product.id }) },
    );
    expect(deleteResponse.status).toBe(200);
  });

  it("rejects requests with no session", async () => {
    const response = await list(new NextRequest("http://localhost:3000/api/products"));
    expect(response.status).toBe(401);
  });

  it("isolates tenants: tenant B cannot update or delete tenant A's product", async () => {
    const tenantA = await createTestTenant("productsIsoA");
    const tenantB = await createTestTenant("productsIsoB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);

    const createResponse = await create(
      apiRequest("/api/products", {
        method: "POST",
        cookie: tenantA.cookie,
        body: { name: "Secret Product", unitPrice: 10 },
      }),
    );
    const { product } = await createResponse.json();

    const updateAsB = await update(
      apiRequest(`/api/products/${product.id}`, {
        method: "PATCH",
        cookie: tenantB.cookie,
        body: { active: false },
      }),
      { params: Promise.resolve({ id: product.id }) },
    );
    expect(updateAsB.status).toBe(404);

    const deleteAsB = await remove(
      apiRequest(`/api/products/${product.id}`, {
        method: "DELETE",
        cookie: tenantB.cookie,
      }),
      { params: Promise.resolve({ id: product.id }) },
    );
    expect(deleteAsB.status).toBe(404);
  });
});
