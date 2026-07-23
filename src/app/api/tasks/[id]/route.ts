import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  ownerUserId: z.string().min(1).optional(),
  status: z.enum(["open", "done"]).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { tenantId } = auth.user;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const existing = await db.task.findFirst({ where: { id, tenantId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.ownerUserId) {
    const owner = await db.user.findFirst({
      where: { id: parsed.data.ownerUserId, tenantId },
    });
    if (!owner) {
      return NextResponse.json(
        { error: "ownerUserId does not belong to this tenant" },
        { status: 400 },
      );
    }
  }

  const { dueDate, status, ...rest } = parsed.data;
  const task = await db.task.update({
    where: { id },
    data: {
      ...rest,
      status,
      dueDate: dueDate === undefined ? undefined : dueDate ? new Date(dueDate) : null,
      completedAt: status === "done" ? new Date() : status === "open" ? null : undefined,
    },
    include: { owner: { select: { email: true } } },
  });

  return NextResponse.json({ task });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { id } = await params;

  const existing = await db.task.findFirst({
    where: { id, tenantId: auth.user.tenantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
