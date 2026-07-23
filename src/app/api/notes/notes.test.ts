import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { apiRequest, createTestTenant } from "@/lib/test-support";
import { POST as createNote } from "./route";
import { POST as createContact } from "@/app/api/contacts/route";
import { getTimeline } from "@/lib/timeline";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

describe("notes", () => {
  it("creates a note on a contact, attributed to the author", async () => {
    const tenant = await createTestTenant("notesBasic");
    createdTenantIds.push(tenant.tenantId);

    const contactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { firstName: "Nadia" },
      }),
    );
    const { contact } = await contactResponse.json();

    const noteResponse = await createNote(
      apiRequest("/api/notes", {
        method: "POST",
        cookie: tenant.cookie,
        body: {
          entityType: "contact",
          entityId: contact.id,
          body: "Called, left a voicemail.",
        },
      }),
    );
    expect(noteResponse.status).toBe(201);
    const { note } = await noteResponse.json();
    expect(note.body).toBe("Called, left a voicemail.");
    expect(note.author.email).toBeTruthy();
  });

  it("rejects requests with no session", async () => {
    const response = await createNote(
      new NextRequest("http://localhost:3000/api/notes", {
        method: "POST",
        body: JSON.stringify({
          entityType: "contact",
          entityId: "whatever",
          body: "x",
        }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects a note on an entity from another tenant", async () => {
    const tenantA = await createTestTenant("notesCrossA");
    const tenantB = await createTestTenant("notesCrossB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);

    const contactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenantA.cookie,
        body: { firstName: "Tenant A Contact" },
      }),
    );
    const { contact } = await contactResponse.json();

    const noteResponse = await createNote(
      apiRequest("/api/notes", {
        method: "POST",
        cookie: tenantB.cookie,
        body: { entityType: "contact", entityId: contact.id, body: "Snooping" },
      }),
    );
    expect(noteResponse.status).toBe(400);
  });
});

describe("getTimeline", () => {
  it("merges Activity and Notes in descending chronological order", async () => {
    const tenant = await createTestTenant("timelineMerge");
    createdTenantIds.push(tenant.tenantId);

    const contactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { firstName: "Timeline Test" },
      }),
    );
    const { contact } = await contactResponse.json();

    // The contact-create route doesn't log an Activity entry, so add one
    // manually plus a note to exercise the merge.
    await db.activity.create({
      data: {
        tenantId: tenant.tenantId,
        entityType: "contact",
        entityId: contact.id,
        type: "contact.created",
      },
    });
    await createNote(
      apiRequest("/api/notes", {
        method: "POST",
        cookie: tenant.cookie,
        body: { entityType: "contact", entityId: contact.id, body: "A note" },
      }),
    );

    const timeline = await getTimeline(tenant.tenantId, "contact", contact.id);
    expect(timeline.length).toBe(2);
    expect(timeline.some((e) => e.kind === "activity")).toBe(true);
    expect(timeline.some((e) => e.kind === "note")).toBe(true);
    // Descending: nothing after should have a later createdAt than what precedes it.
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
        timeline[i].createdAt.getTime(),
      );
    }
  });
});
