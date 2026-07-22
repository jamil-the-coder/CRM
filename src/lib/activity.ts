import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export function logActivity(
  tenantId: string,
  entityType: string,
  entityId: string,
  type: string,
  payload?: Record<string, unknown>,
) {
  return db.activity.create({
    data: {
      tenantId,
      entityType,
      entityId,
      type,
      payload: payload as Prisma.InputJsonValue,
    },
  });
}
