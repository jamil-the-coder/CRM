import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { apiRequest, createTestTenant } from "@/lib/test-support";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { GET as listTeam, POST as createUser } from "./route";
import { PATCH as updateUser, DELETE as removeUser } from "./[id]/route";
import { PATCH as updateSettings } from "./settings/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as createContact } from "@/app/api/contacts/route";
import {
  GET as getContact,
  PATCH as updateContact,
  DELETE as deleteContact,
} from "@/app/api/contacts/[id]/route";
import { GET as listContacts } from "@/app/api/contacts/route";

const createdTenantIds: string[] = [];

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

async function loginAs(email: string, password: string) {
  const response = await login(
    new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  const token = response.cookies.get(SESSION_COOKIE_NAME)?.value;
  return `${SESSION_COOKIE_NAME}=${token}`;
}

describe("team management", () => {
  it("lets an admin add, list, change the role of, and remove a team member", async () => {
    const tenant = await createTestTenant("teamBasic");
    createdTenantIds.push(tenant.tenantId);

    const createResponse = await createUser(
      apiRequest("/api/team", {
        method: "POST",
        cookie: tenant.cookie,
        body: {
          email: "member@teamBasic.test.local",
          password: "a-strong-password-123",
          role: "MEMBER",
        },
      }),
    );
    expect(createResponse.status).toBe(201);
    const { user } = await createResponse.json();
    expect(user.role).toBe("MEMBER");

    const listResponse = await listTeam(
      apiRequest("/api/team", { method: "GET", cookie: tenant.cookie }),
    );
    const listBody = await listResponse.json();
    expect(listBody.users.some((u: { id: string }) => u.id === user.id)).toBe(
      true,
    );

    const updateResponse = await updateUser(
      apiRequest(`/api/team/${user.id}`, {
        method: "PATCH",
        cookie: tenant.cookie,
        body: { role: "ADMIN" },
      }),
      { params: Promise.resolve({ id: user.id }) },
    );
    expect((await updateResponse.json()).user.role).toBe("ADMIN");

    const deleteResponse = await removeUser(
      apiRequest(`/api/team/${user.id}`, {
        method: "DELETE",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: user.id }) },
    );
    expect(deleteResponse.status).toBe(200);
  });

  it("rejects a non-admin from managing the team", async () => {
    const tenant = await createTestTenant("teamNonAdmin");
    createdTenantIds.push(tenant.tenantId);

    await createUser(
      apiRequest("/api/team", {
        method: "POST",
        cookie: tenant.cookie,
        body: {
          email: "member@teamNonAdmin.test.local",
          password: "a-strong-password-123",
          role: "MEMBER",
        },
      }),
    );
    const memberCookie = await loginAs(
      "member@teamNonAdmin.test.local",
      "a-strong-password-123",
    );

    const response = await listTeam(
      apiRequest("/api/team", { method: "GET", cookie: memberCookie }),
    );
    expect(response.status).toBe(403);
  });

  it("prevents an admin from demoting or removing their own account", async () => {
    const tenant = await createTestTenant("teamSelf");
    createdTenantIds.push(tenant.tenantId);

    const demoteResponse = await updateUser(
      apiRequest(`/api/team/${tenant.userId}`, {
        method: "PATCH",
        cookie: tenant.cookie,
        body: { role: "MEMBER" },
      }),
      { params: Promise.resolve({ id: tenant.userId }) },
    );
    expect(demoteResponse.status).toBe(400);

    const removeResponse = await removeUser(
      apiRequest(`/api/team/${tenant.userId}`, {
        method: "DELETE",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: tenant.userId }) },
    );
    expect(removeResponse.status).toBe(400);
  });
});

describe("role-based visibility (Phase 29)", () => {
  it("does not restrict members when restrictMemberVisibility is off (default)", async () => {
    const tenant = await createTestTenant("visibilityOff");
    createdTenantIds.push(tenant.tenantId);

    await createUser(
      apiRequest("/api/team", {
        method: "POST",
        cookie: tenant.cookie,
        body: {
          email: "member@visibilityOff.test.local",
          password: "a-strong-password-123",
          role: "MEMBER",
        },
      }),
    );
    const memberCookie = await loginAs(
      "member@visibilityOff.test.local",
      "a-strong-password-123",
    );

    const contactResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { firstName: "AdminOwned", ownerUserId: tenant.userId },
      }),
    );
    const { contact } = await contactResponse.json();

    const getAsMember = await getContact(
      apiRequest(`/api/contacts/${contact.id}`, {
        method: "GET",
        cookie: memberCookie,
      }),
      { params: Promise.resolve({ id: contact.id }) },
    );
    expect(getAsMember.status).toBe(200);
  });

  it("restricts a member to their own records when restrictMemberVisibility is on, but never restricts an admin", async () => {
    const tenant = await createTestTenant("visibilityOn");
    createdTenantIds.push(tenant.tenantId);

    const createMemberResponse = await createUser(
      apiRequest("/api/team", {
        method: "POST",
        cookie: tenant.cookie,
        body: {
          email: "member@visibilityOn.test.local",
          password: "a-strong-password-123",
          role: "MEMBER",
        },
      }),
    );
    const { user: member } = await createMemberResponse.json();
    const memberCookie = await loginAs(
      "member@visibilityOn.test.local",
      "a-strong-password-123",
    );

    await updateSettings(
      apiRequest("/api/team/settings", {
        method: "PATCH",
        cookie: tenant.cookie,
        body: { restrictMemberVisibility: true },
      }),
    );

    const adminOwnedResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { firstName: "AdminOwned", ownerUserId: tenant.userId },
      }),
    );
    const { contact: adminContact } = await adminOwnedResponse.json();

    const memberOwnedResponse = await createContact(
      apiRequest("/api/contacts", {
        method: "POST",
        cookie: tenant.cookie,
        body: { firstName: "MemberOwned", ownerUserId: member.id },
      }),
    );
    const { contact: memberContact } = await memberOwnedResponse.json();

    // Member cannot read, update, or delete the admin's contact.
    const getAsMember = await getContact(
      apiRequest(`/api/contacts/${adminContact.id}`, {
        method: "GET",
        cookie: memberCookie,
      }),
      { params: Promise.resolve({ id: adminContact.id }) },
    );
    expect(getAsMember.status).toBe(404);

    const updateAsMember = await updateContact(
      apiRequest(`/api/contacts/${adminContact.id}`, {
        method: "PATCH",
        cookie: memberCookie,
        body: { firstName: "Hijacked" },
      }),
      { params: Promise.resolve({ id: adminContact.id }) },
    );
    expect(updateAsMember.status).toBe(404);

    const deleteAsMember = await deleteContact(
      apiRequest(`/api/contacts/${adminContact.id}`, {
        method: "DELETE",
        cookie: memberCookie,
      }),
      { params: Promise.resolve({ id: adminContact.id }) },
    );
    expect(deleteAsMember.status).toBe(404);

    // Member CAN read their own contact.
    const getOwnAsMember = await getContact(
      apiRequest(`/api/contacts/${memberContact.id}`, {
        method: "GET",
        cookie: memberCookie,
      }),
      { params: Promise.resolve({ id: memberContact.id }) },
    );
    expect(getOwnAsMember.status).toBe(200);

    // Member's list view excludes the admin's contact.
    const listAsMember = await listContacts(
      apiRequest("/api/contacts", { method: "GET", cookie: memberCookie }),
    );
    const listBody = await listAsMember.json();
    expect(
      listBody.contacts.some((c: { id: string }) => c.id === adminContact.id),
    ).toBe(false);
    expect(
      listBody.contacts.some((c: { id: string }) => c.id === memberContact.id),
    ).toBe(true);

    // Admin still sees everything, restriction or not.
    const getAsAdmin = await getContact(
      apiRequest(`/api/contacts/${memberContact.id}`, {
        method: "GET",
        cookie: tenant.cookie,
      }),
      { params: Promise.resolve({ id: memberContact.id }) },
    );
    expect(getAsAdmin.status).toBe(200);
  });
});
