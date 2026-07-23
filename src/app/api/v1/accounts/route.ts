import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiKey } from "@/lib/api-key-auth";
import { emitEvent } from "@/lib/webhooks";

const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (auth.unauthorized) return auth.unauthorized;

  const accounts = await db.account.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ accounts });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiKey(request);
  if (auth.unauthorized) return auth.unauthorized;
  const { tenantId } = auth;

  const body = await request.json().catch(() => null);
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const account = await db.account.create({
    data: { tenantId, ...parsed.data },
  });
  await emitEvent(tenantId, "account.created", { account });

  return NextResponse.json({ account }, { status: 201 });
}
