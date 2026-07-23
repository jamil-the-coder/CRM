import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

const createProductSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sku: z.string().trim().max(100).optional(),
  unitPrice: z.number().min(0),
  currency: z.string().trim().length(3).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") === "1";

  const products = await db.product.findMany({
    where: {
      tenantId: auth.user.tenantId,
      ...(activeOnly ? { active: true } : {}),
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const body = await request.json().catch(() => null);
  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const product = await db.product.create({
    data: { tenantId: auth.user.tenantId, ...parsed.data },
  });
  return NextResponse.json({ product }, { status: 201 });
}
