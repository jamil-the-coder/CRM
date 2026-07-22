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

describe("activities", () => {
  it("creates a manual activity entry and lists it back, scoped to its tenant", async () => {
    const tenantA = await createTestTenant("activityA");
    const tenantB = await createTestTenant("activityB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);

    const createResponse = await create(
      apiRequest("/api/activities", {
        method: "POST",
        cookie: tenantA.cookie,
        body: {
          entityType: "contact",
          entityId: "some-contact-id",
          type: "note.added",
          payload: { note: "Called them" },
        },
      }),
    );
    expect(createResponse.status).toBe(201);
    const { activity } = await createResponse.json();

    const listAsA = await list(
      apiRequest(
        "/api/activities?entityType=contact&entityId=some-contact-id",
        {
          method: "GET",
          cookie: tenantA.cookie,
        },
      ),
    );
    const listAsABody = await listAsA.json();
    expect(
      listAsABody.activities.some((a: { id: string }) => a.id === activity.id),
    ).toBe(true);

    const listAsB = await list(
      apiRequest(
        "/api/activities?entityType=contact&entityId=some-contact-id",
        {
          method: "GET",
          cookie: tenantB.cookie,
        },
      ),
    );
    const listAsBBody = await listAsB.json();
    expect(
      listAsBBody.activities.some((a: { id: string }) => a.id === activity.id),
    ).toBe(false);
  });
});
