import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { computeDedupeKey, findDuplicateContacts } from "@/lib/dedupe";
import { enrichContact } from "@/lib/enrichment";

const createContactSchema = z.object({
  firstName: z.string().trim().min(1).max(200),
  lastName: z.string().trim().max(200).optional(),
  email: z.string().trim().toLowerCase().email().max(320).optional(),
  phone: z.string().trim().max(50).optional(),
  company: z.string().trim().max(200).optional(),
  accountId: z.string().min(1).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const contacts = await db.contact.findMany({
    where: { tenantId: auth.user.tenantId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ contacts });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const body = await request.json().catch(() => null);
  const parsed = createContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { tenantId } = auth.user;

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

  const duplicates = await findDuplicateContacts(tenantId, parsed.data);

  const contact = await db.contact.create({
    data: {
      tenantId,
      ...parsed.data,
      dedupeKey: computeDedupeKey(parsed.data),
    },
  });
  await enrichContact(contact.id, {
    email: contact.email,
    company: contact.company,
  });

  return NextResponse.json(
    { contact, possibleDuplicates: duplicates.map((d) => d.id) },
    { status: 201 },
  );
}
