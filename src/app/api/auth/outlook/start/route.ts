import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { signOutlookState } from "@/lib/calendar/outlook-oauth-state";

const SCOPES = [
  "offline_access",
  "User.Read",
  "Calendars.ReadWrite",
].join(" ");

/**
 * Kicks off the one-time Outlook connect flow for the caller's tenant —
 * redirects to Microsoft's consent screen. The callback (./callback/route.ts)
 * exchanges the returned code for tokens and stores them in
 * CalendarConnection. This is a real live redirect to login.microsoftonline.com,
 * per the operator's explicit go-ahead in PROGRESS.md's addendum section.
 */
export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const clientId = process.env.OUTLOOK_CLIENT_ID;
  const msTenantId = process.env.OUTLOOK_TENANT_ID;
  const redirectUri = process.env.OUTLOOK_REDIRECT_URI;
  if (!clientId || !msTenantId || !redirectUri) {
    return NextResponse.json(
      { error: "Outlook OAuth app credentials are not configured" },
      { status: 500 },
    );
  }

  const state = signOutlookState(auth.user.tenantId);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: SCOPES,
    state,
  });

  return NextResponse.redirect(
    `https://login.microsoftonline.com/${msTenantId}/oauth2/v2.0/authorize?${params}`,
  );
}
