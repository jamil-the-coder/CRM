import { describe, expect, it } from "vitest";
import { MockCalendarProvider } from "./mock-provider";

describe("MockCalendarProvider", () => {
  it("only returns weekday, business-hours slots", async () => {
    const provider = new MockCalendarProvider();
    const from = new Date("2026-07-20T00:00:00.000Z"); // a Monday
    const to = new Date("2026-07-27T00:00:00.000Z");

    const slots = await provider.findAvailableSlots({
      from,
      to,
      durationMinutes: 30,
    });

    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      const day = slot.startsAt.getDay();
      const hour = slot.startsAt.getHours();
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(5);
      expect(hour).toBeGreaterThanOrEqual(9);
      expect(hour).toBeLessThan(17);
    }
  });

  it("bookSlot returns a unique external event id each time", async () => {
    const provider = new MockCalendarProvider();
    const input = {
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 30 * 60_000),
      attendeeEmail: "a@example.com",
      title: "Call",
    };

    const first = await provider.bookSlot(input);
    const second = await provider.bookSlot(input);

    expect(first.externalEventId).not.toBe(second.externalEventId);
    expect(first.externalEventId).toMatch(/^mock_/);
  });

  it("cancelBooking resolves without throwing", async () => {
    const provider = new MockCalendarProvider();
    await expect(
      provider.cancelBooking("mock_whatever"),
    ).resolves.toBeUndefined();
  });
});
