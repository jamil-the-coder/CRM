import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { apiRequest, createTestTenant } from "@/lib/test-support";
import { HONEYPOT_FIELD_NAME } from "@/lib/forms";
import { GET as list, POST as create } from "./route";
import { GET as getOne } from "./[id]/route";
import { GET as getPublicForm } from "../public/forms/[embedKey]/route";
import { POST as submit } from "../public/forms/[embedKey]/submit/route";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

function publicSubmitRequest(
  embedKey: string,
  body: unknown,
  ip = "203.0.113.10",
) {
  return new NextRequest(
    `http://localhost:3000/api/public/forms/${embedKey}/submit`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    },
  );
}

describe("forms management", () => {
  it("creates a form, lists it, and reads it back with an embed key", async () => {
    const tenant = await createTestTenant("forms");
    createdTenantIds.push(tenant.tenantId);

    const createResponse = await create(
      apiRequest("/api/forms", {
        method: "POST",
        cookie: tenant.cookie,
        body: { name: "Contact Us" },
      }),
    );
    expect(createResponse.status).toBe(201);
    const { form } = await createResponse.json();
    expect(form.embedKey).toBeTruthy();

    const listResponse = await list(
      apiRequest("/api/forms", { method: "GET", cookie: tenant.cookie }),
    );
    const listBody = await listResponse.json();
    expect(listBody.forms.some((f: { id: string }) => f.id === form.id)).toBe(
      true,
    );

    const getResponse = await getOne(
      apiRequest(`/api/forms/${form.id}`, {
        method: "GET",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: form.id }) },
    );
    expect(getResponse.status).toBe(200);
  });

  it("exposes public form config by embed key with no auth required", async () => {
    const tenant = await createTestTenant("formPublic");
    createdTenantIds.push(tenant.tenantId);
    const createResponse = await create(
      apiRequest("/api/forms", {
        method: "POST",
        cookie: tenant.cookie,
        body: { name: "Public Form" },
      }),
    );
    const { form } = await createResponse.json();

    const publicResponse = await getPublicForm(
      new NextRequest("http://localhost:3000/x"),
      {
        params: Promise.resolve({ embedKey: form.embedKey }),
      },
    );
    expect(publicResponse.status).toBe(200);
    const publicBody = await publicResponse.json();
    expect(publicBody.form.name).toBe("Public Form");
    expect(Array.isArray(publicBody.form.fields)).toBe(true);
  });
});

describe("public form submission", () => {
  it("creates a contact + lead on a valid submission", async () => {
    const tenant = await createTestTenant("formSubmit");
    createdTenantIds.push(tenant.tenantId);
    const createResponse = await create(
      apiRequest("/api/forms", {
        method: "POST",
        cookie: tenant.cookie,
        body: { name: "Submit Test" },
      }),
    );
    const { form } = await createResponse.json();

    const response = await submit(
      publicSubmitRequest(form.embedKey, {
        firstName: "Grace",
        email: "grace@example.com",
      }),
      { params: Promise.resolve({ embedKey: form.embedKey }) },
    );
    expect(response.status).toBe(201);

    const lead = await db.lead.findFirst({
      where: { tenantId: tenant.tenantId },
      include: { contact: true },
    });
    expect(lead).not.toBeNull();
    expect(lead?.contact.firstName).toBe("Grace");
    expect(lead?.source).toBe("form:Submit Test");

    const submissionRecord = await db.formSubmission.findFirst({
      where: { formId: form.id, status: "accepted" },
    });
    expect(submissionRecord).not.toBeNull();
  });

  it("rejects (silently, without creating a lead) when the honeypot field is filled", async () => {
    const tenant = await createTestTenant("formHoneypot");
    createdTenantIds.push(tenant.tenantId);
    const createResponse = await create(
      apiRequest("/api/forms", {
        method: "POST",
        cookie: tenant.cookie,
        body: { name: "Honeypot Test" },
      }),
    );
    const { form } = await createResponse.json();

    const response = await submit(
      publicSubmitRequest(form.embedKey, {
        firstName: "Bot",
        email: "bot@example.com",
        [HONEYPOT_FIELD_NAME]: "I am a bot filling every field",
      }),
      { params: Promise.resolve({ embedKey: form.embedKey }) },
    );
    // Responds as if successful so the bot doesn't learn it was detected.
    expect(response.status).toBe(201);

    const leadCount = await db.lead.count({
      where: { tenantId: tenant.tenantId },
    });
    expect(leadCount).toBe(0);

    const rejected = await db.formSubmission.findFirst({
      where: { formId: form.id, status: "rejected_honeypot" },
    });
    expect(rejected).not.toBeNull();
  });

  it("rate-limits repeated submissions from the same IP", async () => {
    const tenant = await createTestTenant("formRateLimit");
    createdTenantIds.push(tenant.tenantId);
    const createResponse = await create(
      apiRequest("/api/forms", {
        method: "POST",
        cookie: tenant.cookie,
        body: { name: "Rate Limit Test" },
      }),
    );
    const { form } = await createResponse.json();
    const ip = "198.51.100.42";

    for (let i = 0; i < 5; i++) {
      const response = await submit(
        publicSubmitRequest(form.embedKey, { firstName: `Person${i}` }, ip),
        {
          params: Promise.resolve({ embedKey: form.embedKey }),
        },
      );
      expect(response.status).toBe(201);
    }

    const sixthResponse = await submit(
      publicSubmitRequest(form.embedKey, { firstName: "Person6" }, ip),
      {
        params: Promise.resolve({ embedKey: form.embedKey }),
      },
    );
    expect(sixthResponse.status).toBe(429);
  });

  it("returns 404 for an unknown embed key", async () => {
    const response = await submit(
      publicSubmitRequest("does-not-exist", { firstName: "X" }),
      {
        params: Promise.resolve({ embedKey: "does-not-exist" }),
      },
    );
    expect(response.status).toBe(404);
  });
});
