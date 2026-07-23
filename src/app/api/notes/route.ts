import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

const ENTITY_TYPES = ["contact", "account", "lead", "opportunity"] as const;

const createNoteSchema = z.object({
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string().min(1),
  body: z.string().trim().min(1).max(5000),
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
  const { tenantId, id: userId } = auth.user;

  const body = await request.json().catch(() => null);
  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { entityType, entityId } = parsed.data;

  if (!(await entityBelongsToTenant(entityType, entityId, tenantId))) {
    return NextResponse.json(
      { error: "entityId does not belong to this tenant" },
      { status: 400 },
    );
  }

  const note = await db.note.create({
    data: {
      tenantId,
      entityType,
      entityId,
      authorUserId: userId,
      body: parsed.data.body,
    },
    include: { author: true },
  });

  return NextResponse.json({ note }, { status: 201 });
}
