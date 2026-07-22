import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiKey } from "@/lib/api-key-auth";
import { computeDedupeKey } from "@/lib/dedupe";

const updateContactSchema = z.object({
  firstName: z.string().trim().min(1).max(200).optional(),
  lastName: z.string().trim().max(200).nullable().optional(),
  email: z.string().trim().toLowerCase().email().max(320).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  company: z.string().trim().max(200).nullable().optional(),
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
  return NextResponse.json({ contact });
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

  const merged = { ...existing, ...parsed.data };
  const contact = await db.contact.update({
    where: { id },
    data: { ...parsed.data, dedupeKey: computeDedupeKey(merged) },
  });
  return NextResponse.json({ contact });
}
