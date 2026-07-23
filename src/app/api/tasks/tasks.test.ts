import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { apiRequest, createTestTenant } from "@/lib/test-support";
import { GET as list, POST as create } from "./route";
import { PATCH as update, DELETE as remove } from "./[id]/route";
import { POST as createContact } from "@/app/api/contacts/route";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

describe("tasks", () => {
  it("creates a standalone task, defaults ownership to the caller, and lists it under 'mine'", async () => {
    const tenant = await createTestTenant("tasksBasic");
    createdTenantIds.push(tenant.tenantId);

    const createResponse = await create(
      apiRequest("/api/tasks", {
        method: "POST",
        cookie: tenant.cookie,
        body: { title: "Follow up with Acme" },
      }),
    );
    expect(createResponse.status).toBe(201);
    const { task } = await createResponse.json();
    expect(task.ownerUserId).toBe(tenant.userId);
    expect(task.status).toBe("open");

    const listResponse = await list(
      apiRequest("/api/tasks?mine=1", { method: "GET", cookie: tenant.cookie }),
    );
    const listBody = await listResponse.json();
    expect(listBody.tasks.some((t: { id: string }) => t.id === task.id)).toBe(
      true,
    );
  });

  it("marks a task done and sets completedAt, then reopens it", async () => {
    const tenant = await createTestTenant("tasksDone");
    createdTenantIds.push(tenant.tenantId);

    const createResponse = await create(
      apiRequest("/api/tasks", {
        method: "POST",
        cookie: tenant.cookie,
        body: { title: "Send proposal" },
      }),
    );
    const { task } = await createResponse.json();

    const doneResponse = await update(
      apiRequest(`/api/tasks/${task.id}`, {
        method: "PATCH",
        cookie: tenant.cookie,
        body: { status: "done" },
      }),
      { params: Promise.resolve({ id: task.id }) },
    );
    const done = await doneResponse.json();
    expect(done.task.status).toBe("done");
    expect(done.task.completedAt).toBeTruthy();

    const reopenResponse = await update(
      apiRequest(`/api/tasks/${task.id}`, {
        method: "PATCH",
        cookie: tenant.cookie,
        body: { status: "open" },
      }),
      { params: Promise.resolve({ id: task.id }) },
    );
    const reopened = await reopenResponse.json();
    expect(reopened.task.status).toBe("open");
    expect(reopened.task.completedAt).toBeNull();
  });

  it("links a task to a contact and filters by entityType/entityId", async () => {
    const tenant = await createTestTenant("tasksLinked");
    createdTenantIds.push(tenant.tenantId);

    const contactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { firstName: "Linked" },
      }),
    );
    const { contact } = await contactResponse.json();

    await create(
      apiRequest("/api/tasks", {
        method: "POST",
        cookie: tenant.cookie,
        body: {
          title: "Call about renewal",
          entityType: "contact",
          entityId: contact.id,
        },
      }),
    );

    const listResponse = await list(
      apiRequest(
        `/api/tasks?entityType=contact&entityId=${contact.id}`,
        { method: "GET", cookie: tenant.cookie },
      ),
    );
    const listBody = await listResponse.json();
    expect(listBody.tasks.length).toBe(1);
    expect(listBody.tasks[0].title).toBe("Call about renewal");
  });

  it("rejects requests with no session", async () => {
    const response = await list(new NextRequest("http://localhost:3000/api/tasks"));
    expect(response.status).toBe(401);
  });

  it("isolates tenants: tenant B cannot update or delete tenant A's task", async () => {
    const tenantA = await createTestTenant("tasksIsoA");
    const tenantB = await createTestTenant("tasksIsoB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);

    const createResponse = await create(
      apiRequest("/api/tasks", {
        method: "POST",
        cookie: tenantA.cookie,
        body: { title: "Secret task" },
      }),
    );
    const { task } = await createResponse.json();

    const updateAsB = await update(
      apiRequest(`/api/tasks/${task.id}`, {
        method: "PATCH",
        cookie: tenantB.cookie,
        body: { status: "done" },
      }),
      { params: Promise.resolve({ id: task.id }) },
    );
    expect(updateAsB.status).toBe(404);

    const deleteAsB = await remove(
      apiRequest(`/api/tasks/${task.id}`, {
        method: "DELETE",
        cookie: tenantB.cookie,
      }),
      { params: Promise.resolve({ id: task.id }) },
    );
    expect(deleteAsB.status).toBe(404);
  });

  it("rejects a task linked to an entity from another tenant", async () => {
    const tenantA = await createTestTenant("tasksCrossA");
    const tenantB = await createTestTenant("tasksCrossB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);

    const contactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenantA.cookie,
        body: { firstName: "Tenant A Contact" },
      }),
    );
    const { contact } = await contactResponse.json();

    const response = await create(
      apiRequest("/api/tasks", {
        method: "POST",
        cookie: tenantB.cookie,
        body: {
          title: "Snooping",
          entityType: "contact",
          entityId: contact.id,
        },
      }),
    );
    expect(response.status).toBe(400);
  });
});
