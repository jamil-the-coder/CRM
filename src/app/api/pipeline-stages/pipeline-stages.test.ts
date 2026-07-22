import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { apiRequest, createTestTenant } from "@/lib/test-support";
import { GET as list, POST as create } from "./route";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

describe("pipeline stages", () => {
  it("has the default stages seeded automatically for a new tenant", async () => {
    const tenant = await createTestTenant("stages");
    createdTenantIds.push(tenant.tenantId);

    const response = await list(
      apiRequest("/api/pipeline-stages", {
        method: "GET",
        cookie: tenant.cookie,
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    const keys = body.stages.map((s: { key: string }) => s.key);
    expect(keys).toEqual([
      "new",
      "contacted",
      "qualified",
      "proposal",
      "closed_won",
      "closed_lost",
    ]);
    expect(
      body.stages.find((s: { key: string }) => s.key === "closed_won").isWon,
    ).toBe(true);
  });

  it("creates a custom stage appended at the end", async () => {
    const tenant = await createTestTenant("customStage");
    createdTenantIds.push(tenant.tenantId);
    await list(
      apiRequest("/api/pipeline-stages", {
        method: "GET",
        cookie: tenant.cookie,
      }),
    );

    const response = await create(
      apiRequest("/api/pipeline-stages", {
        method: "POST",
        cookie: tenant.cookie,
        body: { key: "negotiation", label: "Negotiation" },
      }),
    );
    expect(response.status).toBe(201);
    const { stage } = await response.json();
    expect(stage.sortOrder).toBe(6);
  });

  it("rejects a duplicate stage key", async () => {
    const tenant = await createTestTenant("dupeStage");
    createdTenantIds.push(tenant.tenantId);
    await list(
      apiRequest("/api/pipeline-stages", {
        method: "GET",
        cookie: tenant.cookie,
      }),
    );

    const response = await create(
      apiRequest("/api/pipeline-stages", {
        method: "POST",
        cookie: tenant.cookie,
        body: { key: "new", label: "New" },
      }),
    );
    expect(response.status).toBe(409);
  });
});
