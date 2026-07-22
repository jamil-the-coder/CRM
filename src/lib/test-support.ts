import { NextRequest } from "next/server";
import { POST as signup } from "@/app/api/auth/signup/route";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

const BASE_URL = "http://localhost:3000";

export function uniqueEmail(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
}

/** Signs up a fresh tenant + admin user for a test and returns its session cookie header. */
export async function createTestTenant(label: string) {
  const email = uniqueEmail(label);
  const request = new NextRequest(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenantName: `${label} Co`,
      email,
      password: "a-strong-password-123",
    }),
  });
  const response = await signup(request);
  const body = await response.json();
  const token = response.cookies.get(SESSION_COOKIE_NAME)?.value;

  return {
    tenantId: body.tenant.id as string,
    userId: body.user.id as string,
    cookie: `${SESSION_COOKIE_NAME}=${token}`,
  };
}

export function apiRequest(
  path: string,
  options: { method: string; body?: unknown; cookie: string },
) {
  return new NextRequest(`${BASE_URL}${path}`, {
    method: options.method,
    headers: {
      "content-type": "application/json",
      cookie: options.cookie,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}
