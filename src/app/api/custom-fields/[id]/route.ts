import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { id } = await params;

  const existing = await db.customFieldDefinition.findFirst({
    where: { id, tenantId: auth.user.tenantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.customFieldDefinition.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
