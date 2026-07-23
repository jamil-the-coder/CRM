import { NextResponse, type NextRequest } from "next/server";
import { requireApiKey } from "@/lib/api-key-auth";
import { getCalendarProvider } from "@/lib/calendar";

export async function GET(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (auth.unauthorized) return auth.unauthorized;

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const durationMinutes = Number(searchParams.get("durationMinutes") ?? "30");

  const from = fromParam ? new Date(fromParam) : new Date();
  const to = toParam
    ? new Date(toParam)
    : new Date(from.getTime() + 7 * 24 * 60 * 60_000);

  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    Number.isNaN(durationMinutes)
  ) {
    return NextResponse.json(
      { error: "Invalid from/to/durationMinutes" },
      { status: 400 },
    );
  }

  const provider = getCalendarProvider(auth.tenantId);
  const slots = await provider.findAvailableSlots({
    from,
    to,
    durationMinutes,
  });

  return NextResponse.json({ provider: provider.name, slots });
}
