import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { clearSessionCookie } from "@/lib/auth";
import { getStorageProvider } from "@/lib/storage";
import { recordAuditLog } from "@/lib/audit-log";
import { getClientIp } from "@/lib/rate-limit";

/**
 * Permanently deletes the caller's entire tenant — every business record,
 * user, and session. Always operates on the caller's own tenant (never a
 * tenantId from the request), so there's no cross-tenant deletion risk and
 * no need for a platform-superadmin concept that doesn't exist in this app.
 * Every table already has a real `tenant_id` foreign key with
 * `onDelete: Cascade` (see schema.prisma), so one `tenant.delete` cascades
 * the entire dataset at the database level in a single statement — the only
 * thing Postgres can't clean up on its own is attachment files actually
 * sitting on disk, so those are collected and removed first.
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { tenantId } = auth.user;

  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const attachments = await db.attachment.findMany({ where: { tenantId } });

  await db.tenant.delete({ where: { id: tenantId } });

  const storage = getStorageProvider();
  await Promise.all(attachments.map((a) => storage.delete(a.storageKey)));

  await recordAuditLog({
    tenantId,
    actorUserId: auth.user.id,
    action: "tenant.hard_deleted",
    metadata: { tenantName: tenant.name, attachmentsRemoved: attachments.length },
    ipAddress: getClientIp(request),
  });

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
