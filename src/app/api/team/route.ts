import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { hashPassword } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit-log";
import { getClientIp } from "@/lib/rate-limit";

const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(10).max(200),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.unauthorized) return auth.unauthorized;

  const [users, tenant] = await Promise.all([
    db.user.findMany({
      where: { tenantId: auth.user.tenantId },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, role: true, createdAt: true },
    }),
    db.tenant.findUnique({
      where: { id: auth.user.tenantId },
      select: { restrictMemberVisibility: true },
    }),
  ]);
  return NextResponse.json({
    users,
    restrictMemberVisibility: tenant?.restrictMemberVisibility ?? false,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.unauthorized) return auth.unauthorized;

  const body = await request.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists" },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await db.user.create({
    data: {
      tenantId: auth.user.tenantId,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
    },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  await recordAuditLog({
    tenantId: auth.user.tenantId,
    actorUserId: auth.user.id,
    action: "team.user_added",
    metadata: { addedUserId: user.id, email: user.email, role: user.role },
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ user }, { status: 201 });
}
