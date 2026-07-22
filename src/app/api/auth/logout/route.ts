import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  deleteSessionByToken,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await deleteSessionByToken(token);
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
