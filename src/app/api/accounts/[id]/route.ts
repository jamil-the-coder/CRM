import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { emitEvent } from "@/lib/webhooks";
import { getFieldValues, setFieldValues } from "@/lib/custom-fields";
import { getOwnershipVisibilityWhere } from "@/lib/visibility";

const updateAccountSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  ownerUserId: z.string().min(1).nullable().optional(),
  customFields: z.record(z.string(), z.string().nullable()).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { id } = await params;
  const visibility = await getOwnershipVisibilityWhere(auth.user);

  const account = await db.account.findFirst({
    where: { id, tenantId: auth.user.tenantId, ...visibility },
    include: {
      contacts: { orderBy: { createdAt: "desc" } },
      opportunities: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const customFields = await getFieldValues(auth.user.tenantId, "account", id);
  return NextResponse.json({ account: { ...account, customFields } });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const visibility = await getOwnershipVisibilityWhere(auth.user);
  const existing = await db.account.findFirst({
    where: { id, tenantId: auth.user.tenantId, ...visibility },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.ownerUserId) {
    const owner = await db.user.findFirst({
      where: { id: parsed.data.ownerUserId, tenantId: auth.user.tenantId },
    });
    if (!owner) {
      return NextResponse.json(
        { error: "ownerUserId does not belong to this tenant" },
        { status: 400 },
      );
    }
  }

  const { customFields, ...accountFields } = parsed.data;
  const account = await db.account.update({ where: { id }, data: accountFields });
  await emitEvent(auth.user.tenantId, "account.updated", { account });
  if (customFields) {
    await setFieldValues(auth.user.tenantId, "account", id, customFields);
  }
  const updatedCustomFields = await getFieldValues(
    auth.user.tenantId,
    "account",
    id,
  );

  return NextResponse.json({
    account: { ...account, customFields: updatedCustomFields },
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { id } = await params;
  const visibility = await getOwnershipVisibilityWhere(auth.user);

  const existing = await db.account.findFirst({
    where: { id, tenantId: auth.user.tenantId, ...visibility },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.account.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
