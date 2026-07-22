import { NextRequest, type NextResponse } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { POST as signup } from "./signup/route";
import { POST as login } from "./login/route";
import { POST as logout } from "./logout/route";
import { GET as me } from "./me/route";

const BASE_URL = "http://localhost:3000";
const createdTenantIds: string[] = [];

function jsonRequest(path: string, body: unknown, cookie?: string) {
  return new NextRequest(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function getRequest(path: string, cookie?: string) {
  return new NextRequest(`${BASE_URL}${path}`, {
    method: "GET",
    headers: cookie ? { cookie } : {},
  });
}

function cookieHeaderFrom(response: NextResponse): string {
  const token = response.cookies.get(SESSION_COOKIE_NAME)?.value;
  return `${SESSION_COOKIE_NAME}=${token}`;
}

function uniqueEmail(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
}

afterAll(async () => {
  if (createdTenantIds.length > 0) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  }
});

describe("POST /api/auth/signup", () => {
  it("creates a tenant + admin user and sets a session cookie", async () => {
    const email = uniqueEmail("signup");
    const response = await signup(
      jsonRequest("/api/auth/signup", {
        tenantName: "Acme Inc",
        email,
        password: "a-strong-password-123",
      }),
    );
    const body = await response.json();
    createdTenantIds.push(body.tenant.id);

    expect(response.status).toBe(201);
    expect(body.user.email).toBe(email);
    expect(body.user.role).toBe("ADMIN");
    expect(response.cookies.get(SESSION_COOKIE_NAME)?.value).toBeTruthy();
  });

  it("rejects a duplicate email with 409", async () => {
    const email = uniqueEmail("dupe");
    const first = await signup(
      jsonRequest("/api/auth/signup", {
        tenantName: "A",
        email,
        password: "a-strong-password-123",
      }),
    );
    const firstBody = await first.json();
    createdTenantIds.push(firstBody.tenant.id);

    const second = await signup(
      jsonRequest("/api/auth/signup", {
        tenantName: "B",
        email,
        password: "another-strong-pass",
      }),
    );
    expect(second.status).toBe(409);
  });

  it("rejects a password that's too short", async () => {
    const response = await signup(
      jsonRequest("/api/auth/signup", {
        tenantName: "A",
        email: uniqueEmail("short"),
        password: "short",
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("POST /api/auth/login and session lifecycle", () => {
  it("logs in with correct credentials, exposes /me, then logout invalidates the session", async () => {
    const email = uniqueEmail("login");
    const password = "a-strong-password-123";
    const signupResponse = await signup(
      jsonRequest("/api/auth/signup", {
        tenantName: "Login Co",
        email,
        password,
      }),
    );
    const signupBody = await signupResponse.json();
    createdTenantIds.push(signupBody.tenant.id);

    const loginResponse = await login(
      jsonRequest("/api/auth/login", { email, password }),
    );
    expect(loginResponse.status).toBe(200);
    const cookie = cookieHeaderFrom(loginResponse);

    const meResponse = await me(getRequest("/api/auth/me", cookie));
    const meBody = await meResponse.json();
    expect(meResponse.status).toBe(200);
    expect(meBody.user.email).toBe(email);
    expect(meBody.user.tenantId).toBe(signupBody.tenant.id);

    const logoutResponse = await logout(
      jsonRequest("/api/auth/logout", {}, cookie),
    );
    expect(logoutResponse.status).toBe(200);

    const meAfterLogout = await me(getRequest("/api/auth/me", cookie));
    expect(meAfterLogout.status).toBe(401);
  });

  it("rejects /me with no session cookie", async () => {
    const response = await me(getRequest("/api/auth/me"));
    expect(response.status).toBe(401);
  });

  it("returns the same generic error for a wrong password and a nonexistent email", async () => {
    const email = uniqueEmail("wrongpass");
    const password = "a-strong-password-123";
    const signupResponse = await signup(
      jsonRequest("/api/auth/signup", {
        tenantName: "Wrong Co",
        email,
        password,
      }),
    );
    const signupBody = await signupResponse.json();
    createdTenantIds.push(signupBody.tenant.id);

    const wrongPasswordResponse = await login(
      jsonRequest("/api/auth/login", {
        email,
        password: "totally-incorrect-pass",
      }),
    );
    const noSuchUserResponse = await login(
      jsonRequest("/api/auth/login", {
        email: uniqueEmail("nobody"),
        password: "whatever12345",
      }),
    );

    expect(wrongPasswordResponse.status).toBe(401);
    expect(noSuchUserResponse.status).toBe(401);
    const [wrongBody, noSuchBody] = await Promise.all([
      wrongPasswordResponse.json(),
      noSuchUserResponse.json(),
    ]);
    expect(wrongBody.error).toBe(noSuchBody.error);
  });

  it(
    "locks the account after repeated failed attempts, even with the correct password",
    { timeout: 15000 },
    async () => {
      const email = uniqueEmail("lockout");
      const password = "a-strong-password-123";
      const signupResponse = await signup(
        jsonRequest("/api/auth/signup", {
          tenantName: "Lockout Co",
          email,
          password,
        }),
      );
      const signupBody = await signupResponse.json();
      createdTenantIds.push(signupBody.tenant.id);

      for (let i = 0; i < 5; i++) {
        const response = await login(
          jsonRequest("/api/auth/login", { email, password: "wrong-password" }),
        );
        expect(response.status).toBe(401);
      }

      const lockedOutResponse = await login(
        jsonRequest("/api/auth/login", { email, password }),
      );
      expect(lockedOutResponse.status).toBe(423);
    },
  );
});
