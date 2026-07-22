import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { recordAuditLog } from "@/lib/audit-log";
import { getClientIp } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { id } = await params;

  const existing = await db.webhookEndpoint.findFirst({
    where: { id, tenantId: auth.user.tenantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.webhookEndpoint.delete({ where: { id } });
  await recordAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "webhook_endpoint.deleted",
    metadata: { webhookEndpointId: id, url: existing.url },
    ipAddress: getClientIp(request),
  });
  return NextResponse.json({ ok: true });
}
