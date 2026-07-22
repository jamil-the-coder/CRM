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

describe("API key management", () => {
  it("creates a key (returning the full key once), lists it without the secret, and deletes it", async () => {
    const tenant = await createTestTenant("apiKeys");
    createdTenantIds.push(tenant.tenantId);

    const createResponse = await create(
      apiRequest("/api/api-keys", {
        method: "POST",
        cookie: tenant.cookie,
        body: { name: "n8n" },
      }),
    );
    expect(createResponse.status).toBe(201);
    const createBody = await createResponse.json();
    expect(createBody.key).toMatch(/^crm_live_/);
    expect(createBody.apiKey.name).toBe("n8n");

    const listResponse = await list(
      apiRequest("/api/api-keys", { method: "GET", cookie: tenant.cookie }),
    );
    const listBody = await listResponse.json();
    expect(listBody.apiKeys).toHaveLength(1);
    expect(listBody.apiKeys[0].keyPrefix).toBe(createBody.apiKey.keyPrefix);
    expect(JSON.stringify(listBody)).not.toContain(createBody.key);

    const deleteResponse = await remove(
      apiRequest(`/api/api-keys/${createBody.apiKey.id}`, {
        method: "DELETE",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: createBody.apiKey.id }) },
    );
    expect(deleteResponse.status).toBe(200);
  });
});
