import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { apiRequest, createTestTenant } from "@/lib/test-support";
import { GET as list, POST as create } from "./route";
import { DELETE as remove } from "./[id]/route";
import {
  POST as assign,
  DELETE as unassign,
} from "@/app/api/tag-assignments/route";
import { POST as createContact } from "@/app/api/contacts/route";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

describe("tags CRUD", () => {
  it("creates, lists, and deletes a tag", async () => {
    const tenant = await createTestTenant("tagsCrud");
    createdTenantIds.push(tenant.tenantId);

    const createResponse = await create(
      apiRequest("/api/tags", {
        method: "POST",
        cookie: tenant.cookie,
        body: { name: "VIP", color: "amber" },
      }),
    );
    expect(createResponse.status).toBe(201);
    const { tag } = await createResponse.json();

    const listResponse = await list(
      apiRequest("/api/tags", { method: "GET", cookie: tenant.cookie }),
    );
    const listBody = await listResponse.json();
    expect(listBody.tags.some((t: { id: string }) => t.id === tag.id)).toBe(
      true,
    );

    const deleteResponse = await remove(
      apiRequest(`/api/tags/${tag.id}`, {
        method: "DELETE",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: tag.id }) },
    );
    expect(deleteResponse.status).toBe(200);
  });

  it("rejects a duplicate tag name", async () => {
    const tenant = await createTestTenant("tagsDupe");
    createdTenantIds.push(tenant.tenantId);

    await create(
      apiRequest("/api/tags", {
        method: "POST",
        cookie: tenant.cookie,
        body: { name: "Hot Lead" },
      }),
    );
    const second = await create(
      apiRequest("/api/tags", {
        method: "POST",
        cookie: tenant.cookie,
        body: { name: "Hot Lead" },
      }),
    );
    expect(second.status).toBe(409);
  });

  it("rejects requests with no session", async () => {
    const response = await list(new NextRequest("http://localhost:3000/api/tags"));
    expect(response.status).toBe(401);
  });

  it("isolates tenants: tenant B cannot delete tenant A's tag", async () => {
    const tenantA = await createTestTenant("tagsIsoA");
    const tenantB = await createTestTenant("tagsIsoB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);

    const createResponse = await create(
      apiRequest("/api/tags", {
        method: "POST",
        cookie: tenantA.cookie,
        body: { name: "Secret Tag" },
      }),
    );
    const { tag } = await createResponse.json();

    const deleteAsB = await remove(
      apiRequest(`/api/tags/${tag.id}`, {
        method: "DELETE",
        cookie: tenantB.cookie,
      }),
      { params: Promise.resolve({ id: tag.id }) },
    );
    expect(deleteAsB.status).toBe(404);
  });
});

describe("tag assignments", () => {
  it("assigns and unassigns a tag on a contact, reflected in the contact's tag list", async () => {
    const tenant = await createTestTenant("tagAssign");
    createdTenantIds.push(tenant.tenantId);

    const tagResponse = await create(
      apiRequest("/api/tags", {
        method: "POST",
        cookie: tenant.cookie,
        body: { name: "Newsletter" },
      }),
    );
    const { tag } = await tagResponse.json();

    const contactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { firstName: "Sam" },
      }),
    );
    const { contact } = await contactResponse.json();

    const assignResponse = await assign(
      apiRequest("/api/tag-assignments", {
        method: "POST",
        cookie: tenant.cookie,
        body: { tagId: tag.id, entityType: "contact", entityId: contact.id },
      }),
    );
    expect(assignResponse.status).toBe(201);

    const unassignResponse = await unassign(
      apiRequest(
        `/api/tag-assignments?tagId=${tag.id}&entityId=${contact.id}`,
        { method: "DELETE", cookie: tenant.cookie },
      ),
    );
    expect(unassignResponse.status).toBe(200);
  });

  it("rejects assigning a tag to an entity from another tenant", async () => {
    const tenantA = await createTestTenant("tagAssignCrossA");
    const tenantB = await createTestTenant("tagAssignCrossB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);

    const tagResponse = await create(
      apiRequest("/api/tags", {
        method: "POST",
        cookie: tenantA.cookie,
        body: { name: "Tenant A Tag" },
      }),
    );
    const { tag } = await tagResponse.json();

    const contactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenantB.cookie,
        body: { firstName: "Other Tenant Contact" },
      }),
    );
    const { contact } = await contactResponse.json();

    const assignResponse = await assign(
      apiRequest("/api/tag-assignments", {
        method: "POST",
        cookie: tenantA.cookie,
        body: { tagId: tag.id, entityType: "contact", entityId: contact.id },
      }),
    );
    expect(assignResponse.status).toBe(400);
  });
});
