import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getCalendarProvider } from "@/lib/calendar";
import { NewBookingForm } from "./new-booking-form";

export default async function CallsPage() {
  const user = await getCurrentUser();
  const tenantId = user!.tenantId;
  const calendarProviderName = process.env.CALENDAR_PROVIDER ?? "mock";

  const [leads, bookings, connection] = await Promise.all([
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
    calendarProviderName === "outlook"
      ? db.calendarConnection.findUnique({ where: { tenantId } })
      : Promise.resolve(null),
  ]);

  const needsOutlookConnection = calendarProviderName === "outlook" && !connection;

  let slots: { startsAt: string; endsAt: string }[] = [];
  let slotsError: string | null = null;
  if (!needsOutlookConnection) {
    const provider = getCalendarProvider(tenantId);
    const from = new Date();
    const to = new Date(from.getTime() + 5 * 24 * 60 * 60_000);
    try {
      const found = await provider.findAvailableSlots({
        from,
        to,
        durationMinutes: 30,
      });
      slots = found.slice(0, 15).map((s) => ({
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
      }));
    } catch (error) {
      slotsError =
        error instanceof Error ? error.message : "Couldn't load calendar slots.";
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Calls
          </h1>
          <p className="text-sm text-muted-foreground">
            Book a call against a lead using the {calendarProviderName}{" "}
            calendar provider.
            {connection && ` Connected as ${connection.accountEmail}.`}
          </p>
        </div>
        {calendarProviderName === "outlook" && !connection && (
          <Link href="/api/auth/outlook/start" className={buttonVariants({})}>
            Connect Outlook Calendar
          </Link>
        )}
      </div>

      {needsOutlookConnection ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Connect your Outlook calendar above to see available slots and
            book real calls.
          </CardContent>
        </Card>
      ) : slotsError ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">
            {slotsError}
          </CardContent>
        </Card>
      ) : (
        <NewBookingForm
          leads={leads.map((l) => ({
            id: l.id,
            label: `${l.contact.firstName} ${l.contact.lastName ?? ""}`.trim(),
          }))}
          slots={slots}
        />
      )}

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No calls booked yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0 dark:divide-border">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {booking.startsAt.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
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
