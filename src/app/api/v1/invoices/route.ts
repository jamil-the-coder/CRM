import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiKey } from "@/lib/api-key-auth";
import { logActivity } from "@/lib/activity";

const createInvoiceSchema = z.object({
  opportunityId: z.string().min(1),
  amount: z.number().min(0),
  currency: z.string().trim().length(3).optional(),
  externalRef: z.string().trim().max(200).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (auth.unauthorized) return auth.unauthorized;

  const invoices = await db.invoice.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ invoices });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { tenantId } = auth;

  const body = await request.json().catch(() => null);
  const parsed = createInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { opportunityId, amount, currency, externalRef } = parsed.data;

  const opportunity = await db.opportunity.findFirst({
    where: { id: opportunityId, tenantId },
  });
  if (!opportunity) {
    return NextResponse.json(
      { error: "opportunityId does not belong to this tenant" },
      { status: 400 },
    );
  }

  const invoice = await db.invoice.create({
    data: {
      tenantId,
      opportunityId,
      amount,
      currency: currency ?? opportunity.currency,
      externalRef,
    },
  });

  await logActivity(tenantId, "opportunity", opportunityId, "invoice.created", {
    invoiceId: invoice.id,
    amount: invoice.amount.toString(),
    currency: invoice.currency,
  });

  return NextResponse.json({ invoice }, { status: 201 });
}
