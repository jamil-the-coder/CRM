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

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(1).max(200),
});

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });

  if (user && isLockedOut(user)) {
    return NextResponse.json(
      { error: "Too many failed attempts. Try again in a few minutes." },
      { status: 423 },
    );
  }

  // Always run the bcrypt compare, even for a nonexistent email (against a
  // fixed dummy hash), so response timing can't reveal whether the account
  // exists. Same generic error either way.
  const passwordValid = await verifyPassword(
    password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  if (!user || !passwordValid) {
    if (user) {
      await recordFailedLogin(user.id, user.failedLoginAttempts);
    }
    return NextResponse.json(
      { error: INVALID_CREDENTIALS_MESSAGE },
      { status: 401 },
    );
  }

  await resetFailedLogins(user.id);
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
