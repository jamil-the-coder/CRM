import { MockCalendarProvider } from "./mock-provider";
import { OutlookCalendarProvider } from "./outlook-provider";
import type { CalendarProvider } from "./types";

export type {
  CalendarProvider,
  TimeSlot,
  BookSlotInput,
  BookSlotResult,
} from "./types";

const mockProvider = new MockCalendarProvider();

/**
 * Swaps in a real provider by changing CALENDAR_PROVIDER — every caller goes
 * through this factory rather than instantiating a provider directly, so a
 * real Google/Outlook provider is a config change, not a rewrite of any
 * caller. Takes tenantId because a real provider's credentials (the
 * connected Outlook/Google account) are per-tenant, not global — the mock
 * provider ignores it. Cheap to construct, so no caching needed here (unlike
 * the old single-instance mock-only version): Outlook's own token cache
 * lives in the CalendarConnection row, not in this factory.
 */
export function getCalendarProvider(tenantId: string): CalendarProvider {
  const providerName = process.env.CALENDAR_PROVIDER ?? "mock";
  if (providerName === "mock") return mockProvider;
  if (providerName === "outlook") return new OutlookCalendarProvider(tenantId);
  throw new Error(
    `Unknown CALENDAR_PROVIDER "${providerName}" — only "mock" and "outlook" are implemented.`,
  );
}
