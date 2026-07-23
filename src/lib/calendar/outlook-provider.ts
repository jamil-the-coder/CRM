import { db } from "@/lib/db";
import { computeFreeSlots } from "./free-slots";
import type {
  BookSlotInput,
  BookSlotResult,
  CalendarProvider,
  TimeSlot,
} from "./types";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const SLOT_DURATION_DEFAULT_MINUTES = 30;
// Refresh a little before actual expiry to avoid a request racing the clock.
const TOKEN_REFRESH_SKEW_MS = 60_000;

function tokenUrl(tenantId: string) {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
}

/**
 * Real Microsoft Graph-backed calendar provider (Phase 15's Outlook side,
 * unblocked once the operator supplied Azure AD app credentials — see
 * PROGRESS.md). One connected account per CRM tenant (src/lib/calendar/
 * outlook-oauth-state.ts + the /api/auth/outlook/* routes handle the
 * one-time connect flow); this class does the ongoing token refresh + Graph
 * calls, following the exact CalendarProvider contract MockCalendarProvider
 * already implements, so no caller needed to change.
 */
export class OutlookCalendarProvider implements CalendarProvider {
  readonly name = "outlook";

  constructor(private readonly tenantId: string) {}

  private async getValidAccessToken(): Promise<string> {
    const connection = await db.calendarConnection.findUnique({
      where: { tenantId: this.tenantId },
    });
    if (!connection) {
      throw new Error(
        "Outlook calendar isn't connected for this tenant yet — connect it from the Calls page first.",
      );
    }

    if (connection.expiresAt.getTime() - TOKEN_REFRESH_SKEW_MS > Date.now()) {
      return connection.accessToken;
    }

    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
    const msTenantId = process.env.OUTLOOK_TENANT_ID;
    if (!clientId || !clientSecret || !msTenantId) {
      throw new Error("Outlook OAuth app credentials are not configured");
    }

    const response = await fetch(tokenUrl(msTenantId), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: connection.refreshToken,
        scope: "https://graph.microsoft.com/.default offline_access",
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Failed to refresh Outlook access token: ${response.status} ${await response.text()}`,
      );
    }
    const tokens = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    await db.calendarConnection.update({
      where: { tenantId: this.tenantId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? connection.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    return tokens.access_token;
  }

  private async graphFetch(path: string, init: RequestInit = {}) {
    const accessToken = await this.getValidAccessToken();
    const response = await fetch(`${GRAPH_BASE}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
    });
    return response;
  }

  async findAvailableSlots({
    from,
    to,
    durationMinutes,
  }: {
    from: Date;
    to: Date;
    durationMinutes: number;
  }): Promise<TimeSlot[]> {
    const params = new URLSearchParams({
      startDateTime: from.toISOString(),
      endDateTime: to.toISOString(),
      $select: "start,end,isCancelled",
      $top: "100",
    });
    const response = await this.graphFetch(`/me/calendarView?${params}`, {
      headers: { Prefer: 'outlook.timezone="UTC"' },
    });
    if (!response.ok) {
      throw new Error(
        `Failed to read Outlook calendar: ${response.status} ${await response.text()}`,
      );
    }
    const body = (await response.json()) as {
      value: { start: { dateTime: string }; end: { dateTime: string }; isCancelled: boolean }[];
    };

    const busyBlocks: TimeSlot[] = body.value
      .filter((event) => !event.isCancelled)
      .map((event) => ({
        startsAt: new Date(`${event.start.dateTime}Z`),
        endsAt: new Date(`${event.end.dateTime}Z`),
      }));

    return computeFreeSlots(
      from,
      to,
      durationMinutes || SLOT_DURATION_DEFAULT_MINUTES,
      busyBlocks,
    );
  }

  async bookSlot(input: BookSlotInput): Promise<BookSlotResult> {
    const response = await this.graphFetch("/me/events", {
      method: "POST",
      body: JSON.stringify({
        subject: input.title,
        start: { dateTime: input.startsAt.toISOString(), timeZone: "UTC" },
        end: { dateTime: input.endsAt.toISOString(), timeZone: "UTC" },
        attendees: [
          {
            emailAddress: { address: input.attendeeEmail },
            type: "required",
          },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Failed to book Outlook calendar event: ${response.status} ${await response.text()}`,
      );
    }
    const event = (await response.json()) as { id: string };
    return { externalEventId: event.id };
  }

  async cancelBooking(externalEventId: string): Promise<void> {
    const response = await this.graphFetch(`/me/events/${externalEventId}`, {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(
        `Failed to cancel Outlook calendar event: ${response.status} ${await response.text()}`,
      );
    }
  }
}
