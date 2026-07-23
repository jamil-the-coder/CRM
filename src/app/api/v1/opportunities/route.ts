import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiKey } from "@/lib/api-key-auth";
import { logActivity } from "@/lib/activity";
import { emitEvent } from "@/lib/webhooks";

const createOpportunitySchema = z.object({
  contactId: z.string().min(1),
  leadId: z.string().min(1).nullable().optional(),
  accountId: z.string().min(1).nullable().optional(),
  name: z.string().trim().min(1).max(300),
  stage: z.string().trim().min(1).max(100).optional(),
  value: z.number().min(0).optional(),
  currency: z.string().trim().length(3).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  ownerUserId: z.string().min(1).nullable().optional(),
  expectedCloseDate: z.string().datetime().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (auth.unauthorized) return auth.unauthorized;

  const opportunities = await db.opportunity.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { contact: true },
  });
  return NextResponse.json({ opportunities });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { tenantId } = auth;

  const body = await request.json().catch(() => null);
  const parsed = createOpportunitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { contactId, leadId, accountId, expectedCloseDate, ...rest } =
    parsed.data;

  const contact = await db.contact.findFirst({
    where: { id: contactId, tenantId },
  });
  if (!contact) {
    return NextResponse.json(
      { error: "contactId does not belong to this tenant" },
      { status: 400 },
    );
  }
  if (leadId) {
    const lead = await db.lead.findFirst({ where: { id: leadId, tenantId } });
    if (!lead) {
      return NextResponse.json(
        { error: "leadId does not belong to this tenant" },
        { status: 400 },
      );
    }
  }
  if (accountId) {
    const account = await db.account.findFirst({
      where: { id: accountId, tenantId },
    });
    if (!account) {
      return NextResponse.json(
        { error: "accountId does not belong to this tenant" },
        { status: 400 },
      );
    }
  }

  const opportunity = await db.opportunity.create({
    data: {
      tenantId,
      contactId,
      leadId,
      accountId,
      expectedCloseDate: expectedCloseDate
        ? new Date(expectedCloseDate)
        : undefined,
      ...rest,
    },
  });
  await logActivity(
    tenantId,
    "opportunity",
    opportunity.id,
    "opportunity.created",
    { stage: opportunity.stage },
  );
  await emitEvent(tenantId, "opportunity.created", { opportunity });

  return NextResponse.json({ opportunity }, { status: 201 });
}
