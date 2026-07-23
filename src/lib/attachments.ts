import { CRM_ENTITY_TYPES, crmEntityBelongsToTenant } from "@/lib/polymorphic-entity";

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

// Re-exported for callers that imported these names from here before the
// shared polymorphic-entity module existed — attachments were the first
// feature to need cross-entity-type validation.
export const ATTACHMENT_ENTITY_TYPES = CRM_ENTITY_TYPES;
export const attachmentEntityBelongsToTenant = crmEntityBelongsToTenant;
