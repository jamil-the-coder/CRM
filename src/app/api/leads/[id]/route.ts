import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity";

const updateLeadSchema = z.object({
  status: z.string().trim().min(1).max(100).optional(),
  ownerUserId: z.string().min(1).nullable().optional(),
  score: z.number().int().min(0).max(100).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { id } = await params;

  const lead = await db.lead.findFirst({
    where: { id, tenantId: auth.user.tenantId },
    include: { contact: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ lead });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { id } = await params;
  const { tenantId } = auth.user;

  const body = await request.json().catch(() => null);
  const parsed = updateLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const existing = await db.lead.findFirst({ where: { id, tenantId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const lead = await db.lead.update({ where: { id }, data: parsed.data });

  if (parsed.data.status && parsed.data.status !== existing.status) {
    await logActivity(tenantId, "lead", lead.id, "lead.status_changed", {
      from: existing.status,
      to: lead.status,
    });
  }

  return NextResponse.json({ lead });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { id } = await params;

  const existing = await db.lead.findFirst({
    where: { id, tenantId: auth.user.tenantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.lead.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
