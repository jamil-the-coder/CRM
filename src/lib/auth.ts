import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const SESSION_COOKIE_NAME = "crm_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const LOGIN_LOCKOUT_THRESHOLD = 5;
const LOGIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const BCRYPT_COST = 12;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret === "replace-with-a-long-random-string") {
    throw new Error(
      "SESSION_SECRET is not configured. Set a long random value in .env before starting the server.",
    );
  }
  return secret;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// A precomputed hash with no corresponding password, used to keep the login
// endpoint's response time consistent whether or not the email exists — the
// caller should always await a compare against *something* so a timing
// difference can't reveal account existence.
export const DUMMY_PASSWORD_HASH =
  "$2b$12$RpVQKajzU.W2XnybjyvIFuuARYyX9knvXiv7xNrWYHQmk.ia5Vnam";

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

// HMAC (rather than plain SHA-256) so a leaked database dump can't be used to
// derive/replay session tokens without also knowing SESSION_SECRET.
function hashSessionToken(token: string): string {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(token)
    .digest("hex");
}

export async function createSession(userId: string) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date,
) {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  tenantId: string;
};

async function resolveSessionUser(
  token: string | undefined,
): Promise<AuthenticatedUser | null> {
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {
      // Already gone (e.g. concurrent logout) — nothing to clean up.
    });
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    tenantId: session.user.tenantId,
  };
}

/** Reads the session cookie, validates it against the database, and returns the caller's identity — or null if unauthenticated/expired. For use in Route Handlers, which receive a NextRequest. */
export async function getSessionUser(
  request: NextRequest,
): Promise<AuthenticatedUser | null> {
  return resolveSessionUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}

/** Same as getSessionUser, but for Server Components/layouts, which read cookies via next/headers instead of a request object. */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  return resolveSessionUser(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export async function deleteSessionByToken(token: string) {
  await db.session
    .delete({ where: { tokenHash: hashSessionToken(token) } })
    .catch(() => {
      // Already gone — logout is idempotent.
    });
}

export function isLockedOut(user: { lockedUntil: Date | null }): boolean {
  return user.lockedUntil !== null && user.lockedUntil > new Date();
}

/** Increments the failed-attempt counter and locks the account once the threshold is hit. */
export async function recordFailedLogin(
  userId: string,
  currentAttempts: number,
) {
  const attempts = currentAttempts + 1;
  const lockedUntil =
    attempts >= LOGIN_LOCKOUT_THRESHOLD
      ? new Date(Date.now() + LOGIN_LOCKOUT_DURATION_MS)
      : null;

  await db.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: lockedUntil ? 0 : attempts,
      lockedUntil,
    },
  });
}

export async function resetFailedLogins(userId: string) {
  await db.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}
