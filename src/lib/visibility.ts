import { db } from "@/lib/db";
import type { AuthenticatedUser } from "@/lib/auth";

/**
 * Returns a Prisma `where` fragment enforcing role-based visibility
 * (Phase 29): ADMIN always sees everything in the tenant; a MEMBER is
 * restricted to records they own, but only if the tenant has opted into
 * `restrictMemberVisibility` — off by default, so this is purely additive
 * for every tenant that existed before this feature.
 *
 * Applied at the query layer (spread into `where`), not hidden in the UI —
 * a restricted member gets a real 404 on another user's record via either
 * the list query or a direct findFirst, the same "don't confirm existence"
 * posture as cross-tenant isolation.
 */
export async function getOwnershipVisibilityWhere(
  user: AuthenticatedUser,
): Promise<{ ownerUserId?: string }> {
  if (user.role === "ADMIN") return {};

  const tenant = await db.tenant.findUnique({
    where: { id: user.tenantId },
    select: { restrictMemberVisibility: true },
  });
  if (!tenant?.restrictMemberVisibility) return {};

  return { ownerUserId: user.id };
}
