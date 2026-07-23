import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { TAGGABLE_ENTITY_TYPES } from "@/lib/tags";

const assignSchema = z.object({
  tagId: z.string().min(1),
  entityType: z.enum(TAGGABLE_ENTITY_TYPES as [string, ...string[]]),
  entityId: z.string().min(1),
});

async function entityBelongsToTenant(
  entityType: string,
  entityId: string,
  tenantId: string,
) {
  switch (entityType) {
    case "contact":
      return Boolean(await db.contact.findFirst({ where: { id: entityId, tenantId } }));
    case "account":
      return Boolean(await db.account.findFirst({ where: { id: entityId, tenantId } }));
    case "lead":
      return Boolean(await db.lead.findFirst({ where: { id: entityId, tenantId } }));
    case "opportunity":
      return Boolean(
        await db.opportunity.findFirst({ where: { id: entityId, tenantId } }),
      );
    default:
      return false;
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { tenantId } = auth.user;

  const body = await request.json().catch(() => null);
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { tagId, entityType, entityId } = parsed.data;

  const tag = await db.tag.findFirst({ where: { id: tagId, tenantId } });
  if (!tag) {
    return NextResponse.json(
      { error: "tagId does not belong to this tenant" },
      { status: 400 },
    );
  }
  if (!(await entityBelongsToTenant(entityType, entityId, tenantId))) {
    return NextResponse.json(
      { error: "entityId does not belong to this tenant" },
      { status: 400 },
    );
  }

  const assignment = await db.tagAssignment.upsert({
    where: { tagId_entityId: { tagId, entityId } },
    create: { tenantId, tagId, entityType, entityId },
    update: {},
  });

  return NextResponse.json({ assignment }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { tenantId } = auth.user;

  const { searchParams } = new URL(request.url);
  const tagId = searchParams.get("tagId");
  const entityId = searchParams.get("entityId");
  if (!tagId || !entityId) {
    return NextResponse.json(
      { error: "tagId and entityId query params are required" },
      { status: 400 },
    );
  }

  const existing = await db.tagAssignment.findFirst({
    where: { tenantId, tagId, entityId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.tagAssignment.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
