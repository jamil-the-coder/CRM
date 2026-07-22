import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser, type AuthenticatedUser } from "@/lib/auth";

type SessionResult =
  | { user: AuthenticatedUser; unauthorized?: undefined }
  | { user?: undefined; unauthorized: NextResponse };

/** Every tenant-scoped route starts with this: 401s cleanly if there's no valid session, otherwise hands back the caller's identity (including tenantId) to scope queries with. */
export async function requireSession(
  request: NextRequest,
): Promise<SessionResult> {
  const user = await getSessionUser(request);
  if (!user) {
    return {
      unauthorized: NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      ),
    };
  }
  return { user };
}
