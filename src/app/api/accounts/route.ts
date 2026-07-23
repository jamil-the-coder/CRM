import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { emitEvent } from "@/lib/webhooks";
import { getFieldValuesForEntities, setFieldValues } from "@/lib/custom-fields";

const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(200),
  ownerUserId: z.string().min(1).optional(),
  customFields: z.record(z.string(), z.string()).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const { searchParams } = new URL(request.url);
  const mine = searchParams.get("mine") === "1";

  const accounts = await db.account.findMany({
    where: {
      tenantId: auth.user.tenantId,
      ...(mine ? { ownerUserId: auth.user.id } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const customFieldsByEntity = await getFieldValuesForEntities(
    auth.user.tenantId,
    "account",
    accounts.map((a) => a.id),
  );
  return NextResponse.json({
    accounts: accounts.map((a) => ({
      ...a,
      customFields: customFieldsByEntity[a.id] ?? {},
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { tenantId } = auth.user;

  const body = await request.json().catch(() => null);
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  if (parsed.data.ownerUserId) {
    const owner = await db.user.findFirst({
      where: { id: parsed.data.ownerUserId, tenantId },
    });
    if (!owner) {
      return NextResponse.json(
        { error: "ownerUserId does not belong to this tenant" },
        { status: 400 },
      );
    }
  }

  const { customFields, ...accountData } = parsed.data;
  const account = await db.account.create({
    data: { tenantId, ...accountData },
  });
  await emitEvent(tenantId, "account.created", { account });
  if (customFields) {
    await setFieldValues(tenantId, "account", account.id, customFields);
  }
  const savedCustomFields = customFields
    ? (await getFieldValuesForEntities(tenantId, "account", [account.id]))[
        account.id
      ] ?? {}
    : {};

  return NextResponse.json(
    { account: { ...account, customFields: savedCustomFields } },
    { status: 201 },
  );
}
