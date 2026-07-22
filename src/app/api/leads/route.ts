import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";

const createLeadSchema = z.object({
  contactId: z.string().min(1),
  source: z.string().trim().min(1).max(100).optional(),
  status: z.string().trim().min(1).max(100).optional(),
  ownerUserId: z.string().min(1).nullable().optional(),
  score: z.number().int().min(0).max(100).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const leads = await db.lead.findMany({
    where: { tenantId: auth.user.tenantId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { contact: true },
  });
  return NextResponse.json({ leads });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { tenantId } = auth.user;

  const body = await request.json().catch(() => null);
  const parsed = createLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const contact = await db.contact.findFirst({
    where: { id: parsed.data.contactId, tenantId },
  });
  if (!contact) {
    return NextResponse.json(
      { error: "contactId does not belong to this tenant" },
      { status: 400 },
    );
  }

  const lead = await db.lead.create({
    data: { tenantId, ...parsed.data },
  });
  await logActivity(tenantId, "lead", lead.id, "lead.created", {
    source: lead.source,
  });

  return NextResponse.json({ lead }, { status: 201 });
}
