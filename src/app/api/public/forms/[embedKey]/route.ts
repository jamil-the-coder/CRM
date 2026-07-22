import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ embedKey: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { embedKey } = await params;

  if (!process.env.VITEST) {
    const ipAddress = getClientIp(request);
    const { limited } = await checkRateLimit(`public-form:${ipAddress ?? "unknown"}`, {
      windowMs: 60 * 1000,
      max: 60,
    });
    if (limited) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }
  }

  const form = await db.form.findUnique({
    where: { embedKey },
    select: { name: true, fields: true },
  });
  if (!form) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ form });
}
