import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { apiRequest, createTestTenant } from "@/lib/test-support";
import { GET as list, POST as create } from "./route";
import { DELETE as remove } from "./[id]/route";
import {
  GET as listContacts,
  POST as createContact,
} from "@/app/api/contacts/route";
import {
  GET as getContact,
  PATCH as updateContact,
} from "@/app/api/contacts/[id]/route";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

describe("custom field definitions", () => {
  it("creates, lists, and deletes a field definition", async () => {
    const tenant = await createTestTenant("customFieldsDef");
    createdTenantIds.push(tenant.tenantId);

    const createResponse = await create(
      apiRequest("/api/custom-fields", {
        method: "POST",
        cookie: tenant.cookie,
        body: {
          entityType: "contact",
          key: "favorite_color",
          label: "Favorite color",
          type: "text",
        },
      }),
    );
    expect(createResponse.status).toBe(201);
    const { field } = await createResponse.json();

    const listResponse = await list(
      apiRequest("/api/custom-fields?entityType=contact", {
        method: "GET",
        cookie: tenant.cookie,
      }),
    );
    const listBody = await listResponse.json();
    expect(
      listBody.fields.some((f: { id: string }) => f.id === field.id),
    ).toBe(true);

    const deleteResponse = await remove(
      apiRequest(`/api/custom-fields/${field.id}`, {
        method: "DELETE",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: field.id }) },
    );
    expect(deleteResponse.status).toBe(200);
  });

  it("rejects a select field with no options", async () => {
    const tenant = await createTestTenant("customFieldsSelect");
    createdTenantIds.push(tenant.tenantId);

    const response = await create(
      apiRequest("/api/custom-fields", {
        method: "POST",
        cookie: tenant.cookie,
        body: {
          entityType: "contact",
          key: "size",
          label: "Size",
          type: "select",
        },
      }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects requests with no session", async () => {
    const response = await list(
      new NextRequest("http://localhost:3000/api/custom-fields"),
    );
    expect(response.status).toBe(401);
  });

  it("isolates tenants: tenant B cannot delete tenant A's field definition", async () => {
    const tenantA = await createTestTenant("customFieldsIsoA");
    const tenantB = await createTestTenant("customFieldsIsoB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);

    const createResponse = await create(
      apiRequest("/api/custom-fields", {
        method: "POST",
        cookie: tenantA.cookie,
        body: {
          entityType: "contact",
          key: "secret_field",
          label: "Secret",
          type: "text",
        },
      }),
    );
    const { field } = await createResponse.json();

    const deleteAsB = await remove(
      apiRequest(`/api/custom-fields/${field.id}`, {
        method: "DELETE",
        cookie: tenantB.cookie,
      }),
      { params: Promise.resolve({ id: field.id }) },
    );
    expect(deleteAsB.status).toBe(404);
  });
});

describe("custom field values on Contact", () => {
  it("round-trips a value through create, get, list, and update", async () => {
    const tenant = await createTestTenant("customFieldsValues");
    createdTenantIds.push(tenant.tenantId);

    await create(
      apiRequest("/api/custom-fields", {
        method: "POST",
        cookie: tenant.cookie,
        body: {
          entityType: "contact",
          key: "shirt_size",
          label: "Shirt size",
          type: "select",
          options: ["S", "M", "L"],
        },
      }),
    );

    const createContactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenant.cookie,
        body: {
          firstName: "Priya",
          customFields: { shirt_size: "M", unknown_key: "ignored" },
        },
      }),
    );
    expect(createContactResponse.status).toBe(201);
    const created = await createContactResponse.json();
    expect(created.contact.customFields).toEqual({ shirt_size: "M" });
    const contactId = created.contact.id as string;

    const getResponse = await getContact(
      apiRequest(`/api/contacts/${contactId}`, {
        method: "GET",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: contactId }) },
    );
    const got = await getResponse.json();
    expect(got.contact.customFields).toEqual({ shirt_size: "M" });

    const listResponse = await listContacts(
      apiRequest("/api/contacts", { method: "GET", cookie: tenant.cookie }),
    );
    const listBody = await listResponse.json();
    const listedContact = listBody.contacts.find(
      (c: { id: string }) => c.id === contactId,
    );
    expect(listedContact.customFields).toEqual({ shirt_size: "M" });

    const updateResponse = await updateContact(
      apiRequest(`/api/contacts/${contactId}`, {
        method: "PATCH",
        cookie: tenant.cookie,
        body: { customFields: { shirt_size: "L" } },
      }),
      { params: Promise.resolve({ id: contactId }) },
    );
    const updated = await updateResponse.json();
    expect(updated.contact.customFields).toEqual({ shirt_size: "L" });
  });
});
