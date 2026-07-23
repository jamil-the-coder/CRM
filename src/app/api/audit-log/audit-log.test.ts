import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { apiRequest, createTestTenant } from "@/lib/test-support";
import { GET as getAuditLog } from "./route";
import { POST as createUser } from "@/app/api/team/route";
import { POST as login } from "@/app/api/auth/login/route";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

describe("audit log viewer API", () => {
  it("returns entries with the actor's email resolved, for an admin", async () => {
    const tenant = await createTestTenant("auditLogViewer");
    createdTenantIds.push(tenant.tenantId);

    // Signup itself writes an auth.signup entry (Phase 17), so there's
    // already at least one entry actored by this tenant's admin.
    const response = await getAuditLog(
      apiRequest("/api/audit-log", { method: "GET", cookie: tenant.cookie }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.entries.length).toBeGreaterThan(0);
    const signupEntry = body.entries.find(
      (e: { action: string }) => e.action === "auth.signup",
    );
    expect(signupEntry).toBeDefined();
    expect(signupEntry.actorEmail).toBeTruthy();
  });

  it("rejects a non-admin", async () => {
    const tenant = await createTestTenant("auditLogNonAdmin");
    createdTenantIds.push(tenant.tenantId);

    await createUser(
      apiRequest("/api/team", {
        method: "POST",
        cookie: tenant.cookie,
        body: {
          email: "member@auditLogNonAdmin.test.local",
          password: "a-strong-password-123",
          role: "MEMBER",
        },
      }),
    );
    const loginResponse = await login(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "member@auditLogNonAdmin.test.local",
          password: "a-strong-password-123",
        }),
      }),
    );
    const token = loginResponse.cookies.get(SESSION_COOKIE_NAME)?.value;
    const memberCookie = `${SESSION_COOKIE_NAME}=${token}`;

    const response = await getAuditLog(
      apiRequest("/api/audit-log", { method: "GET", cookie: memberCookie }),
    );
    expect(response.status).toBe(403);
  });

  it("rejects requests with no session", async () => {
    const response = await getAuditLog(
      new NextRequest("http://localhost:3000/api/audit-log"),
    );
    expect(response.status).toBe(401);
  });
});
