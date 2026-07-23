import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { TAG_COLORS } from "@/lib/tags";

const createTagSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: z.enum(TAG_COLORS).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const tags = await db.tag.findMany({
    where: { tenantId: auth.user.tenantId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ tags });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { tenantId } = auth.user;

  const body = await request.json().catch(() => null);
  const parsed = createTagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const tag = await db.tag.create({ data: { tenantId, ...parsed.data } });
    return NextResponse.json({ tag }, { status: 201 });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A tag with that name already exists" },
        { status: 409 },
      );
    }
    throw error;
  }
}
