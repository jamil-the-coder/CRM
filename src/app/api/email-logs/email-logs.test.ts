import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { apiRequest, createTestTenant } from "@/lib/test-support";
import { POST as createEmailLog } from "./route";
import { POST as createContact } from "@/app/api/contacts/route";
import { getTimeline } from "@/lib/timeline";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

describe("email logs", () => {
  it("logs an email on a contact and it appears in the contact's timeline", async () => {
    const tenant = await createTestTenant("emailLogsBasic");
    createdTenantIds.push(tenant.tenantId);

    const contactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { firstName: "Devon" },
      }),
    );
    const { contact } = await contactResponse.json();

    const emailResponse = await createEmailLog(
      apiRequest("/api/email-logs", {
        method: "POST",
        cookie: tenant.cookie,
        body: {
          contactId: contact.id,
          direction: "outbound",
          subject: "Following up",
          body: "Just checking in on the proposal.",
        },
      }),
    );
    expect(emailResponse.status).toBe(201);

    const timeline = await getTimeline(tenant.tenantId, "contact", contact.id);
    const emailEntry = timeline.find((e) => e.kind === "email");
    expect(emailEntry).toBeDefined();
    if (emailEntry?.kind === "email") {
      expect(emailEntry.subject).toBe("Following up");
      expect(emailEntry.direction).toBe("outbound");
    }
  });

  it("rejects requests with no session", async () => {
    const response = await createEmailLog(
      new NextRequest("http://localhost:3000/api/email-logs", {
        method: "POST",
        body: JSON.stringify({
          contactId: "whatever",
          direction: "outbound",
          subject: "x",
          body: "x",
        }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects a contactId from another tenant", async () => {
    const tenantA = await createTestTenant("emailLogsCrossA");
    const tenantB = await createTestTenant("emailLogsCrossB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);

    const contactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenantA.cookie,
        body: { firstName: "Tenant A Contact" },
      }),
    );
    const { contact } = await contactResponse.json();

    const response = await createEmailLog(
      apiRequest("/api/email-logs", {
        method: "POST",
        cookie: tenantB.cookie,
        body: {
          contactId: contact.id,
          direction: "outbound",
          subject: "Snooping",
          body: "x",
        },
      }),
    );
    expect(response.status).toBe(400);
  });
});
