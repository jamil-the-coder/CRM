import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { apiRequest, createTestTenant } from "@/lib/test-support";
import { GET as list, POST as upload } from "./route";
import { DELETE as remove } from "./[id]/route";
import { GET as download } from "./[id]/download/route";
import { POST as createContact } from "@/app/api/contacts/route";
import { getStorageProvider } from "@/lib/storage";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

function uploadRequest(options: {
  cookie: string;
  entityType: string;
  entityId: string;
  file: File;
}) {
  const formData = new FormData();
  formData.append("file", options.file);
  formData.append("entityType", options.entityType);
  formData.append("entityId", options.entityId);
  const request = new NextRequest("http://localhost:3000/api/attachments", {
    method: "POST",
    headers: { cookie: options.cookie },
    body: formData,
  });
  return request;
}

describe("attachments", () => {
  it("uploads, lists, downloads, and deletes a file attached to a contact", async () => {
    const tenant = await createTestTenant("attachmentsBasic");
    createdTenantIds.push(tenant.tenantId);

    const contactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { firstName: "Files" },
      }),
    );
    const { contact } = await contactResponse.json();

    const file = new File(["hello world"], "note.txt", { type: "text/plain" });
    const uploadResponse = await upload(
      uploadRequest({
        cookie: tenant.cookie,
        entityType: "contact",
        entityId: contact.id,
        file,
      }),
    );
    expect(uploadResponse.status).toBe(201);
    const { attachment } = await uploadResponse.json();
    expect(attachment.fileName).toBe("note.txt");

    const listResponse = await list(
      apiRequest(
        `/api/attachments?entityType=contact&entityId=${contact.id}`,
        { method: "GET", cookie: tenant.cookie },
      ),
    );
    const listBody = await listResponse.json();
    expect(
      listBody.attachments.some((a: { id: string }) => a.id === attachment.id),
    ).toBe(true);

    const downloadResponse = await download(
      apiRequest(`/api/attachments/${attachment.id}/download`, {
        method: "GET",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: attachment.id }) },
    );
    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers.get("content-disposition")).toContain(
      "attachment",
    );
    expect(downloadResponse.headers.get("content-type")).toBe(
      "application/octet-stream",
    );
    const downloadedText = await downloadResponse.text();
    expect(downloadedText).toBe("hello world");

    const deleteResponse = await remove(
      apiRequest(`/api/attachments/${attachment.id}`, {
        method: "DELETE",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: attachment.id }) },
    );
    expect(deleteResponse.status).toBe(200);

    // Confirm the underlying file was actually removed from storage, not
    // just the database row.
    const stillThere = await getStorageProvider().read(attachment.storageKey);
    expect(stillThere).toBeNull();
  });

  it("rejects a disallowed content type", async () => {
    const tenant = await createTestTenant("attachmentsBadType");
    createdTenantIds.push(tenant.tenantId);

    const contactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { firstName: "Bad Type" },
      }),
    );
    const { contact } = await contactResponse.json();

    const file = new File(["#!/bin/sh\necho hi"], "script.sh", {
      type: "application/x-sh",
    });
    const response = await upload(
      uploadRequest({
        cookie: tenant.cookie,
        entityType: "contact",
        entityId: contact.id,
        file,
      }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects a file over the size cap", async () => {
    const tenant = await createTestTenant("attachmentsTooBig");
    createdTenantIds.push(tenant.tenantId);

    const contactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { firstName: "Too Big" },
      }),
    );
    const { contact } = await contactResponse.json();

    const bigBuffer = new Uint8Array(11 * 1024 * 1024);
    const file = new File([bigBuffer], "big.png", { type: "image/png" });
    const response = await upload(
      uploadRequest({
        cookie: tenant.cookie,
        entityType: "contact",
        entityId: contact.id,
        file,
      }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects requests with no session", async () => {
    const response = await list(
      new NextRequest(
        "http://localhost:3000/api/attachments?entityType=contact&entityId=x",
      ),
    );
    expect(response.status).toBe(401);
  });

  it("rejects uploading against an entity from another tenant", async () => {
    const tenantA = await createTestTenant("attachmentsCrossA");
    const tenantB = await createTestTenant("attachmentsCrossB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);

    const contactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenantA.cookie,
        body: { firstName: "Tenant A Contact" },
      }),
    );
    const { contact } = await contactResponse.json();

    const file = new File(["x"], "x.txt", { type: "text/plain" });
    const response = await upload(
      uploadRequest({
        cookie: tenantB.cookie,
        entityType: "contact",
        entityId: contact.id,
        file,
      }),
    );
    expect(response.status).toBe(400);
  });

  it("isolates tenants: tenant B cannot download tenant A's attachment", async () => {
    const tenantA = await createTestTenant("attachmentsDownloadIsoA");
    const tenantB = await createTestTenant("attachmentsDownloadIsoB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);

    const contactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenantA.cookie,
        body: { firstName: "Secret Files" },
      }),
    );
    const { contact } = await contactResponse.json();

    const file = new File(["secret"], "secret.txt", { type: "text/plain" });
    const uploadResponse = await upload(
      uploadRequest({
        cookie: tenantA.cookie,
        entityType: "contact",
        entityId: contact.id,
        file,
      }),
    );
    const { attachment } = await uploadResponse.json();

    const downloadAsB = await download(
      apiRequest(`/api/attachments/${attachment.id}/download`, {
        method: "GET",
        cookie: tenantB.cookie,
      }),
      { params: Promise.resolve({ id: attachment.id }) },
    );
    expect(downloadAsB.status).toBe(404);

    // Cleanup the file this test wrote to disk.
    await getStorageProvider().delete(attachment.storageKey);
  });
});
