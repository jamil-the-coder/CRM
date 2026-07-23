import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiKey } from "@/lib/api-key-auth";
import { computeDedupeKey } from "@/lib/dedupe";
import { getFieldValues, setFieldValues } from "@/lib/custom-fields";

const updateContactSchema = z.object({
  firstName: z.string().trim().min(1).max(200).optional(),
  lastName: z.string().trim().max(200).nullable().optional(),
  email: z.string().trim().toLowerCase().email().max(320).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  company: z.string().trim().max(200).nullable().optional(),
  accountId: z.string().min(1).nullable().optional(),
  customFields: z.record(z.string(), z.string().nullable()).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireApiKey(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { id } = await params;

  const contact = await db.contact.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!contact) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const customFields = await getFieldValues(auth.tenantId, "contact", id);
  return NextResponse.json({ contact: { ...contact, customFields } });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireApiKey(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const existing = await db.contact.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.accountId) {
    const account = await db.account.findFirst({
      where: { id: parsed.data.accountId, tenantId: auth.tenantId },
    });
    if (!account) {
      return NextResponse.json(
        { error: "accountId does not belong to this tenant" },
        { status: 400 },
      );
    }
  }

  const { customFields, ...contactFields } = parsed.data;
  const merged = { ...existing, ...contactFields };
  const contact = await db.contact.update({
    where: { id },
    data: { ...contactFields, dedupeKey: computeDedupeKey(merged) },
  });
  if (customFields) {
    await setFieldValues(auth.tenantId, "contact", id, customFields);
  }
  const updatedCustomFields = await getFieldValues(auth.tenantId, "contact", id);
  return NextResponse.json({
    contact: { ...contact, customFields: updatedCustomFields },
  });
}
