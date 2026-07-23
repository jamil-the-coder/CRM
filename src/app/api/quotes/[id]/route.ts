import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { computeQuoteTotal } from "@/lib/quotes";
import { logActivity } from "@/lib/activity";

const updateQuoteSchema = z.object({
  status: z.enum(["draft", "sent", "accepted", "declined"]).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { id } = await params;

  const quote = await db.quote.findFirst({
    where: { id, tenantId: auth.user.tenantId },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      opportunity: { include: { contact: true } },
    },
  });
  if (!quote) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    quote: { ...quote, total: computeQuoteTotal(quote.lines) },
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { tenantId } = auth.user;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const existing = await db.quote.findFirst({
    where: { id, tenantId },
    include: { lines: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const quote = await db.quote.update({
    where: { id },
    data: { status: parsed.data.status },
    include: { lines: true },
  });

  // Accepting a quote updates the linked Opportunity's value to match —
  // the whole point of a quote is that it's what the deal is actually
  // worth once the customer signs off on it.
  if (parsed.data.status === "accepted" && existing.status !== "accepted") {
    const total = computeQuoteTotal(quote.lines);
    await db.opportunity.update({
      where: { id: quote.opportunityId },
      data: { value: total },
    });
    await logActivity(
      tenantId,
      "opportunity",
      quote.opportunityId,
      "quote.accepted",
      { quoteId: quote.id, total },
    );
  }

  return NextResponse.json({
    quote: { ...quote, total: computeQuoteTotal(quote.lines) },
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { id } = await params;

  const existing = await db.quote.findFirst({
    where: { id, tenantId: auth.user.tenantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.quote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
