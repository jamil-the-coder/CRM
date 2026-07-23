import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { computeQuoteTotal } from "@/lib/quotes";

const lineSchema = z.object({
  productId: z.string().min(1).optional(),
  description: z.string().trim().min(1).max(300),
  quantity: z.number().min(0.01).default(1),
  unitPrice: z.number().min(0),
});

const createQuoteSchema = z.object({
  opportunityId: z.string().min(1),
  lines: z.array(lineSchema).min(1),
});

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const { searchParams } = new URL(request.url);
  const opportunityId = searchParams.get("opportunityId");

  const quotes = await db.quote.findMany({
    where: {
      tenantId: auth.user.tenantId,
      ...(opportunityId ? { opportunityId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { lines: true, opportunity: { select: { name: true } } },
  });
  return NextResponse.json({
    quotes: quotes.map((q) => ({ ...q, total: computeQuoteTotal(q.lines) })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { tenantId } = auth.user;

  const body = await request.json().catch(() => null);
  const parsed = createQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const opportunity = await db.opportunity.findFirst({
    where: { id: parsed.data.opportunityId, tenantId },
  });
  if (!opportunity) {
    return NextResponse.json(
      { error: "opportunityId does not belong to this tenant" },
      { status: 400 },
    );
  }

  for (const line of parsed.data.lines) {
    if (line.productId) {
      const product = await db.product.findFirst({
        where: { id: line.productId, tenantId },
      });
      if (!product) {
        return NextResponse.json(
          { error: "A line's productId does not belong to this tenant" },
          { status: 400 },
        );
      }
    }
  }

  const quote = await db.quote.create({
    data: {
      tenantId,
      opportunityId: parsed.data.opportunityId,
      lines: {
        create: parsed.data.lines.map((line, index) => ({
          tenantId,
          productId: line.productId,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          sortOrder: index,
        })),
      },
    },
    include: { lines: true },
  });

  return NextResponse.json(
    { quote: { ...quote, total: computeQuoteTotal(quote.lines) } },
    { status: 201 },
  );
}
