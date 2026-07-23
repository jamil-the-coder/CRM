import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyOutlookState } from "@/lib/calendar/outlook-oauth-state";

/**
 * Microsoft redirects here after the operator approves the consent screen
 * from ./start/route.ts. Exchanges the auth code for real access/refresh
 * tokens (a live call to Microsoft's token endpoint) and stores them —
 * per the operator's explicit go-ahead to make live Outlook calls.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/calls?outlookError=${encodeURIComponent(oauthError)}`, request.url),
    );
  }
  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const verified = verifyOutlookState(state);
  if (!verified) {
    return NextResponse.json({ error: "Invalid or tampered state" }, { status: 400 });
  }
  const { tenantId } = verified;

  const clientId = process.env.OUTLOOK_CLIENT_ID;
  const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
  const msTenantId = process.env.OUTLOOK_TENANT_ID;
  const redirectUri = process.env.OUTLOOK_REDIRECT_URI;
  if (!clientId || !clientSecret || !msTenantId || !redirectUri) {
    return NextResponse.json(
      { error: "Outlook OAuth app credentials are not configured" },
      { status: 500 },
    );
  }

  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${msTenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    },
  );
  if (!tokenResponse.ok) {
    const detail = await tokenResponse.text();
    return NextResponse.redirect(
      new URL(
        `/calls?outlookError=${encodeURIComponent(`Token exchange failed: ${detail}`)}`,
        request.url,
      ),
    );
  }
  const tokens = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const meResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  if (!meResponse.ok) {
    const detail = await meResponse.text();
    return NextResponse.redirect(
      new URL(
        `/calls?outlookError=${encodeURIComponent(`Couldn't read account info: ${detail}`)}`,
        request.url,
      ),
    );
  }
  const me = (await meResponse.json()) as {
    mail?: string;
    userPrincipalName: string;
  };

  await db.calendarConnection.upsert({
    where: { tenantId },
    create: {
      tenantId,
      provider: "outlook",
      accountEmail: me.mail ?? me.userPrincipalName,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
    update: {
      accountEmail: me.mail ?? me.userPrincipalName,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });

  return NextResponse.redirect(new URL("/calls?outlookConnected=1", request.url));
}
