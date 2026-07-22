import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

const createActivitySchema = z.object({
  entityType: z.string().trim().min(1).max(50),
  entityId: z.string().trim().min(1).max(100),
  type: z.string().trim().min(1).max(100),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType") ?? undefined;
  const entityId = searchParams.get("entityId") ?? undefined;

  const activities = await db.activity.findMany({
    where: { tenantId: auth.user.tenantId, entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ activities });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const body = await request.json().catch(() => null);
  const parsed = createActivitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const activity = await db.activity.create({
    data: {
      tenantId: auth.user.tenantId,
      ...parsed.data,
      payload: parsed.data.payload as Prisma.InputJsonValue,
    },
  });
  return NextResponse.json({ activity }, { status: 201 });
}
