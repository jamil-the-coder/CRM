import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiKey } from "@/lib/api-key-auth";
import { emitEvent } from "@/lib/webhooks";
import { getFieldValues, setFieldValues } from "@/lib/custom-fields";

const updateAccountSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  customFields: z.record(z.string(), z.string().nullable()).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireApiKey(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { id } = await params;

  const account = await db.account.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: {
      contacts: { orderBy: { createdAt: "desc" } },
      opportunities: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const customFields = await getFieldValues(auth.tenantId, "account", id);
  return NextResponse.json({ account: { ...account, customFields } });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireApiKey(request);
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

  const existing = await db.account.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { customFields, ...accountFields } = parsed.data;
  const account = await db.account.update({ where: { id }, data: accountFields });
  await emitEvent(auth.tenantId, "account.updated", { account });
  if (customFields) {
    await setFieldValues(auth.tenantId, "account", id, customFields);
  }
  const updatedCustomFields = await getFieldValues(auth.tenantId, "account", id);

  return NextResponse.json({
    account: { ...account, customFields: updatedCustomFields },
  });
}
