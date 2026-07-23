import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.unauthorized) return auth.unauthorized;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 500);

  const entries = await db.auditLog.findMany({
    where: { tenantId: auth.user.tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const actorIds = [
    ...new Set(entries.map((e) => e.actorUserId).filter((id): id is string => Boolean(id))),
  ];
  const actors = actorIds.length
    ? await db.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, email: true },
      })
    : [];
  const actorEmailById = new Map(actors.map((a) => [a.id, a.email]));

  return NextResponse.json({
    entries: entries.map((e) => ({
      ...e,
      actorEmail: e.actorUserId ? (actorEmailById.get(e.actorUserId) ?? null) : null,
    })),
  });
}
