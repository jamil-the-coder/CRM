import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  apiKeyRequest,
  createTestApiKey,
  createTestTenant,
} from "@/lib/test-support";
import { POST as createContact } from "@/app/api/v1/contacts/route";
import { POST as createLead } from "@/app/api/v1/leads/route";
import { GET as getSlots } from "@/app/api/v1/calendar/slots/route";
import { GET as listBookings, POST as createBooking } from "./route";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

describe("v1 calendar slots + call bookings", () => {
  it("lists available mock slots", async () => {
    const tenant = await createTestTenant("callSlots");
    createdTenantIds.push(tenant.tenantId);
    const apiKey = await createTestApiKey(tenant.tenantId);

    const response = await getSlots(
      apiKeyRequest("/api/v1/calendar/slots?durationMinutes=30", {
        method: "GET",
        apiKey,
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.provider).toBe("mock");
    expect(Array.isArray(body.slots)).toBe(true);
    expect(body.slots.length).toBeGreaterThan(0);
  });

  it("books a call against a lead, creates a CallBooking, and fires call.booked", async () => {
    const tenant = await createTestTenant("callBook");
    createdTenantIds.push(tenant.tenantId);
    const apiKey = await createTestApiKey(tenant.tenantId);

    const contactResponse = await createContact(
      apiKeyRequest("/api/v1/contacts", {
        method: "POST",
        apiKey,
        body: { firstName: "Sam" },
      }),
    );
    const { contact } = await contactResponse.json();
    const leadResponse = await createLead(
      apiKeyRequest("/api/v1/leads", {
        method: "POST",
        apiKey,
        body: { contactId: contact.id },
      }),
    );
    const { lead } = await leadResponse.json();

    const startsAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
    const endsAt = new Date(
      Date.now() + 24 * 60 * 60_000 + 30 * 60_000,
    ).toISOString();

    const bookingResponse = await createBooking(
      apiKeyRequest("/api/v1/call-bookings", {
        method: "POST",
        apiKey,
        body: {
          leadId: lead.id,
          startsAt,
          endsAt,
          attendeeEmail: "prospect@example.com",
        },
      }),
    );
    expect(bookingResponse.status).toBe(201);
    const { callBooking } = await bookingResponse.json();
    expect(callBooking.provider).toBe("mock");
    expect(callBooking.externalEventId).toMatch(/^mock_/);

    const listResponse = await listBookings(
      apiKeyRequest("/api/v1/call-bookings", { method: "GET", apiKey }),
    );
    const listBody = await listResponse.json();
    expect(
      listBody.callBookings.some(
        (b: { id: string }) => b.id === callBooking.id,
      ),
    ).toBe(true);

    const activity = await db.activity.findFirst({
      where: { entityType: "lead", entityId: lead.id, type: "call.booked" },
    });
    expect(activity).not.toBeNull();
  });

  it("rejects a leadId from another tenant", async () => {
    const tenantA = await createTestTenant("callIsoA");
    const tenantB = await createTestTenant("callIsoB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);
    const apiKeyA = await createTestApiKey(tenantA.tenantId);
    const apiKeyB = await createTestApiKey(tenantB.tenantId);

    const contactResponse = await createContact(
      apiKeyRequest("/api/v1/contacts", {
        method: "POST",
        apiKey: apiKeyA,
        body: { firstName: "X" },
      }),
    );
    const { contact } = await contactResponse.json();
    const leadResponse = await createLead(
      apiKeyRequest("/api/v1/leads", {
        method: "POST",
        apiKey: apiKeyA,
        body: { contactId: contact.id },
      }),
    );
    const { lead } = await leadResponse.json();

    const response = await createBooking(
      apiKeyRequest("/api/v1/call-bookings", {
        method: "POST",
        apiKey: apiKeyB,
        body: {
          leadId: lead.id,
          startsAt: new Date().toISOString(),
          endsAt: new Date(Date.now() + 30 * 60_000).toISOString(),
          attendeeEmail: "x@example.com",
        },
      }),
    );
    expect(response.status).toBe(400);
  });
});
