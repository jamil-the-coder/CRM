import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  apiKeyRequest,
  createTestApiKey,
  createTestTenant,
} from "@/lib/test-support";
import { GET as listContacts, POST as createContact } from "./contacts/route";
import {
  GET as getContact,
  PATCH as updateContact,
} from "./contacts/[id]/route";
import { GET as listLeads, POST as createLead } from "./leads/route";
import { PATCH as updateLead } from "./leads/[id]/route";
import {
  GET as listOpportunities,
  POST as createOpportunity,
} from "./opportunities/route";
import { PATCH as updateOpportunity } from "./opportunities/[id]/route";
import {
  GET as listActivities,
  POST as createActivity,
} from "./activities/route";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

describe("v1 API authentication", () => {
  it("rejects requests with no API key", async () => {
    const response = await listContacts(
      new NextRequest("http://localhost:3000/api/v1/contacts"),
    );
    expect(response.status).toBe(401);
  });

  it("rejects requests with an invalid API key", async () => {
    const response = await listContacts(
      apiKeyRequest("/api/v1/contacts", {
        method: "GET",
        apiKey: "crm_live_totally-made-up",
      }),
    );
    expect(response.status).toBe(401);
  });
});

describe("v1 contacts/leads/opportunities/activities", () => {
  it("supports the full create -> lead -> opportunity flow via an API key", async () => {
    const tenant = await createTestTenant("v1Api");
    createdTenantIds.push(tenant.tenantId);
    const apiKey = await createTestApiKey(tenant.tenantId);

    const contactResponse = await createContact(
      apiKeyRequest("/api/v1/contacts", {
        method: "POST",
        apiKey,
        body: { firstName: "Nina", email: "nina@example.com" },
      }),
    );
    expect(contactResponse.status).toBe(201);
    const { contact } = await contactResponse.json();

    const getContactResponse = await getContact(
      apiKeyRequest(`/api/v1/contacts/${contact.id}`, {
        method: "GET",
        apiKey,
      }),
      { params: Promise.resolve({ id: contact.id }) },
    );
    expect(getContactResponse.status).toBe(200);

    const updateContactResponse = await updateContact(
      apiKeyRequest(`/api/v1/contacts/${contact.id}`, {
        method: "PATCH",
        apiKey,
        body: { company: "Acme" },
      }),
      { params: Promise.resolve({ id: contact.id }) },
    );
    expect((await updateContactResponse.json()).contact.company).toBe("Acme");

    const leadResponse = await createLead(
      apiKeyRequest("/api/v1/leads", {
        method: "POST",
        apiKey,
        body: { contactId: contact.id, source: "n8n" },
      }),
    );
    expect(leadResponse.status).toBe(201);
    const { lead } = await leadResponse.json();

    const updateLeadResponse = await updateLead(
      apiKeyRequest(`/api/v1/leads/${lead.id}`, {
        method: "PATCH",
        apiKey,
        body: { status: "qualified" },
      }),
      { params: Promise.resolve({ id: lead.id }) },
    );
    expect((await updateLeadResponse.json()).lead.status).toBe("qualified");

    const listLeadsResponse = await listLeads(
      apiKeyRequest("/api/v1/leads", { method: "GET", apiKey }),
    );
    const listLeadsBody = await listLeadsResponse.json();
    expect(
      listLeadsBody.leads.some((l: { id: string }) => l.id === lead.id),
    ).toBe(true);

    const opportunityResponse = await createOpportunity(
      apiKeyRequest("/api/v1/opportunities", {
        method: "POST",
        apiKey,
        body: {
          contactId: contact.id,
          leadId: lead.id,
          name: "n8n Deal",
          value: 1000,
        },
      }),
    );
    expect(opportunityResponse.status).toBe(201);
    const { opportunity } = await opportunityResponse.json();

    const closeResponse = await updateOpportunity(
      apiKeyRequest(`/api/v1/opportunities/${opportunity.id}`, {
        method: "PATCH",
        apiKey,
        body: { stage: "closed_won" },
      }),
      { params: Promise.resolve({ id: opportunity.id }) },
    );
    expect((await closeResponse.json()).opportunity.stage).toBe("closed_won");

    const listOpportunitiesResponse = await listOpportunities(
      apiKeyRequest("/api/v1/opportunities", { method: "GET", apiKey }),
    );
    const listOpportunitiesBody = await listOpportunitiesResponse.json();
    expect(
      listOpportunitiesBody.opportunities.some(
        (o: { id: string }) => o.id === opportunity.id,
      ),
    ).toBe(true);

    const activityResponse = await createActivity(
      apiKeyRequest("/api/v1/activities", {
        method: "POST",
        apiKey,
        body: {
          entityType: "opportunity",
          entityId: opportunity.id,
          type: "note.added",
          payload: { note: "via n8n" },
        },
      }),
    );
    expect(activityResponse.status).toBe(201);

    const listActivitiesResponse = await listActivities(
      apiKeyRequest(
        `/api/v1/activities?entityType=opportunity&entityId=${opportunity.id}`,
        {
          method: "GET",
          apiKey,
        },
      ),
    );
    const listActivitiesBody = await listActivitiesResponse.json();
    expect(listActivitiesBody.activities.length).toBeGreaterThan(0);
  });

  it("isolates tenants: an API key from tenant A cannot read tenant B's contact", async () => {
    const tenantA = await createTestTenant("v1IsoA");
    const tenantB = await createTestTenant("v1IsoB");
    createdTenantIds.push(tenantA.tenantId, tenantB.tenantId);
    const apiKeyA = await createTestApiKey(tenantA.tenantId);
    const apiKeyB = await createTestApiKey(tenantB.tenantId);

    const createResponse = await createContact(
      apiKeyRequest("/api/v1/contacts", {
        method: "POST",
        apiKey: apiKeyA,
        body: { firstName: "Secret" },
      }),
    );
    const { contact } = await createResponse.json();

    const getAsB = await getContact(
      apiKeyRequest(`/api/v1/contacts/${contact.id}`, {
        method: "GET",
        apiKey: apiKeyB,
      }),
      {
        params: Promise.resolve({ id: contact.id }),
      },
    );
    expect(getAsB.status).toBe(404);
  });
});
