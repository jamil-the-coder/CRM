import crypto from "node:crypto";
import type {
  BookSlotInput,
  BookSlotResult,
  CalendarProvider,
  TimeSlot,
} from "./types";

const BUSINESS_HOURS_START = 9;
const BUSINESS_HOURS_END = 17;

/**
 * Fills in for a real calendar backend until Phase 15 wires up Google
 * Calendar/Outlook (which need real OAuth credentials from the operator).
 * Slots are hourly on weekdays, 9am-5pm, in whatever timezone the server runs
 * in — good enough to demo and test the booking flow end-to-end.
 */
export class MockCalendarProvider implements CalendarProvider {
  readonly name = "mock";

  async findAvailableSlots({
    from,
    to,
    durationMinutes,
  }: {
    from: Date;
    to: Date;
    durationMinutes: number;
  }): Promise<TimeSlot[]> {
    const slots: TimeSlot[] = [];
    const cursor = new Date(from);
    cursor.setMinutes(0, 0, 0);
    if (cursor < from) cursor.setHours(cursor.getHours() + 1);

    while (cursor < to) {
      const isWeekday = cursor.getDay() >= 1 && cursor.getDay() <= 5;
      const hour = cursor.getHours();
      if (
        isWeekday &&
        hour >= BUSINESS_HOURS_START &&
        hour < BUSINESS_HOURS_END
      ) {
        const startsAt = new Date(cursor);
        const endsAt = new Date(cursor.getTime() + durationMinutes * 60_000);
        slots.push({ startsAt, endsAt });
      }
      cursor.setHours(cursor.getHours() + 1);
    }

    return slots;
  }

  async bookSlot(_input: BookSlotInput): Promise<BookSlotResult> {
    return { externalEventId: `mock_${crypto.randomUUID()}` };
  }

  async cancelBooking(_externalEventId: string): Promise<void> {
    // Nothing to do — there's no real external calendar to clean up.
  }
}
