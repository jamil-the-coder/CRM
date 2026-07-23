import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { apiRequest, createTestTenant } from "@/lib/test-support";
import { POST as createContact } from "./route";
import { DELETE as hardDelete } from "./[id]/hard-delete/route";
import { POST as createNote } from "@/app/api/notes/route";
import { POST as createTag, } from "@/app/api/tags/route";
import { POST as assignTag } from "@/app/api/tag-assignments/route";
import { POST as createTask } from "@/app/api/tasks/route";
import { POST as createField } from "@/app/api/custom-fields/route";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

describe("per-contact hard delete", () => {
  it("removes the contact plus its notes, activity, tags, tasks, and custom field values — nothing orphaned", async () => {
    const tenant = await createTestTenant("hardDeleteBasic");
    createdTenantIds.push(tenant.tenantId);

    const contactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { firstName: "ToDelete" },
      }),
    );
    const { contact } = await contactResponse.json();

    await createNote(
      apiRequest("/api/notes", {
        method: "POST",
        cookie: tenant.cookie,
        body: { entityType: "contact", entityId: contact.id, body: "A note" },
      }),
    );

    const tagResponse = await createTag(
      apiRequest("/api/tags", {
        method: "POST",
        cookie: tenant.cookie,
        body: { name: "ToDeleteTag" },
      }),
    );
    const { tag } = await tagResponse.json();
    await assignTag(
      apiRequest("/api/tag-assignments", {
        method: "POST",
        cookie: tenant.cookie,
        body: { tagId: tag.id, entityType: "contact", entityId: contact.id },
      }),
    );

    await createTask(
      apiRequest("/api/tasks", {
        method: "POST",
        cookie: tenant.cookie,
        body: {
          title: "Follow up",
          entityType: "contact",
          entityId: contact.id,
        },
      }),
    );

    const fieldResponse = await createField(
      apiRequest("/api/custom-fields", {
        method: "POST",
        cookie: tenant.cookie,
        body: {
          entityType: "contact",
          key: "notes_field",
          label: "Notes field",
          type: "text",
        },
      }),
    );
    const { field } = await fieldResponse.json();
    await db.customFieldValue.create({
      data: {
        tenantId: tenant.tenantId,
        definitionId: field.id,
        entityId: contact.id,
        value: "some value",
      },
    });

    await db.activity.create({
      data: {
        tenantId: tenant.tenantId,
        entityType: "contact",
        entityId: contact.id,
        type: "contact.created",
      },
    });

    // Sanity check: everything actually exists before deleting.
    expect(
      await db.note.count({ where: { entityId: contact.id } }),
    ).toBeGreaterThan(0);
    expect(
      await db.tagAssignment.count({ where: { entityId: contact.id } }),
    ).toBeGreaterThan(0);
    expect(
      await db.task.count({ where: { entityId: contact.id } }),
    ).toBeGreaterThan(0);
    expect(
      await db.customFieldValue.count({ where: { entityId: contact.id } }),
    ).toBeGreaterThan(0);
    expect(
      await db.activity.count({ where: { entityId: contact.id } }),
    ).toBeGreaterThan(0);

    const deleteResponse = await hardDelete(
      apiRequest(`/api/contacts/${contact.id}/hard-delete`, {
        method: "DELETE",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: contact.id }) },
    );
    expect(deleteResponse.status).toBe(200);

    // Nothing left behind, for any of them.
    expect(await db.contact.findUnique({ where: { id: contact.id } })).toBeNull();
    expect(await db.note.count({ where: { entityId: contact.id } })).toBe(0);
    expect(
      await db.tagAssignment.count({ where: { entityId: contact.id } }),
    ).toBe(0);
    expect(await db.task.count({ where: { entityId: contact.id } })).toBe(0);
    expect(
      await db.customFieldValue.count({ where: { entityId: contact.id } }),
    ).toBe(0);
    expect(await db.activity.count({ where: { entityId: contact.id } })).toBe(
      0,
    );

    const auditEntries = await db.auditLog.findMany({
      where: { tenantId: tenant.tenantId, action: "contact.hard_deleted" },
    });
    expect(auditEntries.length).toBe(1);
  });

  it("rejects a non-admin", async () => {
    const tenant = await createTestTenant("hardDeleteNonAdmin");
    createdTenantIds.push(tenant.tenantId);

    const contactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { firstName: "Protected" },
      }),
    );
    const { contact } = await contactResponse.json();

    const { POST: createTeamUser } = await import("@/app/api/team/route");
    await createTeamUser(
      apiRequest("/api/team", {
        method: "POST",
        cookie: tenant.cookie,
        body: {
          email: "member@hardDeleteNonAdmin.test.local",
          password: "a-strong-password-123",
          role: "MEMBER",
        },
      }),
    );
    const { POST: login } = await import("@/app/api/auth/login/route");
    const { SESSION_COOKIE_NAME } = await import("@/lib/auth");
    const loginResponse = await login(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "member@hardDeleteNonAdmin.test.local",
          password: "a-strong-password-123",
        }),
      }),
    );
    const token = loginResponse.cookies.get(SESSION_COOKIE_NAME)?.value;
    const memberCookie = `${SESSION_COOKIE_NAME}=${token}`;

    const response = await hardDelete(
      apiRequest(`/api/contacts/${contact.id}/hard-delete`, {
        method: "DELETE",
        cookie: memberCookie,
      }),
      { params: Promise.resolve({ id: contact.id }) },
    );
    expect(response.status).toBe(403);
  });

  it("isolates tenants: tenant B cannot hard-delete tenant A's contact", async () => {
    const tenantA = await createTestTenant("hardDeleteIsoA");
    const tenantB = await createTestTenant("hardDeleteIsoB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);

    const contactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenantA.cookie,
        body: { firstName: "Secret" },
      }),
    );
    const { contact } = await contactResponse.json();

    const response = await hardDelete(
      apiRequest(`/api/contacts/${contact.id}/hard-delete`, {
        method: "DELETE",
        cookie: tenantB.cookie,
      }),
      { params: Promise.resolve({ id: contact.id }) },
    );
    expect(response.status).toBe(404);
  });
});
