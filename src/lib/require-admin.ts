import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/api-auth";
import type { AuthenticatedUser } from "@/lib/auth";

type AdminResult =
  | { user: AuthenticatedUser; unauthorized?: undefined }
  | { user?: undefined; unauthorized: NextResponse };

/** Same as requireSession, but also 403s a non-ADMIN caller — for team-management and tenant-settings endpoints. */
export async function requireAdmin(request: NextRequest): Promise<AdminResult> {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth;
  if (auth.user.role !== "ADMIN") {
    return {
      unauthorized: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      ),
    };
  }
  return { user: auth.user };
}
