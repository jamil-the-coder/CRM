export type TimeSlot = {
  startsAt: Date;
  endsAt: Date;
};

export type BookSlotInput = {
  startsAt: Date;
  endsAt: Date;
  attendeeEmail: string;
  title: string;
};

export type BookSlotResult = {
  externalEventId: string;
};

/**
 * Everything the CRM needs from a calendar backend. Google Calendar and
 * Outlook implementations (Phase 15) plug in here without any caller —
 * the booking API, the Sales Agent n8n flow — needing to change.
 */
export interface CalendarProvider {
  readonly name: string;
  findAvailableSlots(input: {
    from: Date;
    to: Date;
    durationMinutes: number;
  }): Promise<TimeSlot[]>;
  bookSlot(input: BookSlotInput): Promise<BookSlotResult>;
  cancelBooking(externalEventId: string): Promise<void>;
}
