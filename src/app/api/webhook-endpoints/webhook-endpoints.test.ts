import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { apiRequest, createTestTenant } from "@/lib/test-support";
import { GET as list, POST as create } from "./route";
import { DELETE as remove } from "./[id]/route";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

describe("webhook endpoints management", () => {
  it("creates, lists, and deletes a webhook endpoint", async () => {
    const tenant = await createTestTenant("webhookEndpoints");
    createdTenantIds.push(tenant.tenantId);

    const createResponse = await create(
      apiRequest("/api/webhook-endpoints", {
        method: "POST",
        cookie: tenant.cookie,
        body: { url: "https://example.com/webhook" },
      }),
    );
    expect(createResponse.status).toBe(201);
    const { endpoint } = await createResponse.json();
    expect(endpoint.secret).toBeTruthy();

    const listResponse = await list(
      apiRequest("/api/webhook-endpoints", {
        method: "GET",
        cookie: tenant.cookie,
      }),
    );
    const listBody = await listResponse.json();
    expect(
      listBody.endpoints.some((e: { id: string }) => e.id === endpoint.id),
    ).toBe(true);

    const deleteResponse = await remove(
      apiRequest(`/api/webhook-endpoints/${endpoint.id}`, {
        method: "DELETE",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: endpoint.id }) },
    );
    expect(deleteResponse.status).toBe(200);
  });

  it.each([
    "http://localhost/webhook",
    "http://127.0.0.1/webhook",
    "http://10.0.0.5/webhook",
    "http://192.168.1.1/webhook",
    "http://169.254.169.254/latest/meta-data",
  ])("rejects a private/internal URL: %s", async (url) => {
    const tenant = await createTestTenant("webhookSsrf");
    createdTenantIds.push(tenant.tenantId);

    const response = await create(
      apiRequest("/api/webhook-endpoints", {
        method: "POST",
        cookie: tenant.cookie,
        body: { url },
      }),
    );
    expect(response.status).toBe(400);
  });
});
