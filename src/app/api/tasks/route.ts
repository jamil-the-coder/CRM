import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { CRM_ENTITY_TYPES, crmEntityBelongsToTenant } from "@/lib/polymorphic-entity";

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  dueDate: z.string().datetime().nullable().optional(),
  ownerUserId: z.string().min(1).optional(),
  entityType: z.enum(CRM_ENTITY_TYPES).nullable().optional(),
  entityId: z.string().min(1).nullable().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { tenantId } = auth.user;

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const mine = searchParams.get("mine") === "1";
  const status = searchParams.get("status");

  const tasks = await db.task.findMany({
    where: {
      tenantId,
      ...(entityType && entityId ? { entityType, entityId } : {}),
      ...(mine ? { ownerUserId: auth.user.id } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: { owner: { select: { email: true } } },
  });
  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { tenantId, id: userId } = auth.user;

  const body = await request.json().catch(() => null);
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { entityType, entityId, ownerUserId, dueDate, ...rest } = parsed.data;

  if (entityType && entityId) {
    if (!(await crmEntityBelongsToTenant(entityType, entityId, tenantId))) {
      return NextResponse.json(
        { error: "entityId does not belong to this tenant" },
        { status: 400 },
      );
    }
  }
  if (ownerUserId) {
    const owner = await db.user.findFirst({ where: { id: ownerUserId, tenantId } });
    if (!owner) {
      return NextResponse.json(
        { error: "ownerUserId does not belong to this tenant" },
        { status: 400 },
      );
    }
  }

  const task = await db.task.create({
    data: {
      tenantId,
      ownerUserId: ownerUserId ?? userId,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      dueDate: dueDate ? new Date(dueDate) : null,
      ...rest,
    },
    include: { owner: { select: { email: true } } },
  });

  return NextResponse.json({ task }, { status: 201 });
}
