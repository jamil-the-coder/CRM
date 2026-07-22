import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  DUMMY_PASSWORD_HASH,
  createSession,
  isLockedOut,
  recordFailedLogin,
  resetFailedLogins,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/audit-log";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(1).max(200),
});

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request);

  // A broad IP-based cap in addition to the per-account lockout in
  // src/lib/auth.ts — that one stops brute-forcing a single known account,
  // this one stops credential-stuffing across many accounts from one IP.
  // Skipped under the test runner for the same reason as the signup route:
  // most test files log in repeatedly from the same IP-less key.
  if (!process.env.VITEST) {
    const { limited } = await checkRateLimit(`login:${ipAddress ?? "unknown"}`, {
      windowMs: 10 * 60 * 1000,
      max: 20,
    });
    if (limited) {
      return NextResponse.json({ error: "Too many login attempts. Please try again later." }, { status: 429 });
    }
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });

  if (user && isLockedOut(user)) {
    await recordAuditLog({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: "auth.login_locked",
      ipAddress,
    });
    return NextResponse.json(
      { error: "Too many failed attempts. Try again in a few minutes." },
      { status: 423 },
    );
  }

  // Always run the bcrypt compare, even for a nonexistent email (against a
  // fixed dummy hash), so response timing can't reveal whether the account
  // exists. Same generic error either way.
  const passwordValid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordValid) {
    if (user) {
      await recordFailedLogin(user.id, user.failedLoginAttempts);
      await recordAuditLog({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "auth.login_failed",
        ipAddress,
      });
    }
    return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
  }

  await resetFailedLogins(user.id);
  await recordAuditLog({
    tenantId: user.tenantId,
    actorUserId: user.id,
    action: "auth.login_success",
    ipAddress,
  });
  const { token, expiresAt } = await createSession(user.id);

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    },
  });
  setSessionCookie(response, token, expiresAt);
  return response;
}
