import { MockCalendarProvider } from "./mock-provider";
import type { CalendarProvider } from "./types";

export type {
  CalendarProvider,
  TimeSlot,
  BookSlotInput,
  BookSlotResult,
} from "./types";

let cachedProvider: CalendarProvider | undefined;

/**
 * Swaps in a real provider by changing CALENDAR_PROVIDER — every caller goes
 * through this factory rather than instantiating a provider directly, so
 * Phase 15's Google/Outlook providers are a config change, not a rewrite.
 */
export function getCalendarProvider(): CalendarProvider {
  if (!cachedProvider) {
    const providerName = process.env.CALENDAR_PROVIDER ?? "mock";
    if (providerName !== "mock") {
      throw new Error(
        `Unknown CALENDAR_PROVIDER "${providerName}" — only "mock" is implemented so far (Google/Outlook land in Phase 15).`,
      );
    }
    cachedProvider = new MockCalendarProvider();
  }
  return cachedProvider;
}
