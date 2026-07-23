import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { recordAuditLog } from "@/lib/audit-log";
import { getClientIp } from "@/lib/rate-limit";

const updateUserSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const existing = await db.user.findFirst({
    where: { id, tenantId: auth.user.tenantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (id === auth.user.id && parsed.data.role !== "ADMIN") {
    return NextResponse.json(
      { error: "You cannot demote your own account" },
      { status: 400 },
    );
  }

  const user = await db.user.update({
    where: { id },
    data: { role: parsed.data.role },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  await recordAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "team.role_changed",
    metadata: { targetUserId: id, newRole: user.role },
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ user });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { id } = await params;

  if (id === auth.user.id) {
    return NextResponse.json(
      { error: "You cannot remove your own account" },
      { status: 400 },
    );
  }

  const existing = await db.user.findFirst({
    where: { id, tenantId: auth.user.tenantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.user.delete({ where: { id } });

  await recordAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "team.user_removed",
    metadata: { removedUserId: id, email: existing.email },
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
