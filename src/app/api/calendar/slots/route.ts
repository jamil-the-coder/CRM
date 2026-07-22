import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getCalendarProvider } from "@/lib/calendar";

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const { searchParams } = new URL(request.url);
  const durationMinutes = Number(searchParams.get("durationMinutes") ?? "30");
  const from = new Date();
  const to = new Date(from.getTime() + 5 * 24 * 60 * 60_000);

  const provider = getCalendarProvider();
  const slots = await provider.findAvailableSlots({
    from,
    to,
    durationMinutes,
  });

  return NextResponse.json({
    provider: provider.name,
    slots: slots.slice(0, 15),
  });
}
