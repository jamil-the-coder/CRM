import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { recordAuditLog } from "@/lib/audit-log";
import { getClientIp } from "@/lib/rate-limit";

const updateSettingsSchema = z.object({
  restrictMemberVisibility: z.boolean(),
});

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.unauthorized) return auth.unauthorized;

  const body = await request.json().catch(() => null);
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const tenant = await db.tenant.update({
    where: { id: auth.user.tenantId },
    data: { restrictMemberVisibility: parsed.data.restrictMemberVisibility },
  });

  await recordAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "team.visibility_setting_changed",
    metadata: { restrictMemberVisibility: tenant.restrictMemberVisibility },
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({
    restrictMemberVisibility: tenant.restrictMemberVisibility,
  });
}
