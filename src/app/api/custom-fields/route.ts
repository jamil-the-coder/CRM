import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { CUSTOM_FIELD_ENTITY_TYPES, CUSTOM_FIELD_TYPES } from "@/lib/custom-fields";

const createFieldSchema = z.object({
  entityType: z.enum(CUSTOM_FIELD_ENTITY_TYPES as [string, ...string[]]),
  key: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, numbers, and underscores only"),
  label: z.string().trim().min(1).max(200),
  type: z.enum(CUSTOM_FIELD_TYPES),
  options: z.array(z.string().trim().min(1)).max(50).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");

  const fields = await db.customFieldDefinition.findMany({
    where: {
      tenantId: auth.user.tenantId,
      ...(entityType ? { entityType } : {}),
    },
    orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }],
  });
  return NextResponse.json({ fields });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { tenantId } = auth.user;

  const body = await request.json().catch(() => null);
  const parsed = createFieldSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  if (parsed.data.type === "select" && !parsed.data.options?.length) {
    return NextResponse.json(
      { error: "Select fields need at least one option" },
      { status: 400 },
    );
  }

  const count = await db.customFieldDefinition.count({
    where: { tenantId, entityType: parsed.data.entityType },
  });

  try {
    const field = await db.customFieldDefinition.create({
      data: { tenantId, ...parsed.data, sortOrder: count },
    });
    return NextResponse.json({ field }, { status: 201 });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A field with that key already exists for this entity type" },
        { status: 409 },
      );
    }
    throw error;
  }
}
