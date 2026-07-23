import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  apiKeyRequest,
  createTestApiKey,
  createTestTenant,
} from "@/lib/test-support";
import { POST as createContact } from "@/app/api/v1/contacts/route";
import { POST as createLead } from "@/app/api/v1/leads/route";
import { POST as createOpportunity } from "@/app/api/v1/opportunities/route";
import { PATCH as updateOpportunity } from "@/app/api/v1/opportunities/[id]/route";
import {
  getConversionFunnel,
  getLeadSourceBreakdown,
  getPipelineValueByStage,
  getTimeSeries,
  getWeightedPipelineValue,
} from "./reports";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

async function makeContact(apiKey: string, firstName: string) {
  const response = await createContact(
    apiKeyRequest("/api/v1/contacts", {
      method: "POST",
      apiKey,
      body: { firstName },
    }),
  );
  return (await response.json()).contact.id as string;
}

async function makeOpportunity(
  apiKey: string,
  contactId: string,
  value: number,
) {
  const response = await createOpportunity(
    apiKeyRequest("/api/v1/opportunities", {
      method: "POST",
      apiKey,
      body: { contactId, name: "Deal", value },
    }),
  );
  return (await response.json()).opportunity.id as string;
}

async function moveStage(apiKey: string, opportunityId: string, stage: string) {
  await updateOpportunity(
    apiKeyRequest(`/api/v1/opportunities/${opportunityId}`, {
      method: "PATCH",
      apiKey,
      body: { stage },
    }),
    {
      params: Promise.resolve({ id: opportunityId }),
    },
  );
}

describe("reports — hand-verified against known seeded data", () => {
  it("computes pipeline value by stage, conversion funnel, lead source breakdown, and time series correctly", async () => {
    const tenant = await createTestTenant("reports");
    createdTenantIds.push(tenant.tenantId);
    const apiKey = await createTestApiKey(tenant.tenantId);

    // Lead source breakdown: 3 "form:Website", 2 "manual" (default source when unspecified).
    const contactForLeads = await makeContact(apiKey, "LeadContact");
    for (let i = 0; i < 3; i++) {
      await createLead(
        apiKeyRequest("/api/v1/leads", {
          method: "POST",
          apiKey,
          body: { contactId: contactForLeads, source: "form:Website" },
        }),
      );
    }
    for (let i = 0; i < 2; i++) {
      await createLead(
        apiKeyRequest("/api/v1/leads", {
          method: "POST",
          apiKey,
          body: { contactId: contactForLeads },
        }),
      );
    }

    // Opportunity A: new -> qualified (stays there). value 1000.
    const contactA = await makeContact(apiKey, "A");
    const oppA = await makeOpportunity(apiKey, contactA, 1000);
    await moveStage(apiKey, oppA, "qualified");

    // Opportunity B: new -> qualified -> closed_won. value 2000.
    const contactB = await makeContact(apiKey, "B");
    const oppB = await makeOpportunity(apiKey, contactB, 2000);
    await moveStage(apiKey, oppB, "qualified");
    await moveStage(apiKey, oppB, "closed_won");

    // Opportunity C: stays at new. value 500.
    const contactC = await makeContact(apiKey, "C");
    await makeOpportunity(apiKey, contactC, 500);

    // --- Pipeline value by stage: reflects CURRENT stage only ---
    const pipelineValue = await getPipelineValueByStage(tenant.tenantId);
    const byKey = Object.fromEntries(pipelineValue.map((p) => [p.key, p]));
    expect(byKey.new.value).toBe(500);
    expect(byKey.new.count).toBe(1);
    expect(byKey.qualified.value).toBe(1000);
    expect(byKey.qualified.count).toBe(1);
    expect(byKey.closed_won.value).toBe(2000);
    expect(byKey.closed_won.count).toBe(1);
    expect(byKey.contacted.value).toBe(0);
    expect(byKey.proposal.value).toBe(0);

    // --- Conversion funnel: "ever reached" this stage, regardless of current position ---
    const funnel = await getConversionFunnel(tenant.tenantId);
    const funnelByKey = Object.fromEntries(funnel.map((f) => [f.key, f]));
    expect(funnelByKey.new.reached).toBe(3); // A, B, C all created at "new"
    expect(funnelByKey.new.conversionRate).toBe(100);
    expect(funnelByKey.qualified.reached).toBe(2); // A (current) + B (passed through)
    expect(funnelByKey.qualified.conversionRate).toBe(
      Math.round((2 / 3) * 1000) / 10,
    );
    expect(funnelByKey.closed_won.reached).toBe(1); // B only
    expect(funnelByKey.closed_won.conversionRate).toBe(
      Math.round((1 / 3) * 1000) / 10,
    );
    expect(funnelByKey.contacted.reached).toBe(0);

    // --- Lead source breakdown ---
    const sources = await getLeadSourceBreakdown(tenant.tenantId);
    const sourcesByKey = Object.fromEntries(
      sources.map((s) => [s.source, s.count]),
    );
    expect(sourcesByKey["form:Website"]).toBe(3);
    expect(sourcesByKey["manual"]).toBe(2);

    // --- Time series: everything happened "today" in this test run ---
    const series = await getTimeSeries(tenant.tenantId, 14);
    const todayKey = new Date().toISOString().slice(0, 10);
    const today = series.find((d) => d.date === todayKey);
    expect(today?.leadsCreated).toBe(5); // 3 + 2 leads created above
    expect(today?.dealsClosed).toBe(1); // only B closed won
    expect(series).toHaveLength(14);

    // --- Weighted pipeline: rawValue x each stage's defaultProbability ---
    // Default seeded stages: new=10%, qualified=50%, closed_won=100%.
    const weighted = await getWeightedPipelineValue(tenant.tenantId);
    const weightedByKey = Object.fromEntries(weighted.map((w) => [w.key, w]));
    expect(weightedByKey.new.rawValue).toBe(500);
    expect(weightedByKey.new.probability).toBe(10);
    expect(weightedByKey.new.weightedValue).toBe(50); // 500 * 0.10
    expect(weightedByKey.qualified.rawValue).toBe(1000);
    expect(weightedByKey.qualified.probability).toBe(50);
    expect(weightedByKey.qualified.weightedValue).toBe(500); // 1000 * 0.50
    expect(weightedByKey.closed_won.weightedValue).toBe(2000); // 2000 * 1.00
  });
});
