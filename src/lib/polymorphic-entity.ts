import { db } from "@/lib/db";

// The shared "which record does this generic entityType/entityId point at"
// check, reused by every polymorphic feature (Notes, Tags, Attachments,
// Tasks) that can attach to more than one CRM record type.
export const CRM_ENTITY_TYPES = ["contact", "account", "lead", "opportunity"] as const;
export type CrmEntityType = (typeof CRM_ENTITY_TYPES)[number];

export async function crmEntityBelongsToTenant(
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
