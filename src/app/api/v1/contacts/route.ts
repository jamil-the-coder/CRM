import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiKey } from "@/lib/api-key-auth";
import { computeDedupeKey, findDuplicateContacts } from "@/lib/dedupe";
import { enrichContact } from "@/lib/enrichment";
import { getFieldValuesForEntities, setFieldValues } from "@/lib/custom-fields";

const createContactSchema = z.object({
  firstName: z.string().trim().min(1).max(200),
  lastName: z.string().trim().max(200).optional(),
  email: z.string().trim().toLowerCase().email().max(320).optional(),
  phone: z.string().trim().max(50).optional(),
  company: z.string().trim().max(200).optional(),
  accountId: z.string().min(1).optional(),
  customFields: z.record(z.string(), z.string()).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (auth.unauthorized) return auth.unauthorized;

  const contacts = await db.contact.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const customFieldsByEntity = await getFieldValuesForEntities(
    auth.tenantId,
    "contact",
    contacts.map((c) => c.id),
  );
  return NextResponse.json({
    contacts: contacts.map((c) => ({
      ...c,
      customFields: customFieldsByEntity[c.id] ?? {},
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (auth.unauthorized) return auth.unauthorized;

  const body = await request.json().catch(() => null);
  const parsed = createContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { tenantId } = auth;

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

  const { customFields, ...contactData } = parsed.data;
  const duplicates = await findDuplicateContacts(tenantId, contactData);
  const contact = await db.contact.create({
    data: {
      tenantId,
      ...contactData,
      dedupeKey: computeDedupeKey(contactData),
    },
  });
  await enrichContact(contact.id, {
    email: contact.email,
    company: contact.company,
  });
  if (customFields) {
    await setFieldValues(tenantId, "contact", contact.id, customFields);
  }
  const savedCustomFields = customFields
    ? (await getFieldValuesForEntities(tenantId, "contact", [contact.id]))[
        contact.id
      ] ?? {}
    : {};

  return NextResponse.json(
    {
      contact: { ...contact, customFields: savedCustomFields },
      possibleDuplicates: duplicates.map((d) => d.id),
    },
    { status: 201 },
  );
}
