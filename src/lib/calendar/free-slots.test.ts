import { describe, expect, it } from "vitest";
import { computeFreeSlots } from "./free-slots";

// Uses local-time Date constructors throughout (no "Z" suffix) — matches
// computeFreeSlots' local-time semantics (inherited from MockCalendarProvider,
// same known local-vs-UTC trade-off documented for Phase 13's reporting code)
// so these assertions hold regardless of the machine's timezone offset.

describe("computeFreeSlots", () => {
  it("returns hourly weekday business-hours slots with no busy blocks", () => {
    // 2026-07-27 is a Monday.
    const from = new Date(2026, 6, 27, 0, 0, 0);
    const to = new Date(2026, 6, 27, 23, 59, 59);
    const slots = computeFreeSlots(from, to, 60, []);
    expect(slots.length).toBe(8); // 9,10,11,12,13,14,15,16
    expect(slots[0].startsAt.getHours()).toBe(9);
    expect(slots.at(-1)!.startsAt.getHours()).toBe(16);
  });

  it("excludes weekends entirely", () => {
    // 2026-07-25/26 is Sat/Sun.
    const from = new Date(2026, 6, 25, 0, 0, 0);
    const to = new Date(2026, 6, 27, 0, 0, 0);
    const slots = computeFreeSlots(from, to, 60, []);
    expect(slots.length).toBe(0);
  });

  it("excludes a slot that overlaps a busy block", () => {
    const from = new Date(2026, 6, 27, 0, 0, 0);
    const to = new Date(2026, 6, 27, 23, 59, 59);
    const busy = [
      {
        startsAt: new Date(2026, 6, 27, 10, 30),
        endsAt: new Date(2026, 6, 27, 11, 30),
      },
    ];
    const slots = computeFreeSlots(from, to, 60, busy);
    const hours = slots.map((s) => s.startsAt.getHours());
    expect(hours).not.toContain(10);
    expect(hours).not.toContain(11);
    expect(hours).toContain(9);
    expect(hours).toContain(12);
  });

  it("does not exclude a slot that merely touches (not overlaps) a busy block's edge", () => {
    const from = new Date(2026, 6, 27, 0, 0, 0);
    const to = new Date(2026, 6, 27, 23, 59, 59);
    const busy = [
      {
        startsAt: new Date(2026, 6, 27, 10, 0),
        endsAt: new Date(2026, 6, 27, 11, 0),
      },
    ];
    const slots = computeFreeSlots(from, to, 60, busy);
    const hours = slots.map((s) => s.startsAt.getHours());
    expect(hours).not.toContain(10);
    expect(hours).toContain(9);
    expect(hours).toContain(11);
  });
});
