import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { DEFAULT_FORM_FIELDS, formFieldsSchema } from "@/lib/forms";

const createFormSchema = z.object({
  name: z.string().trim().min(1).max(200),
  fields: formFieldsSchema.optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const forms = await db.form.findMany({
    where: { tenantId: auth.user.tenantId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { submissions: true } } },
  });
  return NextResponse.json({ forms });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const body = await request.json().catch(() => null);
  const parsed = createFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const form = await db.form.create({
    data: {
      tenantId: auth.user.tenantId,
      name: parsed.data.name,
      fields: (parsed.data.fields ??
        DEFAULT_FORM_FIELDS) as Prisma.InputJsonValue,
      embedKey: crypto.randomBytes(12).toString("base64url"),
    },
  });

  return NextResponse.json({ form }, { status: 201 });
}
