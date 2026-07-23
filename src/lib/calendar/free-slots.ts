import type { TimeSlot } from "./types";

const BUSINESS_HOURS_START = 9;
const BUSINESS_HOURS_END = 17;

/**
 * Pure slot-computation logic shared by any real calendar provider: walk
 * hourly slots across weekday business hours in [from, to), excluding any
 * that overlap an existing busy block. Split out from OutlookCalendarProvider
 * so it's unit-testable with hand-built busy-block fixtures, without a live
 * Microsoft Graph call.
 */
export function computeFreeSlots(
  from: Date,
  to: Date,
  durationMinutes: number,
  busyBlocks: TimeSlot[],
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const cursor = new Date(from);
  cursor.setMinutes(0, 0, 0);
  if (cursor < from) cursor.setHours(cursor.getHours() + 1);

  while (cursor < to) {
    const isWeekday = cursor.getDay() >= 1 && cursor.getDay() <= 5;
    const hour = cursor.getHours();
    if (isWeekday && hour >= BUSINESS_HOURS_START && hour < BUSINESS_HOURS_END) {
      const startsAt = new Date(cursor);
      const endsAt = new Date(cursor.getTime() + durationMinutes * 60_000);
      const overlapsBusy = busyBlocks.some(
        (busy) => startsAt < busy.endsAt && endsAt > busy.startsAt,
      );
      if (!overlapsBusy) {
        slots.push({ startsAt, endsAt });
      }
    }
    cursor.setHours(cursor.getHours() + 1);
  }

  return slots;
}
