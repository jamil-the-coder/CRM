import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiKey } from "@/lib/api-key-auth";
import { logActivity } from "@/lib/activity";
import { emitEvent } from "@/lib/webhooks";

const updateOpportunitySchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  stage: z.string().trim().min(1).max(100).optional(),
  value: z.number().min(0).optional(),
  currency: z.string().trim().length(3).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  ownerUserId: z.string().min(1).nullable().optional(),
  accountId: z.string().min(1).nullable().optional(),
  expectedCloseDate: z.string().datetime().nullable().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireApiKey(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { id } = await params;

  const opportunity = await db.opportunity.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: { contact: true },
  });
  if (!opportunity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ opportunity });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireApiKey(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { id } = await params;
  const { tenantId } = auth;

  const body = await request.json().catch(() => null);
  const parsed = updateOpportunitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const existing = await db.opportunity.findFirst({ where: { id, tenantId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.accountId) {
    const account = await db.account.findFirst({
      where: { id: parsed.data.accountId, tenantId },
    });
    if (!account) {
      return NextResponse.json(
        { error: "accountId does not belong to this tenant" },
        { status: 400 },
      );
    }
  }

  const { expectedCloseDate, ...rest } = parsed.data;
  const stageChanged =
    rest.stage !== undefined && rest.stage !== existing.stage;
  const isNowClosed =
    stageChanged &&
    (rest.stage === "closed_won" || rest.stage === "closed_lost");

  const opportunity = await db.opportunity.update({
    where: { id },
    data: {
      ...rest,
      expectedCloseDate:
        expectedCloseDate === undefined
          ? undefined
          : expectedCloseDate
            ? new Date(expectedCloseDate)
            : null,
      closedAt: isNowClosed ? new Date() : undefined,
    },
  });

  if (stageChanged) {
    await logActivity(
      tenantId,
      "opportunity",
      opportunity.id,
      "opportunity.stage_changed",
      {
        from: existing.stage,
        to: opportunity.stage,
      },
    );
    await emitEvent(tenantId, "opportunity.stage_changed", {
      opportunity,
      from: existing.stage,
      to: opportunity.stage,
    });
    if (opportunity.stage === "closed_won") {
      await logActivity(
        tenantId,
        "opportunity",
        opportunity.id,
        "opportunity.closed_won",
        {},
      );
      await emitEvent(tenantId, "opportunity.closed_won", { opportunity });
    } else if (opportunity.stage === "closed_lost") {
      await logActivity(
        tenantId,
        "opportunity",
        opportunity.id,
        "opportunity.closed_lost",
        {},
      );
      await emitEvent(tenantId, "opportunity.closed_lost", { opportunity });
    }
  }

  return NextResponse.json({ opportunity });
}
