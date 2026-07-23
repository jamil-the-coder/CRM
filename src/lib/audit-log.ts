import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type AuditAction =
  | "auth.signup"
  | "auth.login_success"
  | "auth.login_failed"
  | "auth.login_locked"
  | "auth.logout"
  | "api_key.created"
  | "api_key.deleted"
  | "webhook_endpoint.created"
  | "webhook_endpoint.deleted"
  | "team.user_added"
  | "team.user_removed"
  | "team.role_changed"
  | "team.visibility_setting_changed"
  | "data.exported";

/** Best-effort: audit logging must never fail the request it's recording. */
export async function recordAuditLog(entry: {
  tenantId?: string | null;
  actorUserId?: string | null;
  action: AuditAction;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}) {
  try {
    await db.auditLog.create({
      data: {
        tenantId: entry.tenantId ?? null,
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        metadata: entry.metadata as Prisma.InputJsonValue,
        ipAddress: entry.ipAddress ?? null,
      },
    });
  } catch {
    // Never let audit logging break the calling request.
  }
}
