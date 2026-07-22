import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCalendarProvider } from "@/lib/calendar";
import { NewBookingForm } from "./new-booking-form";

export default async function CallsPage() {
  const user = await getCurrentUser();
  const tenantId = user!.tenantId;

  const [leads, bookings] = await Promise.all([
    db.lead.findMany({
      where: { tenantId },
      include: { contact: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.callBooking.findMany({
      where: { tenantId },
      orderBy: { startsAt: "desc" },
      take: 50,
      include: { lead: { include: { contact: true } } },
    }),
  ]);

  const provider = getCalendarProvider();
  const from = new Date();
  const to = new Date(from.getTime() + 5 * 24 * 60 * 60_000);
  const slots = (
    await provider.findAvailableSlots({ from, to, durationMinutes: 30 })
  ).slice(0, 15);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Calls
        </h1>
        <p className="text-sm text-zinc-500">
          Book a call against a lead using the {provider.name} calendar
          provider. Real Google/Outlook calendars land in a later phase.
        </p>
      </div>

      <NewBookingForm
        leads={leads.map((l) => ({
          id: l.id,
          label: `${l.contact.firstName} ${l.contact.lastName ?? ""}`.trim(),
        }))}
        slots={slots.map((s) => ({
          startsAt: s.startsAt.toISOString(),
          endsAt: s.endsAt.toISOString(),
        }))}
      />

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-zinc-500">
            No calls booked yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {booking.startsAt.toLocaleString()}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {booking.lead ? `${booking.lead.contact.firstName} · ` : ""}
                    {booking.attendeeEmail}
                  </p>
                </div>
                <Badge variant="secondary">{booking.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
