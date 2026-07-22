import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiKey } from "@/lib/api-key-auth";
import { getCalendarProvider } from "@/lib/calendar";
import { logActivity } from "@/lib/activity";
import { emitEvent } from "@/lib/webhooks";

const createCallBookingSchema = z.object({
  leadId: z.string().min(1).nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  attendeeEmail: z.string().trim().toLowerCase().email().max(320),
  title: z.string().trim().min(1).max(300).default("Call"),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (auth.unauthorized) return auth.unauthorized;

  const bookings = await db.callBooking.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { startsAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ callBookings: bookings });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { tenantId } = auth;

  const body = await request.json().catch(() => null);
  const parsed = createCallBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { leadId, startsAt, endsAt, attendeeEmail, title } = parsed.data;

  if (leadId) {
    const lead = await db.lead.findFirst({ where: { id: leadId, tenantId } });
    if (!lead) {
      return NextResponse.json(
        { error: "leadId does not belong to this tenant" },
        { status: 400 },
      );
    }
  }

  const provider = getCalendarProvider();
  const { externalEventId } = await provider.bookSlot({
    startsAt: new Date(startsAt),
    endsAt: new Date(endsAt),
    attendeeEmail,
    title,
  });

  const booking = await db.callBooking.create({
    data: {
      tenantId,
      leadId,
      provider: provider.name,
      externalEventId,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      attendeeEmail,
    },
  });

  if (leadId) {
    await logActivity(tenantId, "lead", leadId, "call.booked", {
      callBookingId: booking.id,
      startsAt,
      attendeeEmail,
    });
  }
  await emitEvent(tenantId, "call.booked", { callBooking: booking });

  return NextResponse.json({ callBooking: booking }, { status: 201 });
}
