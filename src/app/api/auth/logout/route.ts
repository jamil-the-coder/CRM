import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  deleteSessionByToken,
  getSessionUser,
} from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit-log";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const user = await getSessionUser(request);
    await deleteSessionByToken(token);
    if (user) {
      await recordAuditLog({
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: "auth.logout",
        ipAddress: getClientIp(request),
      });
    }
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
