import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { apiRequest, createTestTenant } from "@/lib/test-support";
import { DELETE as hardDeleteTenant } from "./hard-delete/route";
import { POST as createContact } from "@/app/api/contacts/route";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    // Most of these tenants delete themselves as part of the test; this is
    // just a safety net for any that didn't (e.g. a failed assertion before
    // the delete call ran).
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

describe("tenant hard delete", () => {
  it("permanently removes the entire tenant — every record, the user, and the session", async () => {
    const tenant = await createTestTenant("tenantHardDeleteBasic");
    createdTenantIds.push(tenant.tenantId);

    const contactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { firstName: "Should", lastName: "Vanish" },
      }),
    );
    const { contact } = await contactResponse.json();

    // Sanity check: it's really there before deleting.
    expect(await db.contact.findUnique({ where: { id: contact.id } })).not.toBeNull();
    expect(await db.user.findUnique({ where: { id: tenant.userId } })).not.toBeNull();

    const deleteResponse = await hardDeleteTenant(
      apiRequest("/api/tenant/hard-delete", { method: "DELETE", cookie: tenant.cookie }),
    );
    expect(deleteResponse.status).toBe(200);

    expect(await db.tenant.findUnique({ where: { id: tenant.tenantId } })).toBeNull();
    expect(await db.contact.findUnique({ where: { id: contact.id } })).toBeNull();
    expect(await db.user.findUnique({ where: { id: tenant.userId } })).toBeNull();

    const auditEntries = await db.auditLog.findMany({
      where: { tenantId: tenant.tenantId, action: "tenant.hard_deleted" },
    });
    expect(auditEntries.length).toBe(1);

    // The session backing this cookie is gone too — it can't be reused.
    const reuseResponse = await hardDeleteTenant(
      apiRequest("/api/tenant/hard-delete", { method: "DELETE", cookie: tenant.cookie }),
    );
    expect(reuseResponse.status).toBe(401);
  });

  it("rejects a non-admin", async () => {
    const tenant = await createTestTenant("tenantHardDeleteNonAdmin");
    createdTenantIds.push(tenant.tenantId);

    const { POST: createTeamUser } = await import("@/app/api/team/route");
    await createTeamUser(
      apiRequest("/api/team", {
        method: "POST",
        cookie: tenant.cookie,
        body: {
          email: "member@tenantHardDeleteNonAdmin.test.local",
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
          email: "member@tenantHardDeleteNonAdmin.test.local",
          password: "a-strong-password-123",
        }),
      }),
    );
    const token = loginResponse.cookies.get(SESSION_COOKIE_NAME)?.value;
    const memberCookie = `${SESSION_COOKIE_NAME}=${token}`;

    const response = await hardDeleteTenant(
      apiRequest("/api/tenant/hard-delete", { method: "DELETE", cookie: memberCookie }),
    );
    expect(response.status).toBe(403);

    // Untouched — the tenant is still there since the request was rejected.
    expect(await db.tenant.findUnique({ where: { id: tenant.tenantId } })).not.toBeNull();
  });

  it("rejects an unauthenticated caller", async () => {
    const response = await hardDeleteTenant(
      new NextRequest("http://localhost:3000/api/tenant/hard-delete", { method: "DELETE" }),
    );
    expect(response.status).toBe(401);
  });
});
