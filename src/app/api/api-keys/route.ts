import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { generateApiKey } from "@/lib/api-key-auth";

const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const keys = await db.apiKey.findMany({
    where: { tenantId: auth.user.tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });
  return NextResponse.json({ apiKeys: keys });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (auth.unauthorized) return auth.unauthorized;

  const body = await request.json().catch(() => null);
  const parsed = createApiKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { fullKey, keyHash, keyPrefix } = generateApiKey();
  const apiKey = await db.apiKey.create({
    data: {
      tenantId: auth.user.tenantId,
      name: parsed.data.name,
      keyHash,
      keyPrefix,
    },
  });

  // The only time the full key is ever available — the DB only holds its hash from here on.
  return NextResponse.json(
    {
      apiKey: { id: apiKey.id, name: apiKey.name, keyPrefix: apiKey.keyPrefix },
      key: fullKey,
    },
    { status: 201 },
  );
}
