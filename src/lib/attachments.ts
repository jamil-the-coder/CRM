import { db } from "@/lib/db";

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Deliberately narrow — no executables, no scripts, nothing a browser would
// ever try to run. Attachments are always served download-only regardless
// (see the download route), but the allow-list is a second layer: don't
// even accept an upload of something that has no legitimate business reason
// to be attached to a CRM record.
export const ALLOWED_ATTACHMENT_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export const ATTACHMENT_ENTITY_TYPES = [
  "contact",
  "account",
  "lead",
  "opportunity",
] as const;

export async function attachmentEntityBelongsToTenant(
  entityType: string,
  entityId: string,
  tenantId: string,
): Promise<boolean> {
  switch (entityType) {
    case "contact":
      return Boolean(await db.contact.findFirst({ where: { id: entityId, tenantId } }));
    case "account":
      return Boolean(await db.account.findFirst({ where: { id: entityId, tenantId } }));
    case "lead":
      return Boolean(await db.lead.findFirst({ where: { id: entityId, tenantId } }));
    case "opportunity":
      return Boolean(
        await db.opportunity.findFirst({ where: { id: entityId, tenantId } }),
      );
    default:
      return false;
  }
}
