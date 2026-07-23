import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { getStorageProvider } from "@/lib/storage";
import { recordAuditLog } from "@/lib/audit-log";
import { getClientIp } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GDPR-style "delete this person" — unlike the ordinary DELETE (which just
 * removes the Contact row and lets Lead/Opportunity/EmailLog cascade via
 * their real FKs), this also cleans up every polymorphic entityType/entityId
 * row pointing at this contact (Note, Activity, Attachment, TagAssignment,
 * CustomFieldValue, Task) — those have no FK to Contact by design (they're
 * shared across four entity types), so the plain DELETE silently orphans
 * them. Admin-only, audit-logged, since this is meant to be a deliberate
 * compliance action, not an everyday one.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { tenantId } = auth.user;
  const { id } = await params;

  const contact = await db.contact.findFirst({ where: { id, tenantId } });
  if (!contact) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const attachments = await db.attachment.findMany({
    where: { tenantId, entityType: "contact", entityId: id },
  });

  await db.$transaction([
    db.note.deleteMany({ where: { tenantId, entityType: "contact", entityId: id } }),
    db.activity.deleteMany({
      where: { tenantId, entityType: "contact", entityId: id },
    }),
    db.attachment.deleteMany({
      where: { tenantId, entityType: "contact", entityId: id },
    }),
    db.tagAssignment.deleteMany({
      where: { tenantId, entityType: "contact", entityId: id },
    }),
    db.task.deleteMany({ where: { tenantId, entityType: "contact", entityId: id } }),
    db.customFieldValue.deleteMany({
      where: { tenantId, entityId: id, definition: { entityType: "contact" } },
    }),
    // Cascades Lead/Opportunity/EmailLog rows via their real FKs.
    db.contact.delete({ where: { id } }),
  ]);

  const storage = getStorageProvider();
  await Promise.all(attachments.map((a) => storage.delete(a.storageKey)));

  await recordAuditLog({
    tenantId,
    actorUserId: auth.user.id,
    action: "contact.hard_deleted",
    metadata: {
      contactId: id,
      email: contact.email,
      attachmentsRemoved: attachments.length,
    },
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
