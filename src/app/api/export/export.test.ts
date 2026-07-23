import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { apiRequest, createTestTenant } from "@/lib/test-support";
import { GET as exportEntity } from "./[entity]/route";
import { POST as createContact } from "@/app/api/contacts/route";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

describe("CSV export", () => {
  it("exports contacts as CSV, including a row for a created contact, and writes an audit log entry", async () => {
    const tenant = await createTestTenant("csvExport");
    createdTenantIds.push(tenant.tenantId);

    await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { firstName: "Exportable", email: "exportable@example.com" },
      }),
    );

    const response = await exportEntity(
      apiRequest("/api/export/contacts", {
        method: "GET",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ entity: "contacts" }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain(
      "contacts.csv",
    );

    const csv = await response.text();
    expect(csv).toContain("firstName");
    expect(csv).toContain("Exportable");
    expect(csv).toContain("exportable@example.com");

    const auditEntries = await db.auditLog.findMany({
      where: { tenantId: tenant.tenantId, action: "data.exported" },
    });
    expect(auditEntries.length).toBe(1);
    expect((auditEntries[0].metadata as { entity: string }).entity).toBe(
      "contacts",
    );
  });

  it("rejects an unknown export entity", async () => {
    const tenant = await createTestTenant("csvExportUnknown");
    createdTenantIds.push(tenant.tenantId);

    const response = await exportEntity(
      apiRequest("/api/export/bogus", { method: "GET", cookie: tenant.cookie }),
      { params: Promise.resolve({ entity: "bogus" }) },
    );
    expect(response.status).toBe(400);
  });

  it("rejects requests with no session", async () => {
    const response = await exportEntity(
      new NextRequest("http://localhost:3000/api/export/contacts"),
      { params: Promise.resolve({ entity: "contacts" }) },
    );
    expect(response.status).toBe(401);
  });
});
